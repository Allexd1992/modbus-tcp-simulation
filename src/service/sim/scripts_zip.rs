use std::io::{self, Cursor, Read, Write};
use std::path::Path;

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use super::scripts_fs::{
    import_scripts, read_script, validate_name, ScriptExportBundle, ScriptExportEntry,
};
use crate::service::var_map::{self, VarMapBundle};

const MAX_ZIP_BYTES: usize = 8 * 1024 * 1024;

fn zip_entry_basename(name: &str) -> Option<String> {
    let normalized = name.replace('\\', "/");
    let trimmed = normalized.trim_start_matches("./");
    let basename = trimmed.rsplit('/').next()?;
    if basename.is_empty() || basename.ends_with('/') {
        return None;
    }
    Some(basename.to_string())
}

pub fn export_scripts_zip(dir: &Path) -> io::Result<Vec<u8>> {
    let metas = super::list_scripts(dir)?;
    let mut buf = Vec::new();
    {
        let mut zip = ZipWriter::new(Cursor::new(&mut buf));
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        for meta in &metas {
            let content = read_script(dir, &meta.name)?;
            zip.start_file(&meta.name, options)?;
            zip.write_all(content.as_bytes())?;
        }
        zip.finish()?;
    }
    Ok(buf)
}

pub fn export_simulation_zip(
    dir: &Path,
    var_map_path: &Path,
) -> io::Result<(Vec<u8>, usize, usize)> {
    let metas = super::list_scripts(dir)?;
    let script_count = metas.len();
    let var_map = var_map::load(var_map_path)?;
    let var_count = var_map.variables.len();
    let var_json = serde_json::to_vec(&var_map)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    let mut buf = Vec::new();
    {
        let mut zip = ZipWriter::new(Cursor::new(&mut buf));
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        for meta in &metas {
            let content = read_script(dir, &meta.name)?;
            zip.start_file(&meta.name, options)?;
            zip.write_all(content.as_bytes())?;
        }
        zip.start_file("var-map.json", options)?;
        zip.write_all(&var_json)?;
        zip.finish()?;
    }
    Ok((buf, script_count, var_count))
}

pub fn import_scripts_zip(dir: &Path, data: &[u8], replace: bool) -> io::Result<usize> {
    if data.len() > MAX_ZIP_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "zip archive too large",
        ));
    }
    let mut archive = ZipArchive::new(Cursor::new(data))?;
    let mut scripts = Vec::new();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let Some(basename) = zip_entry_basename(file.name()) else {
            continue;
        };
        if !basename.ends_with(".js") {
            continue;
        }
        if !validate_name(&basename) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("invalid script name in zip: {basename}"),
            ));
        }
        let mut content = String::new();
        file.read_to_string(&mut content)?;
        scripts.push(ScriptExportEntry {
            name: basename,
            content,
        });
    }
    if scripts.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "no .js scripts found in zip",
        ));
    }
    let bundle = ScriptExportBundle {
        version: 1,
        scripts,
    };
    import_scripts(dir, &bundle, replace)
}

pub struct SimulationZipImport {
    pub scripts_imported: usize,
    pub var_map_imported: usize,
}

pub fn import_simulation_zip(
    scripts_dir: &Path,
    var_map_path: &Path,
    data: &[u8],
    replace: bool,
    scripts_enabled: bool,
) -> io::Result<SimulationZipImport> {
    if data.len() > MAX_ZIP_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "zip archive too large",
        ));
    }
    let mut archive = ZipArchive::new(Cursor::new(data))?;
    let mut script_entries = Vec::new();
    let mut var_map_json: Option<Vec<u8>> = None;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let Some(basename) = zip_entry_basename(file.name()) else {
            continue;
        };
        if basename == "var-map.json" {
            let mut content = Vec::new();
            file.read_to_end(&mut content)?;
            var_map_json = Some(content);
            continue;
        }
        if !basename.ends_with(".js") {
            continue;
        }
        if !validate_name(&basename) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("invalid script name in zip: {basename}"),
            ));
        }
        let mut content = String::new();
        file.read_to_string(&mut content)?;
        script_entries.push(ScriptExportEntry {
            name: basename,
            content,
        });
    }

    if script_entries.is_empty() && var_map_json.is_none() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "zip contains no scripts or var-map.json",
        ));
    }

    let mut scripts_imported = 0usize;
    if !script_entries.is_empty() {
        if !scripts_enabled {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "simulation scripts disabled",
            ));
        }
        let bundle = ScriptExportBundle {
            version: 1,
            scripts: script_entries,
        };
        scripts_imported = import_scripts(scripts_dir, &bundle, replace)?;
    }

    let mut var_map_imported = 0usize;
    if let Some(json) = var_map_json {
        let bundle: VarMapBundle = serde_json::from_slice(&json)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        if !bundle.variables.is_empty() {
            var_map_imported = var_map::import_bundle(var_map_path, &bundle, replace)?;
        }
    }

    Ok(SimulationZipImport {
        scripts_imported,
        var_map_imported,
    })
}
