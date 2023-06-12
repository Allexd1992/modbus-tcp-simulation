use std::{sync::{Arc, Mutex}};
use rocket::{Config, Rocket, Build};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use crate::service::{modbus::{ store::Store}, http::{state::AppState, swagger::ApiDoc}};
use super::api::Api;



pub fn get_rocket(config:Config, registry:Arc<Mutex<Store>>,api:Api)->Rocket<Build>{

    rocket::custom(config)
    .manage(AppState::new(Arc::clone(&registry)))
    .mount(
        "/",
        SwaggerUi::new("/api/v1/swagger/<_..>").url("/api-docs/openapi.json", ApiDoc::openapi()),
    )
    .mount("/api/v1",api.list)
}





  
