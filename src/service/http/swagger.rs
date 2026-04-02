use crate::service::http::api;
use utoipa::OpenApi;

use super::types::{RequestCoil, RequestRegister};

#[derive(OpenApi)]
#[openapi(
    paths(
        api::holding_registers_read,
        api::input_registers_read,
        api::discrete_coils_read,
        api::discrete_input_read,

        api::holding_register_write,
        api::input_register_write,
        api::discrete_coil_write,
        api::discrete_input_write,

        api::holding_registers_write,
        api::input_registers_write,
        api::discrete_coils_write,
        api::discrete_inputs_write,
    ),
    components(
        schemas(RequestCoil,RequestRegister)
    ),
    tags(
        (name = "Modbus TCP Server Data Control", description = "Commands control list")
    )
)]
pub struct ApiDoc;
