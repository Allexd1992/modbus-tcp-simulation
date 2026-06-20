use std::io;
use std::path::Path;

use rmcp::ErrorData;

use crate::service::http::sim_scripts::ScriptContent;
use crate::service::sim::{self, ScriptExportBundle, ScriptExportEntry, ScriptEngineHandle};
use crate::service::var_map::{self, VarMapBundle};

pub fn map_io_err(e: io::Error) -> ErrorData {
    match e.kind() {
        io::ErrorKind::NotFound => ErrorData::resource_not_found(e.to_string(), None),
        io::ErrorKind::InvalidInput | io::ErrorKind::InvalidData => {
            ErrorData::invalid_params(e.to_string(), None)
        }
        _ => ErrorData::internal_error(e.to_string(), None),
    }
}

pub fn reload_script_engine(engine: &Option<ScriptEngineHandle>) -> Result<(), ErrorData> {
    if let Some(handle) = engine {
        handle
            .reload()
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
    }
    Ok(())
}

pub fn reload_var_map_engine(engine: &Option<ScriptEngineHandle>) -> Result<(), ErrorData> {
    if let Some(handle) = engine {
        handle
            .reload_var_map()
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
    }
    Ok(())
}

pub fn export_simulation_bundle(
    scripts_dir: &Path,
    var_map_path: &Path,
    sim_enabled: bool,
) -> Result<serde_json::Value, ErrorData> {
    let scripts = if sim_enabled {
        sim::export_scripts(scripts_dir).map_err(map_io_err)?
    } else {
        ScriptExportBundle {
            version: 1,
            scripts: vec![],
        }
    };
    let var_map = var_map::load(var_map_path).map_err(map_io_err)?;
    serde_json::to_value(serde_json::json!({
        "version": 1,
        "scripts": scripts.scripts,
        "varMap": var_map,
    }))
    .map_err(|e| ErrorData::internal_error(e.to_string(), None))
}

pub fn import_simulation_bundle(
    scripts_dir: &Path,
    var_map_path: &Path,
    sim_enabled: bool,
    engine: &Option<ScriptEngineHandle>,
    version: u32,
    scripts: Option<Vec<ScriptContent>>,
    var_map: Option<VarMapBundle>,
    top_level_variables: Option<Vec<crate::service::var_map::VarMapEntry>>,
    mode: &str,
) -> Result<serde_json::Value, ErrorData> {
    if version != 1 {
        return Err(ErrorData::invalid_params("unsupported bundle version", None));
    }
    let replace = mode.eq_ignore_ascii_case("replace");
    let mut scripts_imported = 0usize;
    let mut var_map_imported = 0usize;

    if let Some(entries) = scripts {
        if !entries.is_empty() {
            if !sim_enabled {
                return Err(ErrorData::internal_error(
                    "simulation scripts disabled",
                    None,
                ));
            }
            let bundle = ScriptExportBundle {
                version: 1,
                scripts: entries
                    .into_iter()
                    .map(|s| ScriptExportEntry {
                        name: s.name,
                        content: s.content,
                    })
                    .collect(),
            };
            scripts_imported =
                sim::import_scripts(scripts_dir, &bundle, replace).map_err(map_io_err)?;
        }
    }

    let var_map_body = if let Some(vm) = var_map {
        Some(vm)
    } else if let Some(vars) = top_level_variables {
        Some(VarMapBundle {
            version: 1,
            variables: vars,
        })
    } else {
        None
    };

    if let Some(bundle) = var_map_body {
        if !bundle.variables.is_empty() {
            var_map_imported =
                var_map::import_bundle(var_map_path, &bundle, replace).map_err(map_io_err)?;
        }
    }

    if scripts_imported == 0 && var_map_imported == 0 {
        return Err(ErrorData::invalid_params(
            "bundle must include scripts and/or varMap/variables",
            None,
        ));
    }

    if scripts_imported > 0 {
        reload_script_engine(engine)?;
    }
    if var_map_imported > 0 {
        reload_var_map_engine(engine)?;
    }

    serde_json::to_value(serde_json::json!({
        "scripts_imported": scripts_imported,
        "var_map_imported": var_map_imported,
        "reloaded": scripts_imported > 0 || var_map_imported > 0,
    }))
    .map_err(|e| ErrorData::internal_error(e.to_string(), None))
}
