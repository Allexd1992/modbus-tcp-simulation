use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::service::modbus::store::Store;
use crate::service::sim::ScriptEngineHandle;

#[derive(Clone)]
pub struct McpConfig {
    pub store: Arc<Mutex<Store>>,
    pub var_map_path: PathBuf,
    pub scripts_dir: PathBuf,
    pub sim_scripts_enabled: bool,
    pub engine: Option<ScriptEngineHandle>,
}
