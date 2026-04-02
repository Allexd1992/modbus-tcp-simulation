use crate::service::modbus::store::Store;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub store: Arc<Mutex<Store>>,
}

impl AppState {
    pub fn new(registry: Arc<Mutex<Store>>) -> Self {
        AppState {
            store: Arc::clone(&registry),
        }
    }
}
