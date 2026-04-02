use std::env;
use std::sync::{Arc, Mutex};
mod service;
use crate::service::{
    http::{api::Api, context::get_rocket},
    mcp::run_mcp_http_server,
    modbus::{builder::server_build, store::Store},
};
use rocket::Config;

#[tokio::main]

async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let registry = Arc::new(Mutex::new(Store::new()));
    let port = env::var("MB_SERVER_PORT")
        .unwrap_or_else(|_| "502".to_string())
        .parse::<u16>()
        .unwrap();
    let addr = format!("0.0.0.0:{}", port);

    let web_port = env::var("WEB_SERVER_PORT")
        .unwrap_or_else(|_| "9090".to_string())
        .parse::<u16>()
        .unwrap();
    let rocket_config = Config {
        address: "0.0.0.0".parse()?,
        port: web_port,
        ..Default::default()
    };

    let socket_addr = addr.parse().unwrap();

    // MCP Streamable HTTP: port from MCP_SERVER_PORT (default 8081). Set to "0" to disable.
    let mcp_port: u16 = env::var("MCP_SERVER_PORT")
        .unwrap_or_else(|_| "8081".to_string())
        .parse::<u16>()
        .unwrap_or_else(|_| {
            eprintln!("warning: invalid MCP_SERVER_PORT, using 8081");
            8081
        });

    if mcp_port != 0 {
        eprintln!("MCP_SERVER_PORT={mcp_port} (Streamable HTTP at /mcp on this port; set MCP_SERVER_PORT=0 to disable)");
        let store = Arc::clone(&registry);
        tokio::spawn(async move {
            if let Err(e) = run_mcp_http_server(store, mcp_port).await {
                eprintln!("MCP HTTP server error: {e}");
            }
        });
    } else {
        eprintln!("MCP disabled (MCP_SERVER_PORT=0)");
    }

    tokio::select! {
        _ = server_build(socket_addr,Arc::clone(&registry)) => unreachable!(),
        _ = get_rocket(rocket_config,Arc::clone(&registry),Api::new()).launch()=>{},
    }

    Ok(())
}
