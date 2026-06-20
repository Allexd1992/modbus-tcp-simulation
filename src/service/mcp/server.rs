use std::sync::Arc;

use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{Implementation, ServerCapabilities, ServerInfo},
    schemars, tool, tool_handler, tool_router, ErrorData, ServerHandler,
};
use serde::Deserialize;

use crate::service::mcp::config::McpConfig;
use crate::service::mcp::ops::{
    export_simulation_bundle, import_simulation_bundle, map_io_err, reload_script_engine,
    reload_var_map_engine,
};
use crate::service::modbus::{interfaces::IRegistry, store::Store};
use crate::service::sim::{self, ScriptExportBundle, ScriptExportEntry};
use crate::service::var_map::{self, VarMapBundle};

#[derive(Clone)]
pub struct ModbusMcpServer {
    config: McpConfig,
    tool_router: ToolRouter<Self>,
}

impl ModbusMcpServer {
    pub fn new(config: McpConfig) -> Self {
        Self {
            config,
            tool_router: Self::tool_router(),
        }
    }

    fn lock_store(&self) -> Result<std::sync::MutexGuard<'_, Store>, ErrorData> {
        self.config
            .store
            .lock()
            .map_err(|_| ErrorData::internal_error("store mutex poisoned", None))
    }

    fn require_sim(&self) -> Result<(), ErrorData> {
        if self.config.sim_scripts_enabled {
            Ok(())
        } else {
            Err(ErrorData::internal_error(
                "simulation scripts disabled (SIM_SCRIPTS_DISABLE)",
                None,
            ))
        }
    }

    fn to_json<T: serde::Serialize>(value: &T) -> Result<String, ErrorData> {
        serde_json::to_string_pretty(value)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))
    }
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct AddrCount {
    #[schemars(description = "Starting Modbus address")]
    addr: u16,
    #[schemars(description = "Number of registers or coils")]
    cnt: u16,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct AddrValueU16 {
    addr: u16,
    value: u16,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct AddrValueBool {
    addr: u16,
    value: bool,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct RegisterBatch {
    addr: u16,
    #[schemars(description = "Values written starting at addr")]
    values: Vec<u16>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct CoilBatch {
    addr: u16,
    values: Vec<bool>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct ScriptName {
    #[schemars(description = "Script file name, e.g. my-sim.js")]
    name: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct ScriptWrite {
    name: String,
    content: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct ScriptImportParams {
    version: u32,
    scripts: Vec<ScriptWrite>,
    #[serde(default = "default_import_mode")]
    #[schemars(description = "merge (default) or replace")]
    mode: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct VarMapImportParams {
    version: u32,
    variables: Vec<serde_json::Value>,
    #[serde(default = "default_import_mode")]
    mode: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct VarMapSaveParams {
    version: u32,
    variables: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct SimulationImportParams {
    version: u32,
    #[serde(default)]
    scripts: Option<Vec<ScriptWrite>>,
    #[serde(rename = "varMap", default)]
    var_map: Option<serde_json::Value>,
    #[serde(default)]
    variables: Option<Vec<serde_json::Value>>,
    #[serde(default = "default_import_mode")]
    mode: String,
}

fn default_import_mode() -> String {
    "merge".to_string()
}

fn parse_var_map_bundle(
    version: u32,
    variables: Vec<serde_json::Value>,
) -> Result<VarMapBundle, ErrorData> {
    let bundle = VarMapBundle {
        version,
        variables: variables
            .into_iter()
            .map(|v| {
                serde_json::from_value(v)
                    .map_err(|e| ErrorData::invalid_params(e.to_string(), None))
            })
            .collect::<Result<Vec<_>, _>>()?,
    };
    var_map::normalize_bundle(&bundle).map_err(map_io_err)
}

#[tool_router]
impl ModbusMcpServer {
    #[tool(description = "Read Modbus holding registers (FC 03)")]
    async fn modbus_read_holding_registers(
        &self,
        Parameters(AddrCount { addr, cnt }): Parameters<AddrCount>,
    ) -> Result<String, ErrorData> {
        let store = self.lock_store()?;
        let v = store
            .holding_registers_read(addr, cnt)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        serde_json::to_string(&v).map_err(|e| ErrorData::internal_error(e.to_string(), None))
    }

    #[tool(description = "Read Modbus input registers (FC 04)")]
    async fn modbus_read_input_registers(
        &self,
        Parameters(AddrCount { addr, cnt }): Parameters<AddrCount>,
    ) -> Result<String, ErrorData> {
        let store = self.lock_store()?;
        let v = store
            .input_registers_read(addr, cnt)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        serde_json::to_string(&v).map_err(|e| ErrorData::internal_error(e.to_string(), None))
    }

    #[tool(description = "Read discrete coils (FC 01)")]
    async fn modbus_read_discrete_coils(
        &self,
        Parameters(AddrCount { addr, cnt }): Parameters<AddrCount>,
    ) -> Result<String, ErrorData> {
        let store = self.lock_store()?;
        let v = store
            .discrete_coils_read(addr, cnt)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        serde_json::to_string(&v).map_err(|e| ErrorData::internal_error(e.to_string(), None))
    }

    #[tool(description = "Read discrete inputs (FC 02)")]
    async fn modbus_read_discrete_inputs(
        &self,
        Parameters(AddrCount { addr, cnt }): Parameters<AddrCount>,
    ) -> Result<String, ErrorData> {
        let store = self.lock_store()?;
        let v = store
            .discrete_input_read(addr, cnt)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        serde_json::to_string(&v).map_err(|e| ErrorData::internal_error(e.to_string(), None))
    }

    #[tool(description = "Write a single holding register")]
    async fn modbus_write_holding_register(
        &self,
        Parameters(AddrValueU16 { addr, value }): Parameters<AddrValueU16>,
    ) -> Result<String, ErrorData> {
        let mut store = self.lock_store()?;
        store
            .holding_registers_write(addr, std::slice::from_ref(&value))
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok("ok".to_string())
    }

    #[tool(description = "Write a single input register")]
    async fn modbus_write_input_register(
        &self,
        Parameters(AddrValueU16 { addr, value }): Parameters<AddrValueU16>,
    ) -> Result<String, ErrorData> {
        let mut store = self.lock_store()?;
        store
            .input_registers_write(addr, std::slice::from_ref(&value))
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok("ok".to_string())
    }

    #[tool(description = "Write a single discrete coil")]
    async fn modbus_write_discrete_coil(
        &self,
        Parameters(AddrValueBool { addr, value }): Parameters<AddrValueBool>,
    ) -> Result<String, ErrorData> {
        let mut store = self.lock_store()?;
        store
            .discrete_coil_write(addr, std::slice::from_ref(&value))
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok("ok".to_string())
    }

    #[tool(description = "Write a single discrete input")]
    async fn modbus_write_discrete_input(
        &self,
        Parameters(AddrValueBool { addr, value }): Parameters<AddrValueBool>,
    ) -> Result<String, ErrorData> {
        let mut store = self.lock_store()?;
        store
            .discrete_input_write(addr, std::slice::from_ref(&value))
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok("ok".to_string())
    }

    #[tool(description = "Write multiple holding registers from a starting address")]
    async fn modbus_write_holding_registers(
        &self,
        Parameters(RegisterBatch { addr, values }): Parameters<RegisterBatch>,
    ) -> Result<String, ErrorData> {
        let mut store = self.lock_store()?;
        store
            .holding_registers_write(addr, &values)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok("ok".to_string())
    }

    #[tool(description = "Write multiple input registers from a starting address")]
    async fn modbus_write_input_registers(
        &self,
        Parameters(RegisterBatch { addr, values }): Parameters<RegisterBatch>,
    ) -> Result<String, ErrorData> {
        let mut store = self.lock_store()?;
        store
            .input_registers_write(addr, &values)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok("ok".to_string())
    }

    #[tool(description = "Write multiple discrete coils from a starting address")]
    async fn modbus_write_discrete_coils(
        &self,
        Parameters(CoilBatch { addr, values }): Parameters<CoilBatch>,
    ) -> Result<String, ErrorData> {
        let mut store = self.lock_store()?;
        store
            .discrete_coil_write(addr, &values)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok("ok".to_string())
    }

    #[tool(description = "Write multiple discrete inputs from a starting address")]
    async fn modbus_write_discrete_inputs(
        &self,
        Parameters(CoilBatch { addr, values }): Parameters<CoilBatch>,
    ) -> Result<String, ErrorData> {
        let mut store = self.lock_store()?;
        store
            .discrete_input_write(addr, &values)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok("ok".to_string())
    }

    #[tool(description = "Get the address map (named Modbus variables for map.* in scripts)")]
    async fn var_map_get(&self) -> Result<String, ErrorData> {
        let bundle = var_map::load(&self.config.var_map_path).map_err(map_io_err)?;
        Self::to_json(&bundle)
    }

    #[tool(description = "Replace the entire address map and reload it in the script engine")]
    async fn var_map_save(
        &self,
        Parameters(body): Parameters<VarMapSaveParams>,
    ) -> Result<String, ErrorData> {
        let bundle = parse_var_map_bundle(body.version, body.variables)?;
        var_map::save(&self.config.var_map_path, &bundle).map_err(map_io_err)?;
        reload_var_map_engine(&self.config.engine)?;
        Self::to_json(&serde_json::json!({
            "ok": true,
            "count": bundle.variables.len(),
        }))
    }

    #[tool(description = "Import address map entries (merge or replace by name)")]
    async fn var_map_import(
        &self,
        Parameters(body): Parameters<VarMapImportParams>,
    ) -> Result<String, ErrorData> {
        let bundle = parse_var_map_bundle(body.version, body.variables)?;
        let replace = body.mode.eq_ignore_ascii_case("replace");
        let imported = var_map::import_bundle(&self.config.var_map_path, &bundle, replace)
            .map_err(map_io_err)?;
        reload_var_map_engine(&self.config.engine)?;
        Self::to_json(&serde_json::json!({
            "imported": imported,
            "reloaded": true,
        }))
    }

    #[tool(description = "List simulation rule scripts (*.js)")]
    async fn sim_scripts_list(&self) -> Result<String, ErrorData> {
        self.require_sim()?;
        let scripts = sim::list_scripts(&self.config.scripts_dir).map_err(map_io_err)?;
        Self::to_json(&serde_json::json!({
            "enabled": true,
            "scripts": scripts,
        }))
    }

    #[tool(description = "Read a simulation rule script by file name")]
    async fn sim_scripts_read(
        &self,
        Parameters(ScriptName { name }): Parameters<ScriptName>,
    ) -> Result<String, ErrorData> {
        self.require_sim()?;
        let content = sim::read_script(&self.config.scripts_dir, &name).map_err(map_io_err)?;
        Self::to_json(&serde_json::json!({ "name": name, "content": content }))
    }

    #[tool(description = "Create or update a simulation rule script and reload the engine")]
    async fn sim_scripts_write(
        &self,
        Parameters(ScriptWrite { name, content }): Parameters<ScriptWrite>,
    ) -> Result<String, ErrorData> {
        self.require_sim()?;
        sim::write_script(&self.config.scripts_dir, &name, &content).map_err(map_io_err)?;
        reload_script_engine(&self.config.engine)?;
        Ok(format!("saved {name}, engine reloaded"))
    }

    #[tool(description = "Delete a simulation rule script and reload the engine")]
    async fn sim_scripts_delete(
        &self,
        Parameters(ScriptName { name }): Parameters<ScriptName>,
    ) -> Result<String, ErrorData> {
        self.require_sim()?;
        sim::delete_script(&self.config.scripts_dir, &name).map_err(map_io_err)?;
        reload_script_engine(&self.config.engine)?;
        Ok(format!("deleted {name}, engine reloaded"))
    }

    #[tool(description = "Reload the QuickJS simulation engine from disk")]
    async fn sim_scripts_reload(&self) -> Result<String, ErrorData> {
        self.require_sim()?;
        reload_script_engine(&self.config.engine)?;
        Ok("engine reloaded".to_string())
    }

    #[tool(description = "Export all simulation rule scripts as JSON")]
    async fn sim_scripts_export(&self) -> Result<String, ErrorData> {
        self.require_sim()?;
        let bundle = sim::export_scripts(&self.config.scripts_dir).map_err(map_io_err)?;
        Self::to_json(&bundle)
    }

    #[tool(description = "Import simulation rule scripts (merge or replace)")]
    async fn sim_scripts_import(
        &self,
        Parameters(body): Parameters<ScriptImportParams>,
    ) -> Result<String, ErrorData> {
        self.require_sim()?;
        let replace = body.mode.eq_ignore_ascii_case("replace");
        let bundle = ScriptExportBundle {
            version: body.version,
            scripts: body
                .scripts
                .into_iter()
                .map(|s| ScriptExportEntry {
                    name: s.name,
                    content: s.content,
                })
                .collect(),
        };
        let imported =
            sim::import_scripts(&self.config.scripts_dir, &bundle, replace).map_err(map_io_err)?;
        reload_script_engine(&self.config.engine)?;
        Self::to_json(&serde_json::json!({
            "imported": imported,
            "reloaded": true,
        }))
    }

    #[tool(description = "Export address map and simulation scripts in one JSON bundle")]
    async fn simulation_export(&self) -> Result<String, ErrorData> {
        let value = export_simulation_bundle(
            &self.config.scripts_dir,
            &self.config.var_map_path,
            self.config.sim_scripts_enabled,
        )?;
        serde_json::to_string_pretty(&value)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))
    }

    #[tool(description = "Import address map and/or simulation scripts from one JSON bundle")]
    async fn simulation_import(
        &self,
        Parameters(body): Parameters<SimulationImportParams>,
    ) -> Result<String, ErrorData> {
        let var_map = if let Some(raw) = body.var_map {
            Some(parse_var_map_bundle(
                raw.get("version")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(body.version as u64) as u32,
                raw.get("variables")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default(),
            )?)
        } else if let Some(vars) = body.variables {
            Some(parse_var_map_bundle(body.version, vars)?)
        } else {
            None
        };
        let scripts = body.scripts.map(|list| {
            list.into_iter()
                .map(|s| crate::service::http::sim_scripts::ScriptContent {
                    name: s.name,
                    content: s.content,
                })
                .collect()
        });
        let value = import_simulation_bundle(
            &self.config.scripts_dir,
            &self.config.var_map_path,
            self.config.sim_scripts_enabled,
            &self.config.engine,
            body.version,
            scripts,
            var_map,
            None,
            &body.mode,
        )?;
        serde_json::to_string_pretty(&value)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for ModbusMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new(
                "modbus-apcs-mcp",
                env!("CARGO_PKG_VERSION"),
            ))
            .with_instructions(
                "Streamable HTTP MCP at POST /mcp. \
                 Modbus tools read/write the in-memory store. \
                 var_map_* tools manage the address map (named variables for map.* in scripts). \
                 sim_scripts_* tools manage QuickJS simulation rule scripts. \
                 simulation_export/import handle both together. \
                 Script tools require SIM_SCRIPTS_DISABLE unset.",
            )
    }
}

pub fn mcp_http_service(
    config: McpConfig,
) -> rmcp::transport::streamable_http_server::tower::StreamableHttpService<
    ModbusMcpServer,
    rmcp::transport::streamable_http_server::session::local::LocalSessionManager,
> {
    use rmcp::transport::streamable_http_server::{
        session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
    };

    StreamableHttpService::new(
        move || Ok(ModbusMcpServer::new(config.clone())),
        Arc::new(LocalSessionManager::default()),
        StreamableHttpServerConfig::default(),
    )
}

#[allow(dead_code)]
pub async fn run_mcp_http_server(config: McpConfig, port: u16) -> anyhow::Result<()> {
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    let service = mcp_http_service(config);
    let app = axum::Router::new().nest_service("/mcp", service);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr, "MCP Streamable HTTP listening (standalone)");
    axum::serve(listener, app).await?;
    Ok(())
}
