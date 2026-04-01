use std::sync::{Arc, Mutex};

use rmcp::{
    ErrorData, ServerHandler,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{Implementation, ServerCapabilities, ServerInfo},
    schemars,
    tool,
    tool_handler,
    tool_router,
};
use serde::Deserialize;

use crate::service::modbus::{interfaces::IRegistry, store::Store};

#[derive(Clone)]
pub struct ModbusMcpServer {
    store: Arc<Mutex<Store>>,
    tool_router: ToolRouter<Self>,
}

impl ModbusMcpServer {
    pub fn new(store: Arc<Mutex<Store>>) -> Self {
        Self {
            store,
            tool_router: Self::tool_router(),
        }
    }

    fn lock_store(&self) -> Result<std::sync::MutexGuard<'_, Store>, ErrorData> {
        self.store
            .lock()
            .map_err(|_| ErrorData::internal_error("store mutex poisoned", None))
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
                "Streamable HTTP MCP at POST /mcp (and GET for SSE when using sessions). \
                 Tools expose the same Modbus-backed store as the REST API under /api/v1.",
            )
    }
}

pub async fn run_mcp_http_server(
    store: Arc<Mutex<Store>>,
    port: u16,
) -> anyhow::Result<()> {
    use rmcp::transport::streamable_http_server::{
        session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
    };

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    let server = ModbusMcpServer::new(store);
    let service = StreamableHttpService::new(
        move || Ok(server.clone()),
        Arc::new(LocalSessionManager::default()),
        StreamableHttpServerConfig::default(),
    );
    let app = axum::Router::new().nest_service("/mcp", service);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    eprintln!("MCP (Streamable HTTP): http://{addr}/mcp");
    axum::serve(listener, app).await?;
    Ok(())
}
