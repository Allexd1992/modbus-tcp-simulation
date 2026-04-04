use rocket::http::Status;
use std::env;

/// Ограничения HTTP API Modbus (читаются из окружения при старте).
#[derive(Clone, Copy, Debug)]
pub struct HttpLimits {
    /// Максимальный адрес протокола (включительно), по умолчанию 65535.
    pub max_modbus_address: u16,
    /// Максимум точек (слов/битов) в одном чтении или записи, по умолчанию 65535.
    pub max_read_count: u16,
}

fn parse_env_u16(key: &str, default: u16) -> u16 {
    env::var(key)
        .ok()
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(default)
}

impl HttpLimits {
    pub fn from_env() -> Self {
        let max_modbus_address = parse_env_u16("MB_MAX_ADDRESS", 65535);
        let mut max_read_count = parse_env_u16("MB_MAX_READ_COUNT", 65535);
        if max_read_count < 1 {
            max_read_count = 1;
        }
        Self {
            max_modbus_address,
            max_read_count,
        }
    }

    pub fn validate_read_range(&self, addr: u16, cnt: u16) -> Result<(), Status> {
        if cnt == 0 {
            return Err(Status::BadRequest);
        }
        if cnt > self.max_read_count {
            return Err(Status::BadRequest);
        }
        let end = (addr as u32)
            .saturating_add(u32::from(cnt))
            .saturating_sub(1);
        if end > u32::from(self.max_modbus_address) {
            return Err(Status::BadRequest);
        }
        Ok(())
    }

    pub fn validate_address(&self, addr: u16) -> Result<(), Status> {
        if addr > self.max_modbus_address {
            return Err(Status::BadRequest);
        }
        Ok(())
    }

    pub fn validate_write_span(&self, addr: u16, len: usize) -> Result<(), Status> {
        if len == 0 {
            return Err(Status::BadRequest);
        }
        if len > usize::from(self.max_read_count) {
            return Err(Status::BadRequest);
        }
        let end = (addr as u32).saturating_add(len as u32).saturating_sub(1);
        if end > u32::from(self.max_modbus_address) {
            return Err(Status::BadRequest);
        }
        Ok(())
    }
}
