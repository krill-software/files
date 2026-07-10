use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use krill_desktop_core::{fs as kfs, state as kstate, updater::BuilderExt};

const SLUG: &str = "krill-files";

#[derive(Debug, Serialize, Deserialize, Default)]
struct AppState {
    window: Option<kstate::WindowGeometry>,
    last_folder: Option<String>,
}

#[tauri::command]
fn load_state() -> Option<AppState> {
    kstate::load(SLUG, "state.json")
}

#[tauri::command]
fn save_state(state: AppState) -> Result<(), String> {
    kstate::save(SLUG, "state.json", &state)
}

#[derive(Debug, Serialize)]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
    is_dir: bool,
    modified: u64,
}

// List files in a directory.
#[tauri::command]
fn list_files(path: String) -> Result<Vec<FileInfo>, String> {
    let p = Path::new(&path);
    let entries = fs::read_dir(p).map_err(|e| kfs::format_io_err(&path, e))?;
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let ep = entry.path();
        let metadata = ep.metadata().ok();
        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = metadata
            .as_ref()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        out.push(FileInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            path: kfs::absolute_path(&ep),
            size,
            is_dir,
            modified,
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .with_updater()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![list_files, load_state, save_state])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
