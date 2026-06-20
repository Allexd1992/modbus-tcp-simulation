use std::path::PathBuf;

use crate::service::http::limits::HttpLimits;
use crate::service::modbus::store::Store;
use crate::service::sim::ScriptEngineHandle;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct SimScriptsState {
    pub enabled: bool,
    pub dir: PathBuf,
    pub engine: Option<ScriptEngineHandle>,
}

pub struct AppState {
    pub store: Arc<Mutex<Store>>,
    pub limits: HttpLimits,
    pub sim_scripts: SimScriptsState,
    pub var_map_path: PathBuf,
}

impl AppState {
    pub fn new(
        registry: Arc<Mutex<Store>>,
        limits: HttpLimits,
        sim_scripts: SimScriptsState,
        var_map_path: PathBuf,
    ) -> Self {
        AppState {
            store: Arc::clone(&registry),
            limits,
            sim_scripts,
            var_map_path,
        }
    }
}
