use crate::service::http::limits::HttpLimits;
use crate::service::modbus::store::Store;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub store: Arc<Mutex<Store>>,
    pub limits: HttpLimits,
}

impl AppState {
    pub fn new(registry: Arc<Mutex<Store>>, limits: HttpLimits) -> Self {
        AppState {
            store: Arc::clone(&registry),
            limits,
        }
    }
}
