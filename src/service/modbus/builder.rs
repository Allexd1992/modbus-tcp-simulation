use std::{
    net::SocketAddr,
    sync::{Arc, Mutex},
};

use tokio::net::TcpListener;
use tokio_modbus::server::tcp::{accept_tcp_connection, Server};

use crate::service::modbus::modbus_service::ModbusService;

use super::store::Store;

pub async fn server_build(
    socket_addr: SocketAddr,
    registry: Arc<Mutex<Store>>,
) -> anyhow::Result<()> {
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
