use std::io;

use rocket::data::{Data, ToByteUnit};
use rocket::http::{ContentType, Status};
use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket::{delete, get, post, put, State};
use utoipa::ToSchema;

use crate::service::http::download::{map_io_err as map_download_err, Attachment};
use crate::service::http::state::AppState;
use crate::service::sim::{self, ScriptExportBundle, ScriptMeta};

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct ScriptContent {
    pub name: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct ScriptSaveBody {
    pub content: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct ScriptCreateBody {
    pub name: String,
    pub content: String,
}

#[derive(Serialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct SimScriptsList {
    pub enabled: bool,
    pub scripts: Vec<ScriptMeta>,
}

#[derive(Serialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct SimReloadResponse {
    pub ok: bool,
}

#[derive(Serialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct ScriptImportResponse {
    pub imported: usize,
    pub reloaded: bool,
}

#[derive(Deserialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct ScriptImportBody {
    pub version: u32,
    pub scripts: Vec<ScriptContent>,
    /// `merge` (default) or `replace`
    #[serde(default = "default_import_mode")]
    pub mode: String,
}

fn default_import_mode() -> String {
    "merge".to_string()
}

fn map_io_err(e: io::Error) -> Status {
    match e.kind() {
        io::ErrorKind::NotFound => Status::NotFound,
        io::ErrorKind::InvalidInput | io::ErrorKind::InvalidData => Status::BadRequest,
        _ => Status::InternalServerError,
    }
}

#[utoipa::path(
    context_path = "/api/v1",
    responses((status = 200, description = "Script list", body = SimScriptsList))
)]
#[get("/sim-scripts")]
pub fn sim_scripts_list(state: &State<AppState>) -> Json<SimScriptsList> {
    let sim = &state.sim_scripts;
    let scripts = if sim.enabled {
        sim::list_scripts(&sim.dir).unwrap_or_default()
    } else {
        Vec::new()
    };
    Json(SimScriptsList {
        enabled: sim.enabled,
        scripts,
    })
}

#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Script content", body = ScriptContent),
        (status = 404, description = "Not found")
    )
)]
#[get("/sim-scripts/<name>")]
pub fn sim_scripts_get(name: &str, state: &State<AppState>) -> Result<Json<ScriptContent>, Status> {
    if !state.sim_scripts.enabled {
        return Err(Status::ServiceUnavailable);
    }
    let content = sim::read_script(&state.sim_scripts.dir, name).map_err(map_io_err)?;
    Ok(Json(ScriptContent {
        name: name.to_string(),
        content,
    }))
}

#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Script file download", content_type = "application/javascript"),
        (status = 404, description = "Not found")
    )
)]
#[get("/sim-scripts/<name>/download")]
pub fn sim_scripts_download(name: &str, state: &State<AppState>) -> Result<Attachment, Status> {
    if !state.sim_scripts.enabled {
        return Err(Status::ServiceUnavailable);
    }
    let content = sim::read_script(&state.sim_scripts.dir, name).map_err(map_download_err)?;
    let filename = if name.ends_with(".js") {
        name.to_string()
    } else {
        format!("{name}.js")
    };
    Ok(Attachment {
        content_type: ContentType::new("application", "javascript"),
        filename,
        data: content.into_bytes(),
    })
}

#[utoipa::path(
    context_path = "/api/v1",
    request_body = ScriptSaveBody,
    responses(
        (status = 200, description = "Saved"),
        (status = 400, description = "Bad request")
    )
)]
#[put("/sim-scripts/<name>", data = "<body>")]
pub fn sim_scripts_put(
    name: &str,
    body: Json<ScriptSaveBody>,
    state: &State<AppState>,
) -> Result<(), Status> {
    if !state.sim_scripts.enabled {
        return Err(Status::ServiceUnavailable);
    }
    sim::write_script(&state.sim_scripts.dir, name, &body.content).map_err(map_io_err)?;
    Ok(())
}

#[utoipa::path(
    context_path = "/api/v1",
    request_body = ScriptCreateBody,
    responses(
        (status = 200, description = "Created"),
        (status = 400, description = "Bad request")
    )
)]
#[post("/sim-scripts", data = "<body>")]
pub fn sim_scripts_create(
    body: Json<ScriptCreateBody>,
    state: &State<AppState>,
) -> Result<(), Status> {
    if !state.sim_scripts.enabled {
        return Err(Status::ServiceUnavailable);
    }
    let path = state.sim_scripts.dir.join(&body.name);
    if path.exists() {
        return Err(Status::Conflict);
    }
    sim::write_script(&state.sim_scripts.dir, &body.name, &body.content).map_err(map_io_err)?;
    Ok(())
}

