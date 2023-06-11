use std::{sync::{Arc, Mutex}};
use std::env;
mod service;
use rocket::{ Config};
use service::http::state;
use crate::service::{modbus::{builder::server_build, store::Store}, http::{ context::get_rocket, api::Api}};


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
        _ = get_rocket(rocket_config,Arc::clone(&registry),Api::new()).launch()=>{},
    }

    Ok(())
}






