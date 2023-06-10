use std::io::Read;

use futures::TryFutureExt;
use rocket::data::ByteUnit;
use rocket::{State, post, get, serde};
use rocket::http::Status;
use rocket::Data;
use crate::service::modbus::interfaces::IRegistry;
use crate::state::AppState;
/* 
#[get("/holding-registers/<addr>/<cnt>")]
pub fn holding_registers_read(addr: u16, cnt: u16, state: State<AppState>) -> Result<String, Status> {
    
    // Ваш код чтения holding registers
}

#[get("/input-registers/<addr>/<cnt>")]
pub fn input_registers_read(addr: u16, cnt: u16, state: State<AppState>) -> Result<String, Status> {
    // Ваш код чтения input registers
}

#[get("/discrete-coils/<addr>/<cnt>")]
pub fn discrete_coils_read(addr: u16, cnt: u16, state: State<AppState>) -> Result<String, Status> {
    // Ваш код чтения discrete coils
}

#[get("/discrete-input/<addr>/<cnt>")]
pub fn discrete_input_read(addr: u16, cnt: u16, state: State<AppState>) -> Result<String, Status> {
    // Ваш код чтения discrete input
}

#[post("/holding-registers/<addr>", data = "<values>")]
pub fn holding_registers_write(addr: u16, values: Data<'_>, state: State<AppState>) -> Result<(), Status> {
    // Ваш код записи holding registers

    Ok(())
}

#[post("/input-registers/<addr>", data = "<values>")]
pub fn input_registers_write(addr: u16, values: Data<'_>, state: State<AppState>) -> Result<(), Status> {
    // Ваш код записи input registers
    Ok(())
}

#[post("/discrete-coils/<addr>", data = "<values>")]
pub fn discrete_coils_write(addr: u16, values: Data<'_>, state: State<AppState>) -> Result<(), Status> {
    // Ваш код записи discrete coils
    Ok(())
}*/

#[post("/discrete-input/<addr>", data = "<values>")]
pub async  fn discrete_input_write(addr: u16, values: Data<'_>, state: &State<AppState>) -> Result<(), Status> {
    // Получение значения из тела запроса
    let payload = values.open(ByteUnit::default()).into_string().await.unwrap().as_str();

    /*;
        .open(ByteUnit::default()) // Указываем размер ограничения (можно указать другой размер)
        .into_bytes().await.map_err(|_| Status::InternalServerError)?;

    // Преобразование значения в булев массив
    let mut bits = Vec::new();
    for byte in value.bytes().into() {
        for i in 0..8 {
            bits.push((byte >> i) & 1 == 1);
        }
    }
*/
    // Запись булевого массива в хранилище
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    store.discrete_input_write(addr, &[true,false,true]).map_err(|_| Status::InternalServerError)?;

    Ok(())
}
