use std::io;

use rocket::data::{Data, ToByteUnit};
use rocket::http::{ContentType, Status};
use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket::{get, post, State};
use utoipa::ToSchema;

use crate::service::http::download::{map_io_err as map_download_err, Attachment};
use crate::service::http::sim_scripts::ScriptContent;
use crate::service::http::state::AppState;
use crate::service::sim::{self, ScriptExportBundle, ScriptExportEntry};
use crate::service::var_map::{self, VarMapBundle};

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct VarMapImportBody {
    pub version: u32,
    pub variables: Vec<crate::service::var_map::VarMapEntry>,
    /// `merge` (default) or `replace`
    #[serde(default = "default_import_mode")]
    pub mode: String,
}

fn default_import_mode() -> String {
    "merge".to_string()
}

#[derive(Serialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct VarMapImportResponse {
    pub imported: usize,
    pub reloaded: bool,
}

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct SimulationExportBundle {
    pub version: u32,
    pub scripts: Vec<ScriptExportEntry>,
    #[serde(rename = "varMap")]
    pub var_map: VarMapBundle,
}

#[derive(Deserialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct SimulationImportBody {
    pub version: u32,
    #[serde(default)]
    pub scripts: Option<Vec<ScriptContent>>,
    #[serde(rename = "varMap", default)]
    pub var_map: Option<VarMapBundle>,
    #[serde(default)]
    pub variables: Option<Vec<crate::service::var_map::VarMapEntry>>,
    #[serde(default = "default_import_mode")]
    pub mode: String,
}

#[derive(Serialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct SimulationImportResponse {
    pub scripts_imported: usize,
    pub var_map_imported: usize,
    pub reloaded: bool,
}

fn map_io_err(e: io::Error) -> Status {
    match e.kind() {
        io::ErrorKind::NotFound => Status::NotFound,
        io::ErrorKind::InvalidInput | io::ErrorKind::InvalidData => Status::BadRequest,
        _ => Status::InternalServerError,
    }
}

fn reload_sim_engine(state: &AppState) -> Result<(), Status> {
    if let Some(engine) = state.sim_scripts.engine.as_ref() {
        engine.reload().map_err(|_| Status::InternalServerError)?;
    }
    Ok(())
}

fn reload_var_map_engine(state: &AppState) -> Result<(), Status> {
    if let Some(engine) = state.sim_scripts.engine.as_ref() {
        engine
            .reload_var_map()
            .map_err(|_| Status::InternalServerError)?;
    }
    Ok(())
}

#[utoipa::path(
    context_path = "/api/v1",
    responses((status = 200, description = "Address map export", body = VarMapBundle))
)]
#[get("/var-map/export")]
pub fn var_map_export(state: &State<AppState>) -> Result<Json<VarMapBundle>, Status> {
    var_map::load(&state.var_map_path)
        .map(Json)
        .map_err(map_io_err)
}

#[utoipa::path(
    context_path = "/api/v1",
    request_body = VarMapImportBody,
    responses((status = 200, description = "Imported", body = VarMapImportResponse))
)]
#[post("/var-map/import", data = "<body>")]
pub fn var_map_import(
    body: Json<VarMapImportBody>,
    state: &State<AppState>,
) -> Result<Json<VarMapImportResponse>, Status> {
    let replace = body.mode.eq_ignore_ascii_case("replace");
    let bundle = VarMapBundle {
        version: body.version,
        variables: body.variables.clone(),
    };
    let imported =
        var_map::import_bundle(&state.var_map_path, &bundle, replace).map_err(map_io_err)?;
    reload_var_map_engine(state)?;
    Ok(Json(VarMapImportResponse {
        imported,
        reloaded: true,
    }))
}

#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "Simulation bundle", body = SimulationExportBundle),
        (status = 503, description = "Scripts disabled")
    )
)]
#[get("/simulation/export")]
pub fn simulation_export(state: &State<AppState>) -> Result<Json<SimulationExportBundle>, Status> {
    let scripts = if state.sim_scripts.enabled {
        sim::export_scripts(&state.sim_scripts.dir).map_err(map_io_err)?
    } else {
        ScriptExportBundle {
            version: 1,
            scripts: vec![],
        }
    };
    let var_map = var_map::load(&state.var_map_path).map_err(map_io_err)?;
    Ok(Json(SimulationExportBundle {
        version: 1,
        scripts: scripts.scripts,
        var_map,
    }))
}

