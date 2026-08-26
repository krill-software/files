use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;

use krill_desktop_core::{fs as kfs, state as kstate, updater::BuilderExt};

const SLUG: &str = "krill-files";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
    is_dir: bool,
    modified: u64,
}

/// Persisted across sessions. Every field defaults so a state file written by
/// an older build still loads.
#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct AppState {
    last_folder: Option<String>,
    hidden_files: bool,
    sort_key: Option<String>,
    sort_desc: bool,
    recent: Vec<String>,
}

/// A clipboard handle kept alive for the whole app session. On Wayland the
/// clipboard offer is served from a thread owned by this handle — dropping it
/// right after `set_text` would drop the offer with it.
struct Clip(Mutex<Option<arboard::Clipboard>>);

#[tauri::command]
fn list_files(path: String, show_hidden: bool) -> Result<Vec<FileInfo>, String> {
    let entries = fs::read_dir(Path::new(&path)).map_err(|e| kfs::format_io_err(&path, e))?;
    let mut out = Vec::new();

    for entry in entries.flatten() {
        let ep = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if !show_hidden && name.starts_with('.') {
            continue;
        }

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
            name,
            path: kfs::absolute_path(&ep),
            size,
            is_dir,
            modified,
        });
    }

    Ok(out)
}

/// Sidebar shortcuts: Home plus the XDG user dirs that actually exist, as
/// `(label, path)`. Home is always first — the frontend uses it as the fallback
/// folder.
#[tauri::command]
fn get_xdg_dirs() -> Vec<(String, String)> {
    let candidates: [(&str, Option<PathBuf>); 7] = [
        ("Home", dirs::home_dir()),
        ("Desktop", dirs::desktop_dir()),
        ("Documents", dirs::document_dir()),
        ("Downloads", dirs::download_dir()),
        ("Music", dirs::audio_dir()),
        ("Pictures", dirs::picture_dir()),
        ("Videos", dirs::video_dir()),
    ];
    candidates
        .into_iter()
        .filter_map(|(label, dir)| dir.filter(|d| d.is_dir()).map(|d| (label.to_string(), kfs::absolute_path(&d))))
        .collect()
}

#[tauri::command]
fn get_app_state_cmd() -> AppState {
    kstate::load(SLUG, "state.json").unwrap_or_default()
}

#[tauri::command]
fn save_app_state_cmd(state: AppState) -> Result<(), String> {
    kstate::save(SLUG, "state.json", &state)
}

#[tauri::command]
fn trash_file(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| format!("Couldn't move {path} to trash: {e}"))
}

#[tauri::command]
fn rename_file(path: String, new_name: String) -> Result<String, String> {
    if new_name.is_empty() || new_name == "." || new_name == ".." || new_name.contains('/') {
        return Err(format!("\"{new_name}\" isn't a valid name"));
    }
    let p = PathBuf::from(&path);
    let parent = p.parent().ok_or_else(|| "No parent directory".to_string())?;
    let new_path = parent.join(&new_name);
    if new_path.exists() {
        return Err(format!("\"{new_name}\" already exists"));
    }
    fs::rename(&p, &new_path).map_err(|e| kfs::format_io_err(&path, e))?;
    Ok(kfs::absolute_path(&new_path))
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    let mut child = Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open {path}: {e}"))?;
    // Reap in the background so the launcher doesn't linger as a zombie.
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

#[tauri::command]
fn copy_path(path: String, clip: State<'_, Clip>) -> Result<(), String> {
    let mut guard = clip.0.lock().map_err(|_| "clipboard lock poisoned".to_string())?;
    if guard.is_none() {
        *guard = Some(arboard::Clipboard::new().map_err(|e| format!("clipboard init: {e}"))?);
    }
    guard
        .as_mut()
        .expect("clipboard initialised above")
        .set_text(path)
        .map_err(|e| format!("setting clipboard text: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .with_updater()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(Clip(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            list_files,
            get_xdg_dirs,
            get_app_state_cmd,
            save_app_state_cmd,
            trash_file,
            rename_file,
            open_file,
            copy_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
