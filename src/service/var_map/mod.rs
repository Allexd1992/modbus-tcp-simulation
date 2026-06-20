use std::io;
use std::path::Path;

use utoipa::ToSchema;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(crate = "serde")]
pub struct VarMapEntry {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub kind: String,
    pub addr: u16,
    #[serde(rename = "type")]
    pub var_type: String,
    #[serde(default)]
    pub bit: u8,
    #[serde(default = "default_order")]
    pub order: String,
}

fn default_order() -> String {
    "HL".to_string()
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(crate = "serde")]
pub struct VarMapBundle {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub variables: Vec<VarMapEntry>,
}

fn default_version() -> u32 {
    1
}

pub fn validate_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 64 {
        return false;
    }
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !first.is_ascii_alphabetic() && first != '_' {
        return false;
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

pub fn validate_kind(kind: &str) -> bool {
    matches!(kind, "holding" | "input" | "coil" | "dinput")
}

pub fn validate_type(var_type: &str) -> bool {
    matches!(
        var_type,
        "uint16" | "int16" | "int32" | "float32" | "float64" | "int64" | "bool" | "bit"
    )
}

fn normalize_entry(entry: VarMapEntry) -> io::Result<VarMapEntry> {
    if !validate_name(&entry.name) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("invalid variable name: {}", entry.name),
        ));
    }
    if !validate_kind(&entry.kind) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("invalid kind for {}: {}", entry.name, entry.kind),
        ));
    }
    if !validate_type(&entry.var_type) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("invalid type for {}: {}", entry.name, entry.var_type),
        ));
    }
    if (entry.kind == "coil" || entry.kind == "dinput") && entry.var_type != "bool" {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("coil/discrete input must be bool: {}", entry.name),
        ));
    }
    if entry.var_type == "bit" && entry.kind != "holding" && entry.kind != "input" {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("bit type requires holding or input: {}", entry.name),
        ));
    }
    if entry.var_type == "bit" && entry.bit > 15 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("bit index must be 0..15 for {}: {}", entry.name, entry.bit),
        ));
    }
    if (entry.var_type == "int32" || entry.var_type == "float32")
        && entry.order != "HL"
        && entry.order != "LH"
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("invalid word order for {}: {}", entry.name, entry.order),
        ));
    }
    Ok(VarMapEntry {
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        addr: entry.addr,
        var_type: entry.var_type.clone(),
        bit: if entry.var_type == "bit" {
            entry.bit
        } else {
            0
        },
        order: if entry.order == "LH" {
            "LH".to_string()
        } else {
            "HL".to_string()
        },
    })
}

pub fn normalize_bundle(bundle: &VarMapBundle) -> io::Result<VarMapBundle> {
    if bundle.version != 1 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "unsupported var-map version",
        ));
    }
    let mut seen = std::collections::HashSet::new();
    let mut variables = Vec::with_capacity(bundle.variables.len());
    for entry in &bundle.variables {
        let norm = normalize_entry(entry.clone())?;
        if !seen.insert(norm.name.clone()) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("duplicate variable name: {}", norm.name),
            ));
        }
        variables.push(norm);
    }
    Ok(VarMapBundle {
        version: 1,
        variables,
    })
}

pub fn load(path: &Path) -> io::Result<VarMapBundle> {
    if !path.is_file() {
        return Ok(VarMapBundle::default());
    }
    let data = std::fs::read_to_string(path)?;
    let bundle: VarMapBundle = serde_json::from_str(&data)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    normalize_bundle(&bundle)
}

pub fn save(path: &Path, bundle: &VarMapBundle) -> io::Result<()> {
    let normalized = normalize_bundle(bundle)?;
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let json = serde_json::to_string_pretty(&normalized)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    std::fs::write(path, json)
}

pub fn definitions_json(path: &Path) -> io::Result<String> {
    let bundle = load(path)?;
    serde_json::to_string(&bundle.variables)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))
}

pub fn import_bundle(path: &Path, bundle: &VarMapBundle, replace: bool) -> io::Result<usize> {
    let incoming = normalize_bundle(bundle)?;
    if incoming.variables.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "no variables in bundle",
        ));
    }
    if replace {
        save(path, &incoming)?;
        return Ok(incoming.variables.len());
    }
    let mut current = load(path)?;
    let mut index_by_name = std::collections::HashMap::new();
    for (i, entry) in current.variables.iter().enumerate() {
        index_by_name.insert(entry.name.clone(), i);
    }
    let mut written = 0usize;
    for entry in incoming.variables {
        if let Some(idx) = index_by_name.get(&entry.name).copied() {
            current.variables[idx] = entry;
        } else {
            index_by_name.insert(entry.name.clone(), current.variables.len());
            current.variables.push(entry);
        }
        written += 1;
    }
    save(path, &current)?;
    Ok(written)
}
