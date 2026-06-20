use std::env;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

mod logging;
mod service;
use crate::service::{
    http::{api::Api, limits::HttpLimits, state::SimScriptsState, unified::run_unified_web},
    modbus::{builder::server_build, store::Store},
    sim,
};

const DEFAULT_SCRIPTS_DIR: &str = "script";
const DEFAULT_VAR_MAP_PATH: &str = "conf/var-map.json";
const LEGACY_SCRIPTS_DIR: &str = "scripts";
const LEGACY_VAR_MAP_PATH: &str = "var-map.json";

fn resolve_scripts_dir() -> PathBuf {
    match env::var("SIM_SCRIPTS_DIR") {
        Ok(path) => PathBuf::from(path),
        Err(_) => {
            let dir = PathBuf::from(DEFAULT_SCRIPTS_DIR);
            migrate_scripts_dir(&dir);
            dir
        }
    }
}

fn resolve_var_map_path() -> PathBuf {
    match env::var("VAR_MAP_PATH") {
        Ok(path) => PathBuf::from(path),
        Err(_) => {
            let path = PathBuf::from(DEFAULT_VAR_MAP_PATH);
            migrate_var_map(&path);
            path
        }
    }
}

fn migrate_scripts_dir(target: &Path) {
    if std::fs::create_dir_all(target).is_err() {
        return;
    }
    let legacy = PathBuf::from(LEGACY_SCRIPTS_DIR);
    if !legacy.is_dir() || paths_same_dir(&legacy, target) {
        return;
    }
    let Ok(entries) = std::fs::read_dir(&legacy) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_none_or(|x| x != "js") {
            continue;
        }
        let Some(name) = path.file_name() else {
            continue;
        };
        let dest = target.join(name);
        let copy = !dest.exists() || file_is_newer(&path, &dest);
        if !copy {
            continue;
        }
        match std::fs::copy(&path, &dest) {
            Ok(_) => tracing::info!(
                legacy = LEGACY_SCRIPTS_DIR,
                file = %name.to_string_lossy(),
                target = %target.display(),
                "migrated script"
            ),
            Err(e) => tracing::warn!(
                legacy = LEGACY_SCRIPTS_DIR,
                file = %name.to_string_lossy(),
                error = %e,
                "could not copy legacy script"
            ),
        }
    }
    if remove_legacy_scripts_dir(&legacy) {
        tracing::info!(
            legacy = LEGACY_SCRIPTS_DIR,
            target = DEFAULT_SCRIPTS_DIR,
            "removed legacy scripts directory"
        );
    }
}

fn file_is_newer(src: &Path, dest: &Path) -> bool {
    match (
        src.metadata().and_then(|m| m.modified()),
        dest.metadata().and_then(|m| m.modified()),
    ) {
        (Ok(src_time), Ok(dest_time)) => src_time > dest_time,
        (Ok(_), Err(_)) => true,
        _ => false,
    }
}

fn remove_legacy_scripts_dir(legacy: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(legacy) else {
        return false;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if std::fs::remove_file(&path).is_err() {
                return false;
            }
        } else if path.is_dir() {
            return false;
        }
    }
    std::fs::remove_dir(legacy).is_ok()
}

fn paths_same_dir(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

fn migrate_var_map(target: &Path) {
    if target.is_file() {
        return;
    }
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }
    let legacy = PathBuf::from(LEGACY_VAR_MAP_PATH);
    if !legacy.is_file() {
        return;
    }
    match std::fs::rename(&legacy, target) {
        Ok(()) => tracing::info!(
            legacy = LEGACY_VAR_MAP_PATH,
            target = %target.display(),
            "migrated var-map"
        ),
        Err(e) => tracing::warn!(
            legacy = LEGACY_VAR_MAP_PATH,
            error = %e,
            "could not migrate var-map"
        ),
    }
}

#[tokio::main]

async fn main() -> Result<(), Box<dyn std::error::Error>> {
    logging::init();

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

    let socket_addr = addr.parse().unwrap();

    // MCP Streamable HTTP at /mcp on the web port. Set MCP_SERVER_PORT=0 to disable.
    let mcp_enabled = env::var("MCP_SERVER_PORT")
        .unwrap_or_else(|_| "1".to_string())
        .parse::<u16>()
        .unwrap_or(1)
        != 0;
    if mcp_enabled {
        tracing::info!("MCP enabled at /mcp on WEB_SERVER_PORT (set MCP_SERVER_PORT=0 to disable)");
    } else {
        tracing::info!("MCP disabled (MCP_SERVER_PORT=0)");
    }

    let limits = HttpLimits::from_env();
    tracing::info!(
        max_address = limits.max_modbus_address,
        max_read_count = limits.max_read_count,
        "HTTP Modbus limits"
    );

    let sim_disabled = env::var("SIM_SCRIPTS_DISABLE")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let scripts_dir = resolve_scripts_dir();
    let var_map_path = resolve_var_map_path();
    tracing::info!(dir = %scripts_dir.display(), "scripts directory");
    tracing::info!(path = %var_map_path.display(), "var-map path");

    let sim_engine = if sim_disabled {
        tracing::info!("simulation scripts disabled (SIM_SCRIPTS_DISABLE)");
        None
    } else {
        match sim::spawn(
            Arc::clone(&registry),
            scripts_dir.clone(),
            var_map_path.clone(),
        ) {
            Ok(handle) => {
                tracing::info!("simulation script engine started");
                Some(handle)
            }
            Err(e) => {
                tracing::warn!(error = %e, "simulation scripts failed to start");
                None
            }
        }
    };

    let sim_scripts_state = SimScriptsState {
        enabled: !sim_disabled && sim_engine.is_some(),
        dir: scripts_dir,
        engine: sim_engine,
    };

    tokio::select! {
        _ = server_build(socket_addr,Arc::clone(&registry)) => unreachable!(),
        r = run_unified_web(
            web_port,
            Arc::clone(&registry),
            Api::new(),
            limits,
            sim_scripts_state,
            var_map_path,
            mcp_enabled,
        ) => {
            if let Err(e) = r {
                tracing::error!(error = %e, "web server exited with error");
            }
        },
    }

    Ok(())
}
