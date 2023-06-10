use std::sync::{Arc, Mutex};
use crate::service::modbus::store::Store;

pub struct AppState {
    pub store: Arc<Mutex<Store>>,
}

impl AppState {
    pub fn new(registry: Arc<Mutex<Store>>)-> Self {
        AppState {
            store: Arc::clone(&registry),
        }
    }
}
