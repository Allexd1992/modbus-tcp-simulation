use std::{sync::{Arc, Mutex}};
use std::env;
mod service;
use rocket::{routes, fs::NamedFile, get, catch, Config, Responder};
use serde::{Deserialize, Serialize};
use service::http::{routes as api,state, types::{RequestRegister, RequestCoil}};
use utoipa::{
    openapi::{security::{ApiKey, ApiKeyValue, SecurityScheme}, schema}, OpenApi};
use utoipa_swagger_ui::SwaggerUi;
use crate::service::{modbus::{builder::server_build, store::Store}, http::{state::AppState, types::ApiDoc}};


#[tokio::main]

async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let registry = Arc::new(Mutex::new(Store::new()));
    let port = env::var("MB_SERVER_PORT").unwrap_or_else(|_| "502".to_string()).parse::<u16>().unwrap();
    let addr = format!("0.0.0.0:{}", port);

    let web_port = env::var("WEB_SERVER_PORT").unwrap_or_else(|_| "8080".to_string()).parse::<u16>().unwrap();
    let rocket_config = Config {
        address: "0.0.0.0".parse()?,
        port: web_port,
        ..Default::default()
    };

    let socket_addr = addr.parse().unwrap();

    tokio::select! {
        _ = server_build(socket_addr,Arc::clone(&registry)) => unreachable!(),
        _ = rocket::custom(rocket_config)
        .manage(AppState::new(Arc::clone(&registry)))
        .mount(
            "/",
            SwaggerUi::new("/api/v1/swagger/<_..>").url("/api-docs/openapi.json", ApiDoc::openapi()),
        )
        .mount("/api/v1", routes![
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
        ])

  
        .launch()=>{},
        
    }

    Ok(())
}






