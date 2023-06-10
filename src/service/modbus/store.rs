use std::{sync::{Arc, Mutex}, collections::HashMap};

use super::interfaces::IRegistry;



pub struct Store {
    input_registers: Arc<Mutex<HashMap<u16, u16>>>,
    holding_registers: Arc<Mutex<HashMap<u16, u16>>>,
    discrete_coils: Arc<Mutex<HashMap<u16, bool>>>,
    discrete_input: Arc<Mutex<HashMap<u16, bool>>>,
}



impl Store {
    pub fn new() -> Self {
        let mut input_registers = HashMap::new();
        for i in 0..0xFFFF {
            input_registers.insert(i, 0);
        }
        let mut holding_registers = HashMap::new();
        for i in 0..0xFFFF {
            holding_registers.insert(i, 0);
        }
        let mut coils: HashMap<u16, bool> = HashMap::new();
        for i in 0..0xFFFF {
            coils.insert(i, false);
        }
        let mut discrete_input: HashMap<u16, bool> = HashMap::new();
        for i in 0..0xFFFF {
            discrete_input.insert(i, false);
        }
        Self {
            input_registers: Arc::new(Mutex::new(input_registers)),
            holding_registers: Arc::new(Mutex::new(holding_registers)),
            discrete_coils: Arc::new(Mutex::new(coils)),
            discrete_input: Arc::new(Mutex::new(discrete_input)),
        }
    }
}

impl IRegistry for Store{
fn holding_registers_read(&self, addr: u16, cnt: u16) -> Result<Vec<u16>, std::io::Error> {
    let response_values = registers_read(Arc::clone(&self.holding_registers), addr, cnt)?;
    Ok(response_values)
}

fn input_registers_read(&self, addr: u16, cnt: u16) -> Result<Vec<u16>, std::io::Error> {
    let response_values = registers_read(Arc::clone(&self.input_registers), addr, cnt)?;
    Ok(response_values)
}

fn discrete_coils_read(&self, addr: u16, cnt: u16) -> Result<Vec<bool>, std::io::Error> {
    let response_values = coils_read(Arc::clone(&self.discrete_coils), addr, cnt)?;
    Ok(response_values)
}

fn discrete_input_read(&self, addr: u16, cnt: u16) -> Result<Vec<bool>, std::io::Error> {
    let response_values = coils_read(Arc::clone(&self.discrete_input), addr, cnt)?;
    Ok(response_values)
}



fn holding_registers_write( &mut self, addr: u16, values: &[u16]) -> Result<(), std::io::Error> {
    registers_write(Arc::clone(&self.holding_registers), addr, values)?;
    Ok(())
}

fn input_registers_write( &mut self, addr: u16, values: &[u16]) -> Result<(), std::io::Error> {
    registers_write(Arc::clone(&self.input_registers), addr, values)?;
    Ok(())
}

fn discrete_coil_write(&mut self, addr: u16, values: &[bool]) -> Result<(), std::io::Error> {
   coils_write(Arc::clone(&self.discrete_coils), addr, values)?;
    Ok(())
}

fn discrete_input_write(&mut self, addr: u16, values: &[bool]) -> Result<(), std::io::Error> {
    coils_write(Arc::clone(&self.discrete_input), addr, values)?;
    Ok(())
}


}


/// Helper function implementing reading registers from a HashMap.
 fn registers_read(
    registers: Arc<Mutex<HashMap<u16, u16>>>,
    addr: u16,
    cnt: u16,
) -> Result<Vec<u16>, std::io::Error> {
    let mut response_values = vec![0; cnt.into()];
    for i in 0..cnt {
        let reg_addr = addr + i;
        if let Some(r) = registers.lock().unwrap().get(&reg_addr) {
            response_values[i as usize] = *r;
        } else {
            // TODO: Return a Modbus Exception response `IllegalDataAddress` https://github.com/slowtec/tokio-modbus/issues/165
            println!("SERVER: Exception::IllegalDataAddress");
            return Err(std::io::Error::new(
                std::io::ErrorKind::AddrNotAvailable,
                format!("no register at address {reg_addr}"),
            ));
        }
    }

    Ok(response_values)
}

fn coils_read(
    coils: Arc<Mutex<HashMap<u16, bool>>>,
    addr: u16,
    cnt: u16,
) -> Result<Vec<bool>, std::io::Error> {


    let mut response_values = vec![false; cnt.into()];
    for i in 0..cnt {
        let coil_addr = addr + i;
        if let Some(r) = coils.lock().unwrap().get(&coil_addr) {
            response_values[i as usize] = *r;
        } else {
            // TODO: Return a Modbus Exception response `IllegalDataAddress` https://github.com/slowtec/tokio-modbus/issues/165
            println!("SERVER: Exception::IllegalDataAddress");
            return Err(std::io::Error::new(
                std::io::ErrorKind::AddrNotAvailable,
                format!("no register at address {coil_addr}"),
            ));
        }
    }

    Ok(response_values)
}

/// Write a holding register. Used by both the write single register
/// and write multiple registers requests.
fn registers_write(
    registers: Arc<Mutex< HashMap<u16, u16>>>,
    addr: u16,
    values: &[u16],
) -> Result<(), std::io::Error> {
    for (i, value) in values.iter().enumerate() {
        let reg_addr = addr + i as u16;
        if let Some(r) = registers.lock().unwrap().get_mut(&reg_addr) {
            *r = *value;
        } else {
            // TODO: Return a Modbus Exception response `IllegalDataAddress` https://github.com/slowtec/tokio-modbus/issues/165
            println!("SERVER: Exception::IllegalDataAddress");
            return Err(std::io::Error::new(
                std::io::ErrorKind::AddrNotAvailable,
                format!("no register at address {reg_addr}"),
            ));
        }
    }

    Ok(())
}

 fn coils_write(
    coils: Arc<Mutex<HashMap<u16, bool>>>,
    addr: u16,
    values: &[bool],
) -> Result<(), std::io::Error> {
    for (i, value) in values.iter().enumerate() {
        let reg_addr = addr + i as u16;
        if let Some(r) = coils.lock().unwrap().get_mut(&reg_addr) {
            *r = *value;
        } else {
            // TODO: Return a Modbus Exception response `IllegalDataAddress` https://github.com/slowtec/tokio-modbus/issues/165
            println!("SERVER: Exception::IllegalDataAddress");
            return Err(std::io::Error::new(
                std::io::ErrorKind::AddrNotAvailable,
                format!("no register at address {reg_addr}"),
            ));
        }
    }

    Ok(())
}
