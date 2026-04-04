use crate::service::http::state::AppState;
use crate::service::http::types::{RequestCoil, RequestRegister};
use crate::service::modbus::interfaces::IRegistry;
use rocket::data::ByteUnit;
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::serde::Serialize;
use rocket::Data;
use rocket::{get, post, routes, Route, State};
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct UiConfig {
    pub max_modbus_address: u16,
    pub max_read_count: u16,
}

/// Лимиты для UI и клиентов (синхронно с `MB_MAX_ADDRESS`, `MB_MAX_READ_COUNT`).
#[utoipa::path(
    context_path = "/api/v1",
    responses((status = 200, description = "Limits", body = UiConfig))
)]
#[get("/ui-config")]
pub fn ui_config(state: &State<AppState>) -> Json<UiConfig> {
    Json(UiConfig {
        max_modbus_address: state.limits.max_modbus_address,
        max_read_count: state.limits.max_read_count,
    })
}

/// Read Holding registers
#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Get registers", body = Vec<u16>)
    )
    ,
    params(
    ("addr", description = "Holding register addres"),
    ("cnt", description = "Number registers"),
),
)]
#[get("/holding-registers/<addr>/<cnt>")]
pub fn holding_registers_read(
    addr: u16,
    cnt: u16,
    state: &State<AppState>,
) -> Result<String, Status> {
    state.limits.validate_read_range(addr, cnt)?;
    let store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    let data = store.holding_registers_read(addr, cnt).unwrap();
    Ok(serde_json::to_string_pretty(&data).unwrap())
}
/// Read Input registers
#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Geting input registers", body = Vec<u16>)
    )
    ,
    params(
    ("addr", description = "Input register addres"),
    ("cnt", description = "Number registers"),
),
)]
#[get("/input-registers/<addr>/<cnt>")]
pub fn input_registers_read(
    addr: u16,
    cnt: u16,
    state: &State<AppState>,
) -> Result<String, Status> {
    state.limits.validate_read_range(addr, cnt)?;
    let store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    let data = store.input_registers_read(addr, cnt).unwrap();
    Ok(serde_json::to_string_pretty(&data).unwrap())
}

/// Read Discrete coils
#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Geting discrete coils", body = Vec<bool>)
    )
    ,
    params(
    ("addr", description = "Discrete coils addres"),
    ("cnt", description = "Number coils"),
),
)]
#[get("/discrete-coils/<addr>/<cnt>")]
pub fn discrete_coils_read(addr: u16, cnt: u16, state: &State<AppState>) -> Result<String, Status> {
    state.limits.validate_read_range(addr, cnt)?;
    let store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    let data = store.discrete_coils_read(addr, cnt).unwrap();
    Ok(serde_json::to_string_pretty(&data).unwrap())
}

/// Read Discrete inputs
#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Geting discrete inputs", body = Vec<bool>)
    )
    ,
    params(
    ("addr", description = "Discrete inputs addres"),
    ("cnt", description = "Number inputs"),
),
)]
#[get("/discrete-inputs/<addr>/<cnt>")]
pub fn discrete_input_read(addr: u16, cnt: u16, state: &State<AppState>) -> Result<String, Status> {
    state.limits.validate_read_range(addr, cnt)?;
    let store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    let data = store.discrete_input_read(addr, cnt).unwrap();
    Ok(serde_json::to_string_pretty(&data).unwrap())
}

// single writing

/// Write Single Holding Register
#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Writing is Success")
    )
    ,
    params(
    ("addr", description = "Holding register addres"),
    ("data", description = "Writing data"),
),
)]
#[post("/holding-register/<addr>/<data>")]
pub fn holding_register_write(addr: u16, data: u16, state: &State<AppState>) -> Result<(), Status> {
    state.limits.validate_address(addr)?;
    let values = [data];
    let mut store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    store
        .holding_registers_write(addr, &values)
        .map_err(|_| Status::InternalServerError)?;

    Ok(())
}

/// Write Single Input Register
#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Writing is Success")
    )
    ,
    params(
    ("addr", description = "Input register addres"),
    ("data", description = "Writing data"),
),
)]
#[post("/input-register/<addr>/<data>")]
pub fn input_register_write(addr: u16, data: u16, state: &State<AppState>) -> Result<(), Status> {
    state.limits.validate_address(addr)?;
    let values = [data];
    let mut store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    store
        .input_registers_write(addr, &values)
        .map_err(|_| Status::InternalServerError)?;
    Ok(())
}

/// Write Single Discrete Coil
#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Writing is Success")
    )
    ,
    params(
    ("addr", description = "Discrete coil addres"),
    ("data", description = "Writing data"),
),
)]
#[post("/discrete-coil/<addr>/<data>")]
pub fn discrete_coil_write(addr: u16, data: bool, state: &State<AppState>) -> Result<(), Status> {
    state.limits.validate_address(addr)?;
    let values = [data];
    let mut store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    store
        .discrete_coil_write(addr, &values)
        .map_err(|_| Status::InternalServerError)?;
    Ok(())
}

