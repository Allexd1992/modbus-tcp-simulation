use std::{
    sync::{Arc, Mutex},
};

use super::{store::Store, interfaces::IRegistry};
use futures::future;


use tokio_modbus::{
    prelude::*
};

pub struct ModbusService {
    registry:Arc<Mutex<Store>>
}

impl tokio_modbus::server::Service for ModbusService {
    type Request = Request;
    type Response = Response;
    type Error = std::io::Error;
    type Future = future::Ready<Result<Self::Response, Self::Error>>;

   fn call(&self, req: Self::Request) -> Self::Future {
        match req {
            Request::ReadInputRegisters(addr, cnt) => {
                match self.registry.lock().unwrap().input_registers_read(addr, cnt){
              //  match registers_read(&self.input_registers.lock().unwrap(), addr, cnt) {
                  Ok(values) => future::ready(Ok(Response::ReadInputRegisters(values))),
                  Err(err) => future::ready(Err(err)),
               }
            }
            Request::ReadHoldingRegisters(addr, cnt) => {
                match self.registry.lock().unwrap().holding_registers_read(addr, cnt){
              //  match registers_read(&self.holding_registers.lock().unwrap(), addr, cnt) {
                    Ok(values) => future::ready(Ok(Response::ReadHoldingRegisters(values))),
                    Err(err) => future::ready(Err(err)),
                }
            }
            Request::ReadCoils(addr, cnt) => {
                match self.registry.lock().unwrap().discrete_coils_read(addr, cnt){
              //  match coils_read(&self.coils.lock().unwrap(), addr, numb) {
                    Ok(values) => future::ready(Ok(Response::ReadCoils(values))),
                    Err(err) => future::ready(Err(err)),
                }
            }
            Request::ReadDiscreteInputs(addr, cnt) => {
                match self.registry.lock().unwrap().discrete_input_read(addr, cnt){
             //   match coils_read(&self.input_coils.lock().unwrap(), addr, numb) {
                    Ok(values) => future::ready(Ok(Response::ReadCoils(values))),
                    Err(err) => future::ready(Err(err)),
                }
            }

            Request::WriteMultipleRegisters(addr, values) => {
                match self.registry.lock().unwrap().holding_registers_write(addr, &values){
              //  match registers_write(&mut self.holding_registers.lock().unwrap(), addr, &values) {
                    Ok(_) => future::ready(Ok(Response::WriteMultipleRegisters(
                        addr,
                        values.len() as u16,
                    ))),
                    Err(err) => future::ready(Err(err)),
                }
            }
            Request::WriteSingleRegister(addr, value) => {
                match self.registry.lock().unwrap().holding_registers_write(addr,std::slice::from_ref(&value))
              /*  match registers_write(
                    &mut self.holding_registers.lock().unwrap(),
                    addr,
                    std::slice::from_ref(&value),
                ) */{
                    Ok(_) => future::ready(Ok(Response::WriteSingleRegister(addr, value))),
                    Err(err) => future::ready(Err(err)),
                }
            }
            Request::WriteMultipleCoils(addr, values) => {
                match self.registry.lock().unwrap().discrete_coil_write(addr,&values){
              //  match coils_write(&mut self.coils.lock().unwrap(), addr, &values) {
                    Ok(_) => {
                        future::ready(Ok(Response::WriteMultipleCoils(addr, values.len() as u16)))
                    }
                    Err(err) => future::ready(Err(err)),
                }
            }

            Request::WriteSingleCoil(addr, value) => {
                match self.registry.lock().unwrap().discrete_coil_write(addr,std::slice::from_ref(&value))
              /*   match coils_write(
                    &mut self.coils.lock().unwrap(),
                    addr,
                    std::slice::from_ref(&value),
                )*/ {
                    Ok(_) => future::ready(Ok(Response::WriteSingleCoil(addr, value))),
                    Err(err) => future::ready(Err(err)),
                }
            }
        
            _=> {println!("SERVER: Exception::IllegalFunction - Unimplemented function code in request: {req:?}");
            future::ready(Err(std::io::Error::new(
                std::io::ErrorKind::AddrNotAvailable,
                "Unimplemented function code in request".to_string(),
            )))}
        }
    }
}

impl ModbusService {
    pub fn new(registry:Arc<Mutex<Store>>) -> Self {   
        Self {
            registry:Arc::clone(&registry)
        }
    }
}