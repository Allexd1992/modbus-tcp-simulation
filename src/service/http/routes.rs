
use rocket::data::ByteUnit;
use rocket::{State, post, get};
use rocket::http::Status;
use rocket::Data;

use crate::service::http::types::{RequestRegister, RequestCoil};
use crate::service::modbus::interfaces::IRegistry;
use crate::state::AppState;

#[get("/holding-registers/<addr>/<cnt>")]
pub fn holding_registers_read(addr: u16, cnt: u16, state: &State<AppState>) -> Result<String, Status> {
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    let data = store.holding_registers_read(addr, cnt).unwrap();
    Ok(serde_json::to_string_pretty(&data).unwrap())
}

#[get("/input-registers/<addr>/<cnt>")]
pub fn input_registers_read(addr: u16, cnt: u16, state: &State<AppState>) -> Result<String, Status> {
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    let data = store.input_registers_read(addr, cnt).unwrap();
    Ok(serde_json::to_string_pretty(&data).unwrap())
}

#[get("/discrete-coils/<addr>/<cnt>")]
pub fn discrete_coils_read(addr: u16, cnt: u16, state: &State<AppState>) -> Result<String, Status> {
    // Ваш код чтения discrete coils
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    let data = store.discrete_coils_read(addr, cnt).unwrap();
    Ok(serde_json::to_string_pretty(&data).unwrap())
}

#[get("/discrete-input/<addr>/<cnt>")]
pub fn discrete_input_read(addr: u16, cnt: u16, state: &State<AppState>) -> Result<String, Status> {
    // Ваш код чтения discrete input
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    let data = store.discrete_input_read(addr, cnt).unwrap();
    Ok(serde_json::to_string_pretty(&data).unwrap())
}

// single writing 

#[post("/holding-register/<addr>/<data>")]
pub fn holding_register_write(addr: u16, data:u16, state: &State<AppState>) -> Result<(), Status> {
    let values = [data];
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    store.holding_registers_write(addr, &values).map_err(|_| Status::InternalServerError)?;

    Ok(())
}

#[post("/input-register/<addr>/<data>")]
pub fn input_register_write(addr: u16, data: u16, state: &State<AppState>) -> Result<(), Status> {
    // Ваш код записи input registers
    let values = [data];
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    store.input_registers_write(addr, &values).map_err(|_| Status::InternalServerError)?;
    Ok(())
}

#[post("/discrete-coil/<addr>/<data>")]
pub fn discrete_coil_write(addr: u16, data: bool, state: &State<AppState>) -> Result<(), Status> {
    let values = [data];
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    store.discrete_coil_write(addr, &values).map_err(|_| Status::InternalServerError)?;
    Ok(())
}

#[post("/discrete-input/<addr>/<data>")]
pub async  fn discrete_input_write(addr: u16, data: bool, state: &State<AppState>) -> Result<(), Status> {
    // Получение значения из тела запроса
   // let payload = values.open(ByteUnit::default()).into_string().await.unwrap().as_str();


    let values = [data];
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    store.discrete_input_write(addr, &values).map_err(|_| Status::InternalServerError)?;

    Ok(())
}



// multiple  writing 

#[post("/holding-registers/<addr>", data = "<values>")]
pub async fn holding_registers_write(addr: u16, values: Data<'_>, state: &State<AppState>) -> Result<(), Status> {
    let payload = values.open(ByteUnit::MB).into_string().await.unwrap();
    let payload_str = payload.as_str();
    let values: RequestRegister = serde_json::from_str(payload_str).unwrap();
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    store.holding_registers_write(addr, &values.data).map_err(|_| Status::InternalServerError)?;
    println!("{:?}", values);
    Ok(())
}

#[post("/input-registers/<addr>", data = "<values>")]
pub async fn input_registers_write(addr: u16, values: Data<'_>, state: &State<AppState>) -> Result<(), Status> {
    let payload = values.open(ByteUnit::MB).into_string().await.unwrap();
    let payload_str = payload.as_str();
    let values: RequestRegister = serde_json::from_str(payload_str).unwrap();
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    store.holding_registers_write(addr, &values.data).map_err(|_| Status::InternalServerError)?;
    println!("{:?}", values);
    Ok(())
}

#[post("/discrete-coils/<addr>", data = "<values>")]
pub async fn discrete_coils_write(addr: u16, values: Data<'_>, state: &State<AppState>) -> Result<(), Status> {
    let payload = values.open(ByteUnit::MB).into_string().await.unwrap();
    let payload_str = payload.as_str();
    let values: RequestCoil = serde_json::from_str(payload_str).unwrap();
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    store.discrete_coil_write(addr, &values.data).map_err(|_| Status::InternalServerError)?;
    println!("{:?}", values);
    Ok(())
}

#[post("/discrete-inputs/<addr>", data = "<values>")]
pub async fn discrete_inputs_write(addr: u16, values: Data<'_>, state: &State<AppState>) -> Result<(), Status> {
    let payload = values.open(ByteUnit::MB).into_string().await.unwrap();
    let payload_str = payload.as_str();
    let values: RequestCoil = serde_json::from_str(payload_str).unwrap();
    let mut store = state.store.lock().map_err(|_| Status::InternalServerError)?;
    store.discrete_input_write(addr, &values.data).map_err(|_| Status::InternalServerError)?;
    println!("{:?}", values);
    Ok(())
}