/// Write Single Discrete input
#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Writing is Success")
    )
    ,
    params(
    ("addr", description = "Discrete input addres"),
    ("data", description = "Writing data"),
),
)]
#[post("/discrete-input/<addr>/<data>")]
pub async fn discrete_input_write(
    addr: u16,
    data: bool,
    state: &State<AppState>,
) -> Result<(), Status> {
    state.limits.validate_address(addr)?;
    let values = [data];
    let mut store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    store
        .discrete_input_write(addr, &values)
        .map_err(|_| Status::InternalServerError)?;

    Ok(())
}

/// Multiple  writings
/// Write Holding Registers
#[utoipa::path(
    context_path = "/api/v1",
    request_body = RequestRegister,
    responses(
        (status = 200, description = "Writing is Success")
    )
    ,
    params(
    ("addr", description = "Holding Registers Start Addres"),

),
)]
#[post("/holding-registers/<addr>", data = "<values>")]
pub async fn holding_registers_write(
    addr: u16,
    values: Data<'_>,
    state: &State<AppState>,
) -> Result<(), Status> {
    let payload = values.open(ByteUnit::MB).into_string().await.unwrap();
    let payload_str = payload.as_str();
    let values: RequestRegister = serde_json::from_str(payload_str).unwrap();
    state.limits.validate_write_span(addr, values.data.len())?;
    let mut store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    store
        .holding_registers_write(addr, &values.data)
        .map_err(|_| Status::InternalServerError)?;
    Ok(())
}

/// Write Input Registers
#[utoipa::path(
    context_path = "/api/v1",
    request_body = RequestRegister,
    responses(
        (status = 200, description = "Writing is Success")
    )
    ,
    params(
    ("addr", description = "Input Registers Start Addres"),

),
)]
#[post("/input-registers/<addr>", data = "<values>")]
pub async fn input_registers_write(
    addr: u16,
    values: Data<'_>,
    state: &State<AppState>,
) -> Result<(), Status> {
    let payload = values.open(ByteUnit::MB).into_string().await.unwrap();
    let payload_str = payload.as_str();
    let values: RequestRegister = serde_json::from_str(payload_str).unwrap();
    state.limits.validate_write_span(addr, values.data.len())?;
    let mut store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    store
        .input_registers_write(addr, &values.data)
        .map_err(|_| Status::InternalServerError)?;
    Ok(())
}

/// Write Discrete Coils
#[utoipa::path(
    context_path = "/api/v1",
    request_body = RequestCoil,
    responses(
        (status = 200, description = "Writing is Success")
    )
    ,
    params(
    ("addr", description = "Discrete Coils Start Addres"),

),
)]
#[post("/discrete-coils/<addr>", data = "<values>")]
pub async fn discrete_coils_write(
    addr: u16,
    values: Data<'_>,
    state: &State<AppState>,
) -> Result<(), Status> {
    let payload = values.open(ByteUnit::MB).into_string().await.unwrap();
    let payload_str = payload.as_str();
    let values: RequestCoil = serde_json::from_str(payload_str).unwrap();
    state.limits.validate_write_span(addr, values.data.len())?;
    let mut store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    store
        .discrete_coil_write(addr, &values.data)
        .map_err(|_| Status::InternalServerError)?;
    Ok(())
}

/// Write Discrete Inputs
#[utoipa::path(
    context_path = "/api/v1",
    request_body = RequestCoil,
    responses(
        (status = 200, description = "Writing is Success")
    )
    ,
    params(
    ("addr", description = "Discrete Inputs Start Addres"),

),
)]
#[post("/discrete-inputs/<addr>", data = "<values>")]
pub async fn discrete_inputs_write(
    addr: u16,
    values: Data<'_>,
    state: &State<AppState>,
) -> Result<(), Status> {
    let payload = values.open(ByteUnit::MB).into_string().await.unwrap();
    let payload_str = payload.as_str();
    let values: RequestCoil = serde_json::from_str(payload_str).unwrap();
    state.limits.validate_write_span(addr, values.data.len())?;
    let mut store = state
        .store
        .lock()
        .map_err(|_| Status::InternalServerError)?;
    store
        .discrete_input_write(addr, &values.data)
        .map_err(|_| Status::InternalServerError)?;
    Ok(())
}

pub struct Api {
    pub list: Vec<Route>,
}

impl Api {
    pub fn new() -> Self {
        let list = routes![
            ui_config,
            holding_registers_read,
            input_registers_read,
            discrete_coils_read,
            discrete_input_read,
            holding_register_write,
            input_register_write,
            discrete_coil_write,
            discrete_input_write,
            holding_registers_write,
            input_registers_write,
            discrete_coils_write,
            discrete_inputs_write
        ];
        Self { list }
    }
}