#[utoipa::path(
    context_path = "/api/v1",
    responses(
        (status = 200, description = "ZIP: *.js scripts + var-map.json", content_type = "application/zip"),
        (status = 503, description = "Scripts disabled")
    )
)]
#[get("/simulation/export-zip")]
pub fn simulation_export_zip(state: &State<AppState>) -> Result<Attachment, Status> {
    let (data, _, _) = sim::export_simulation_zip(&state.sim_scripts.dir, &state.var_map_path)
        .map_err(map_download_err)?;
    Ok(Attachment {
        content_type: ContentType::new("application", "zip"),
        filename: "modbus-simulation.zip".to_string(),
        data,
    })
}

#[utoipa::path(
    context_path = "/api/v1",
    request_body(content = Vec<u8>, content_type = "application/zip"),
    responses((status = 200, description = "Imported", body = SimulationImportResponse))
)]
#[post("/simulation/import-zip?<mode>", data = "<data>")]
pub async fn simulation_import_zip(
    mode: Option<String>,
    data: Data<'_>,
    state: &State<AppState>,
) -> Result<Json<SimulationImportResponse>, Status> {
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
    let result = sim::import_simulation_zip(
        &state.sim_scripts.dir,
        &state.var_map_path,
        &bytes,
        replace,
        state.sim_scripts.enabled,
    )
    .map_err(map_download_err)?;

    if result.scripts_imported == 0 && result.var_map_imported == 0 {
        return Err(Status::BadRequest);
    }
    if result.scripts_imported > 0 {
        reload_sim_engine(state)?;
    }
    if result.var_map_imported > 0 {
        reload_var_map_engine(state)?;
    }

    Ok(Json(SimulationImportResponse {
        scripts_imported: result.scripts_imported,
        var_map_imported: result.var_map_imported,
        reloaded: result.scripts_imported > 0 || result.var_map_imported > 0,
    }))
}

#[utoipa::path(
    context_path = "/api/v1",
    request_body = SimulationImportBody,
    responses((status = 200, description = "Imported", body = SimulationImportResponse))
)]
#[post("/simulation/import", data = "<body>")]
pub fn simulation_import(
    body: Json<SimulationImportBody>,
    state: &State<AppState>,
) -> Result<Json<SimulationImportResponse>, Status> {
    if body.version != 1 {
        return Err(Status::BadRequest);
    }
    let replace = body.mode.eq_ignore_ascii_case("replace");
    let mut scripts_imported = 0usize;
    let mut var_map_imported = 0usize;

    if let Some(entries) = &body.scripts {
        if !entries.is_empty() {
            if !state.sim_scripts.enabled {
                return Err(Status::ServiceUnavailable);
            }
            let bundle = ScriptExportBundle {
                version: 1,
                scripts: entries
                    .iter()
                    .map(|s| ScriptExportEntry {
                        name: s.name.clone(),
                        content: s.content.clone(),
                    })
                    .collect(),
            };
            scripts_imported = sim::import_scripts(&state.sim_scripts.dir, &bundle, replace)
                .map_err(map_io_err)?;
        }
    }

    let var_map_body = body.var_map.clone().or_else(|| {
        body.variables.as_ref().map(|vars| VarMapBundle {
            version: 1,
            variables: vars.clone(),
        })
    });

    if let Some(bundle) = var_map_body {
        if !bundle.variables.is_empty() {
            var_map_imported = var_map::import_bundle(&state.var_map_path, &bundle, replace)
                .map_err(map_io_err)?;
        }
    }

    if scripts_imported == 0 && var_map_imported == 0 {
        return Err(Status::BadRequest);
    }

    if scripts_imported > 0 {
        reload_sim_engine(state)?;
    }
    if var_map_imported > 0 {
        reload_var_map_engine(state)?;
    }

    Ok(Json(SimulationImportResponse {
        scripts_imported,
        var_map_imported,
        reloaded: scripts_imported > 0 || var_map_imported > 0,
    }))
}
