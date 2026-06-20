use crate::service::http::api;
use crate::service::http::sim_bundle;
use crate::service::http::sim_scripts;
use crate::service::http::var_map;
use utoipa::OpenApi;

use super::types::{RequestCoil, RequestRegister};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Modbus TCP Server Simulation",
        version = "2.2.0",
        description = "REST API for Modbus TCP simulator (registers, scripts, address map)"
    ),
    paths(
        api::ui_config,
        api::holding_registers_read,
        api::input_registers_read,
        api::discrete_coils_read,
        api::discrete_input_read,

        api::holding_register_write,
        api::input_register_write,
        api::discrete_coil_write,
        api::discrete_input_write,

        api::holding_registers_write,
        api::input_registers_write,
        api::discrete_coils_write,
        api::discrete_inputs_write,
        sim_scripts::sim_scripts_list,
        sim_scripts::sim_scripts_get,
        sim_scripts::sim_scripts_download,
        sim_scripts::sim_scripts_put,
        sim_scripts::sim_scripts_create,
        sim_scripts::sim_scripts_delete,
        sim_scripts::sim_scripts_reload,
        sim_scripts::sim_scripts_export,
        sim_scripts::sim_scripts_export_zip,
        sim_scripts::sim_scripts_import,
        sim_scripts::sim_scripts_import_zip,
        var_map::var_map_get,
        var_map::var_map_put,
        var_map::var_map_export_file,
        sim_bundle::var_map_export,
        sim_bundle::var_map_import,
        sim_bundle::simulation_export,
        sim_bundle::simulation_export_zip,
        sim_bundle::simulation_import,
        sim_bundle::simulation_import_zip,
    ),
    components(
        schemas(
            RequestCoil,
            RequestRegister,
            api::UiConfig,
            sim_scripts::ScriptContent,
            sim_scripts::ScriptSaveBody,
            sim_scripts::ScriptCreateBody,
            sim_scripts::SimScriptsList,
            sim_scripts::SimReloadResponse,
            sim_scripts::ScriptImportResponse,
            sim_scripts::ScriptImportBody,
            crate::service::sim::ScriptExportBundle,
            crate::service::sim::ScriptExportEntry,
            crate::service::sim::ScriptMeta,
            crate::service::var_map::VarMapBundle,
            crate::service::var_map::VarMapEntry,
            var_map::VarMapSaveResponse,
            sim_bundle::VarMapImportBody,
            sim_bundle::VarMapImportResponse,
            sim_bundle::SimulationExportBundle,
            sim_bundle::SimulationImportBody,
            sim_bundle::SimulationImportResponse,
        )
    ),
    tags(
        (name = "Modbus TCP Server Data Control", description = "Commands control list")
    )
)]
pub struct ApiDoc;
