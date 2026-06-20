use std::net::{Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};

use axum::{
    body::Body,
    extract::{Request, State},
    http::{Method, StatusCode, Uri},
    middleware::{self, Next},
    response::Response,
    Router,
};
use hyper_util::{
    client::legacy::connect::HttpConnector, client::legacy::Client, rt::TokioExecutor,
};
use rocket::Config;

use crate::service::http::{
    api::Api, context::get_rocket, limits::HttpLimits, state::SimScriptsState,
};
use crate::service::mcp::{mcp_http_service, McpConfig};
use crate::service::modbus::store::Store;

type HttpClient = Client<HttpConnector, Body>;

async fn log_http_request(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let started = std::time::Instant::now();
    let response = next.run(req).await;
    let status = response.status();
    let elapsed_ms = started.elapsed().as_millis();
    if status.is_server_error() {
        tracing::warn!(%method, path, status = %status, elapsed_ms, "http request");
    } else if tracing::enabled!(tracing::Level::DEBUG) {
        tracing::debug!(%method, path, status = %status, elapsed_ms, "http request");
    } else if method != Method::GET || !path.starts_with("/ui/") {
        tracing::info!(%method, path, status = %status, elapsed_ms, "http request");
    }
    response
}

async fn proxy_to_rocket(
    State(base): State<Uri>,
    req: Request,
) -> Result<Response, (StatusCode, String)> {
    let client: HttpClient = Client::builder(TokioExecutor::new()).build_http();
    let (mut parts, body) = req.into_parts();
    let path_and_query = parts
        .uri
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");
    let authority = base
        .authority()
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "no authority".into()))?
        .as_str();
    let uri = Uri::builder()
        .scheme("http")
        .authority(authority)
        .path_and_query(path_and_query)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    parts.uri = uri;
    let req = Request::from_parts(parts, body);
    let resp = client
        .request(req)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
    Ok(resp.map(Body::new))
}

async fn reserve_internal_port() -> anyhow::Result<u16> {
    let listener =
        tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0))).await?;
    Ok(listener.local_addr()?.port())
}

pub async fn run_unified_web(
    public_port: u16,
    registry: Arc<Mutex<Store>>,
    api: Api,
    limits: HttpLimits,
    sim_scripts: SimScriptsState,
    var_map_path: std::path::PathBuf,
    mcp_enabled: bool,
) -> anyhow::Result<()> {
    let internal_port = reserve_internal_port().await?;
    let internal_uri: Uri = format!("http://127.0.0.1:{internal_port}")
        .parse()
        .map_err(|e| anyhow::anyhow!("internal uri: {e}"))?;

    let rocket_config = Config {
        address: Ipv4Addr::LOCALHOST.into(),
        port: internal_port,
        ..Config::default()
    };

    let rocket = get_rocket(
        rocket_config,
        Arc::clone(&registry),
        api,
        limits,
        sim_scripts.clone(),
        var_map_path.clone(),
    )
    .ignite()
    .await?;

    tokio::spawn(async move {
        if let Err(e) = rocket.launch().await {
            tracing::error!(error = %e, "Rocket internal server error");
        }
    });

    // Allow Rocket to bind before accepting public traffic.
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;

    let mut router = Router::new()
        .fallback(proxy_to_rocket)
        .with_state(internal_uri);

    if mcp_enabled {
        let mcp = mcp_http_service(McpConfig {
            store: Arc::clone(&registry),
            var_map_path: var_map_path.clone(),
            scripts_dir: sim_scripts.dir.clone(),
            sim_scripts_enabled: sim_scripts.enabled,
            engine: sim_scripts.engine.clone(),
        });
        router = Router::new().nest_service("/mcp", mcp).merge(router);
        tracing::info!(port = public_port, "MCP Streamable HTTP listening at /mcp");
    }

    let addr = SocketAddr::from(([0, 0, 0, 0], public_port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(
        %addr,
        mcp = mcp_enabled,
        "Web server listening (API + UI + Swagger)"
    );
    let router = router.layer(middleware::from_fn(log_http_request));
    axum::serve(listener, router).await?;
    Ok(())
}
