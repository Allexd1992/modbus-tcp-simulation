use std::io;

use rocket::http::{ContentType, Status};
use rocket::serde::json::Json;
use rocket::serde::Serialize;
use rocket::{get, put, State};
use utoipa::ToSchema;

use crate::service::http::download::{map_io_err as map_download_err, Attachment};
use crate::service::http::state::AppState;
use crate::service::var_map::{self, VarMapBundle};

#[derive(Serialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct VarMapSaveResponse {
    pub ok: bool,
    pub count: usize,
}

fn map_io_err(e: io::Error) -> Status {
    match e.kind() {
        io::ErrorKind::InvalidInput | io::ErrorKind::InvalidData => Status::BadRequest,
        _ => Status::InternalServerError,
    }
}

#[utoipa::path(
    context_path = "/api/v1",
    responses((status = 200, description = "Variable map", body = VarMapBundle))
)]
#[get("/var-map")]
pub fn var_map_get(state: &State<AppState>) -> Result<Json<VarMapBundle>, Status> {
    var_map::load(&state.var_map_path)
        .map(Json)
        .map_err(map_io_err)
}

#[utoipa::path(
    context_path = "/api/v1",
    request_body = VarMapBundle,
    responses((status = 200, description = "Saved", body = VarMapSaveResponse))
)]
#[put("/var-map", data = "<body>")]
pub fn var_map_put(
    body: Json<VarMapBundle>,
    state: &State<AppState>,
) -> Result<Json<VarMapSaveResponse>, Status> {
    let normalized = var_map::normalize_bundle(&body).map_err(map_io_err)?;
    var_map::save(&state.var_map_path, &normalized).map_err(map_io_err)?;
    if let Some(engine) = state.sim_scripts.engine.as_ref() {
        engine
            .reload_var_map()
            .map_err(|_| Status::InternalServerError)?;
    }
    Ok(Json(VarMapSaveResponse {
        ok: true,
        count: normalized.variables.len(),
    }))
}

#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Address map JSON file", content_type = "application/json"),
        (status = 500, description = "Server error")
    )
)]
#[get("/var-map/export-file")]
pub fn var_map_export_file(state: &State<AppState>) -> Result<Attachment, Status> {
    let bundle = var_map::load(&state.var_map_path).map_err(map_download_err)?;
    let data = serde_json::to_vec_pretty(&bundle)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))
        .map_err(map_download_err)?;
    Ok(Attachment {
        content_type: ContentType::JSON,
        filename: "modbus-var-map.json".to_string(),
        data,
    })
}
