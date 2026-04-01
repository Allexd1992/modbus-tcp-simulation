use std::io::{self, ErrorKind};
use std::sync::{Arc, Mutex};

use futures::future;
use tokio_modbus::prelude::*;

use super::{interfaces::IRegistry, store::Store};

pub struct ModbusService {
    registry: Arc<Mutex<Store>>,
}

type ReadyResponse = future::Ready<Result<Response, io::Error>>;

impl ModbusService {
    pub fn new(registry: Arc<Mutex<Store>>) -> Self {
        Self {
            registry: Arc::clone(&registry),
        }
    }

    fn map_value<T>(result: Result<T, io::Error>, f: impl FnOnce(T) -> Response) -> ReadyResponse {
        match result {
            Ok(v) => future::ready(Ok(f(v))),
            Err(e) => future::ready(Err(e)),
        }
    }

    fn map_unit(result: Result<(), io::Error>, response: Response) -> ReadyResponse {
        match result {
            Ok(()) => future::ready(Ok(response)),
            Err(e) => future::ready(Err(e)),
        }
    }
}

impl tokio_modbus::server::Service for ModbusService {
    type Request = Request;
    type Response = Response;
    type Error = io::Error;
    type Future = ReadyResponse;

    fn call(&self, req: Self::Request) -> Self::Future {
        let mut reg = self.registry.lock().unwrap();

        match req {
            Request::ReadInputRegisters(addr, cnt) => {
                Self::map_value(reg.input_registers_read(addr, cnt), Response::ReadInputRegisters)
            }
            Request::ReadHoldingRegisters(addr, cnt) => {
                Self::map_value(reg.holding_registers_read(addr, cnt), Response::ReadHoldingRegisters)
            }
            Request::ReadCoils(addr, cnt) => {
                Self::map_value(reg.discrete_coils_read(addr, cnt), Response::ReadCoils)
            }
            Request::ReadDiscreteInputs(addr, cnt) => {
                Self::map_value(reg.discrete_input_read(addr, cnt), Response::ReadCoils)
            }
            Request::WriteMultipleRegisters(addr, ref values) => {
                let n = values.len() as u16;
                Self::map_unit(
                    reg.holding_registers_write(addr, values),
                    Response::WriteMultipleRegisters(addr, n),
                )
            }
            Request::WriteSingleRegister(addr, value) => Self::map_unit(
                reg.holding_registers_write(addr, std::slice::from_ref(&value)),
                Response::WriteSingleRegister(addr, value),
            ),
            Request::WriteMultipleCoils(addr, ref values) => {
                let n = values.len() as u16;
                Self::map_unit(
                    reg.discrete_coil_write(addr, values),
                    Response::WriteMultipleCoils(addr, n),
                )
            }
            Request::WriteSingleCoil(addr, value) => Self::map_unit(
                reg.discrete_coil_write(addr, std::slice::from_ref(&value)),
                Response::WriteSingleCoil(addr, value),
            ),
            _ => {
                eprintln!("SERVER: IllegalFunction — unimplemented request: {req:?}");
                future::ready(Err(io::Error::new(
                    ErrorKind::Unsupported,
                    "Unimplemented function code",
                )))
            }
        }
    }
}
