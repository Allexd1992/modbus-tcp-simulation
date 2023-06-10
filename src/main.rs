use std::{
    net::SocketAddr,
    sync::{Arc, Mutex},
};
mod service;
use rocket::routes;
use service::modbus::store;
use tokio::net::TcpListener;
use tokio_modbus::server::tcp::{accept_tcp_connection, Server};
use service::http::{routes as api,state};
use service::modbus::modbus_service::ModbusService;

use crate::service::{modbus::{interfaces::IRegistry, store::Store}, http::state::AppState};

#[tokio::main]

async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let registry = Arc::new(Mutex::new(Store::new()));
    let socket_addr = "0.0.0.0:5502".parse().unwrap();

    tokio::select! {
        _ = server_context(socket_addr,Arc::clone(&registry)) => unreachable!(),
        _ = rocket::build()
        .manage(AppState::new(Arc::clone(&registry)))
        .mount("/v1", routes![
           // api::holding_registers_read,
          //  api::input_registers_read,
          //  api::discrete_coils_read,
          //  api::discrete_input_read,
          //  api::holding_registers_write,
         //  api::input_registers_write,
         //  api::discrete_coils_write,
            api::discrete_input_write,
        ])
        .launch()=>{},
        
    }

    Ok(())
}

async fn server_context(socket_addr: SocketAddr, registry:Arc<Mutex<Store>>) -> anyhow::Result<()> {
    println!("Starting up server on {socket_addr}");
    let listener = TcpListener::bind(socket_addr).await?;
    let server = Server::new(listener);
    let new_service =
        |_socket_addr: SocketAddr| Ok(Some(ModbusService::new(Arc::clone(&registry))));
    let on_connected = |stream, socket_addr| async move {
        accept_tcp_connection(stream, socket_addr, new_service)
    };
    let on_process_error = |err| {
        eprintln!("{err}");
    };
    server.serve(&on_connected, on_process_error).await?;
    Ok(())
}
