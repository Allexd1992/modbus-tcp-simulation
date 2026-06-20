use std::io;
use std::path::{Path, PathBuf};

use utoipa::ToSchema;

pub const MAX_SCRIPT_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, serde::Serialize, ToSchema)]
#[serde(crate = "serde")]
pub struct ScriptMeta {
    pub name: String,
    pub size: u64,
}

pub fn validate_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 128 {
        return false;
    }
    if !name.ends_with(".js") {
        return false;
    }
    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return false;
    }
    name.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
}

fn script_path(dir: &Path, name: &str) -> io::Result<PathBuf> {
    if !validate_name(name) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "invalid script name",
        ));
    }
    let path = dir.join(name);
    if path.parent() != Some(dir) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "invalid script path",
        ));
    }
    Ok(path)
}

pub fn ensure_dir(dir: &Path) -> io::Result<()> {
    std::fs::create_dir_all(dir)
}

pub fn list_scripts(dir: &Path) -> io::Result<Vec<ScriptMeta>> {
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().is_some_and(|x| x == "js") {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if validate_name(name) {
                    out.push(ScriptMeta {
                        name: name.to_string(),
                        size: entry.metadata()?.len(),
                    });
                }
            }
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub fn read_script(dir: &Path, name: &str) -> io::Result<String> {
    let path = script_path(dir, name)?;
    if !path.is_file() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "script not found"));
    }
    let data = std::fs::read(&path)?;
    if data.len() > MAX_SCRIPT_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "script too large",
        ));
    }
    String::from_utf8(data)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "script must be UTF-8"))
}

pub fn write_script(dir: &Path, name: &str, content: &str) -> io::Result<()> {
    if content.len() > MAX_SCRIPT_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "script too large",
        ));
    }
    ensure_dir(dir)?;
    let path = script_path(dir, name)?;
    std::fs::write(path, content.as_bytes())
}

pub fn delete_script(dir: &Path, name: &str) -> io::Result<()> {
    let path = script_path(dir, name)?;
    if !path.is_file() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "script not found"));
    }
    std::fs::remove_file(path)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(crate = "serde")]
pub struct ScriptExportEntry {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(crate = "serde")]
pub struct ScriptExportBundle {
    pub version: u32,
    pub scripts: Vec<ScriptExportEntry>,
}

pub fn export_scripts(dir: &Path) -> io::Result<ScriptExportBundle> {
    let metas = list_scripts(dir)?;
    let mut scripts = Vec::with_capacity(metas.len());
    for meta in metas {
        scripts.push(ScriptExportEntry {
            name: meta.name.clone(),
            content: read_script(dir, &meta.name)?,
        });
    }
    Ok(ScriptExportBundle {
        version: 1,
        scripts,
    })
}

pub fn import_scripts(dir: &Path, bundle: &ScriptExportBundle, replace: bool) -> io::Result<usize> {
    if bundle.version != 1 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "unsupported export version",
        ));
    }
    if bundle.scripts.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "no scripts in bundle",
        ));
    }
    for entry in &bundle.scripts {
        if !validate_name(&entry.name) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("invalid script name: {}", entry.name),
            ));
        }
        if entry.content.len() > MAX_SCRIPT_BYTES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("script too large: {}", entry.name),
            ));
        }
    }
    if replace {
        for meta in list_scripts(dir)? {
            delete_script(dir, &meta.name)?;
        }
    }
    let mut written = 0usize;
    for entry in &bundle.scripts {
        write_script(dir, &entry.name, &entry.content)?;
        written += 1;
    }
    Ok(written)
}