#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Deleted"),
        (status = 404, description = "Not found")
    )
)]
#[delete("/sim-scripts/<name>")]
pub fn sim_scripts_delete(name: &str, state: &State<AppState>) -> Result<(), Status> {
    if !state.sim_scripts.enabled {
        return Err(Status::ServiceUnavailable);
    }
    sim::delete_script(&state.sim_scripts.dir, name).map_err(map_io_err)?;
    Ok(())
}

#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Reloaded", body = SimReloadResponse),
        (status = 503, description = "Engine disabled")
    )
)]
#[post("/sim-scripts/reload")]
pub fn sim_scripts_reload(state: &State<AppState>) -> Result<Json<SimReloadResponse>, Status> {
    let engine = state
        .sim_scripts
        .engine
        .as_ref()
        .ok_or(Status::ServiceUnavailable)?;
    engine.reload().map_err(|_| Status::InternalServerError)?;
    Ok(Json(SimReloadResponse { ok: true }))
}

#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Export bundle", body = ScriptExportBundle),
        (status = 503, description = "Engine disabled")
    )
)]
#[get("/sim-scripts/export")]
pub fn sim_scripts_export(state: &State<AppState>) -> Result<Json<ScriptExportBundle>, Status> {
    if !state.sim_scripts.enabled {
        return Err(Status::ServiceUnavailable);
    }
    sim::export_scripts(&state.sim_scripts.dir)
        .map(Json)
        .map_err(map_io_err)
}

#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "ZIP archive of *.js scripts", content_type = "application/zip"),
        (status = 503, description = "Engine disabled")
    )
)]
#[get("/sim-scripts/export-zip")]
pub fn sim_scripts_export_zip(state: &State<AppState>) -> Result<Attachment, Status> {
    if !state.sim_scripts.enabled {
        return Err(Status::ServiceUnavailable);
    }
    let data = sim::export_scripts_zip(&state.sim_scripts.dir).map_err(map_download_err)?;
    Ok(Attachment {
        content_type: ContentType::new("application", "zip"),
        filename: "modbus-scripts.zip".to_string(),
        data,
    })
}

#[utoipa::path(
    context_path = "/api/v1",
    request_body(content = Vec<u8>, content_type = "application/zip"),
    responses(
        (status = 200, description = "Imported", body = ScriptImportResponse),
        (status = 400, description = "Bad request"),
        (status = 503, description = "Engine disabled")
    )
)]
#[post("/sim-scripts/import-zip?<mode>", data = "<data>")]
pub async fn sim_scripts_import_zip(
    mode: Option<String>,
    data: Data<'_>,
    state: &State<AppState>,
) -> Result<Json<ScriptImportResponse>, Status> {
    if !state.sim_scripts.enabled {
        return Err(Status::ServiceUnavailable);
    }
    let bytes = data
        .open(8.megabytes())
        .into_bytes()
        .await
        .map_err(|_| Status::PayloadTooLarge)?;
    if !bytes.is_complete() {
        return Err(Status::PayloadTooLarge);
    }
    let replace = mode
        .as_deref()
        .unwrap_or("merge")
        .eq_ignore_ascii_case("replace");
    let imported =
        sim::import_scripts_zip(&state.sim_scripts.dir, &bytes, replace).map_err(map_download_err)?;
    let engine = state
        .sim_scripts
        .engine
        .as_ref()
        .ok_or(Status::ServiceUnavailable)?;
    engine.reload().map_err(|_| Status::InternalServerError)?;
    Ok(Json(ScriptImportResponse {
        imported,
        reloaded: true,
    }))
}

#[utoipa::path(
    context_path = "/api/v1",
    request_body = ScriptImportBody,
    responses(
        (status = 200, description = "Imported", body = ScriptImportResponse),
        (status = 400, description = "Bad request"),
        (status = 503, description = "Engine disabled")
    )
)]
#[post("/sim-scripts/import", data = "<body>")]
pub fn sim_scripts_import(
    body: Json<ScriptImportBody>,
    state: &State<AppState>,
) -> Result<Json<ScriptImportResponse>, Status> {
    if !state.sim_scripts.enabled {
        return Err(Status::ServiceUnavailable);
    }
    let replace = body.mode.eq_ignore_ascii_case("replace");
    let bundle = ScriptExportBundle {
        version: body.version,
        scripts: body
            .scripts
            .iter()
            .map(|s| sim::ScriptExportEntry {
                name: s.name.clone(),
                content: s.content.clone(),
            })
            .collect(),
    };
    let imported = sim::import_scripts(&state.sim_scripts.dir, &bundle, replace).map_err(map_io_err)?;
    let engine = state
        .sim_scripts
        .engine
        .as_ref()
        .ok_or(Status::ServiceUnavailable)?;
    engine.reload().map_err(|_| Status::InternalServerError)?;
    Ok(Json(ScriptImportResponse {
        imported,
        reloaded: true,
    }))
}
