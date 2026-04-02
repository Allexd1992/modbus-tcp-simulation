pub trait IRegistry {
    fn holding_registers_read(&self, addr: u16, cnt: u16) -> Result<Vec<u16>, std::io::Error>;
    fn input_registers_read(&self, addr: u16, cnt: u16) -> Result<Vec<u16>, std::io::Error>;
    fn discrete_coils_read(&self, addr: u16, cnt: u16) -> Result<Vec<bool>, std::io::Error>;
    fn discrete_input_read(&self, addr: u16, cnt: u16) -> Result<Vec<bool>, std::io::Error>;
    fn holding_registers_write(&mut self, addr: u16, values: &[u16]) -> Result<(), std::io::Error>;
    fn input_registers_write(&mut self, addr: u16, values: &[u16]) -> Result<(), std::io::Error>;
    fn discrete_coil_write(&mut self, addr: u16, values: &[bool]) -> Result<(), std::io::Error>;
    fn discrete_input_write(&mut self, addr: u16, values: &[bool]) -> Result<(), std::io::Error>;
}
