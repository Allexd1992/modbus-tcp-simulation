use super::api::Api;
use crate::service::{
    http::{limits::HttpLimits, state::AppState, swagger::ApiDoc},
    modbus::store::Store,
};
use rocket::fs::{relative, FileServer};
use rocket::{Build, Config, Rocket};
use std::sync::{Arc, Mutex};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

pub fn get_rocket(
    config: Config,
    registry: Arc<Mutex<Store>>,
    api: Api,
    limits: HttpLimits,
) -> Rocket<Build> {
    rocket::custom(config)
        .manage(AppState::new(Arc::clone(&registry), limits))
        .mount(
            "/",
            SwaggerUi::new("/api/v1/swagger/<_..>")
                .url("/api-docs/openapi.json", ApiDoc::openapi()),
        )
        .mount("/ui", FileServer::from(relative!("static")))
        .mount("/api/v1", api.list)
}
