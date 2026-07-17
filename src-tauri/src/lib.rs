use std::fs;
use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};

use krill_desktop_core::{fs as kfs, state as kstate, updater::BuilderExt};

const SLUG: &str = "krill-files";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
    is_dir: bool,
    modified: u64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AppState {
    last_folder: Option<String>,
    hidden_files: bool,
}

fn get_app_state() -> AppState {
    kstate::load(SLUG, "state.json").unwrap_or_default()
}

fn save_app_state(state: &AppState) -> Result<(), String> {
    kstate::save(SLUG, "state.json", state)
}

#[tauri::command]
fn list_files(path: String, show_hidden: bool) -> Result<Vec<FileInfo>, String> {
    let p = std::path::Path::new(&path);
    let entries = fs::read_dir(p).map_err(|e| kfs::format_io_err(&path, e))?;
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

    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[tauri::command]
fn get_xdg_dirs() -> Result<Vec<(String, String)>, String> {
    let home = std::env::var("HOME").ok();
    let mut dirs = Vec::new();

    if let Some(h) = home.clone() {
        dirs.push(("Home".to_string(), h.clone()));
        dirs.push(("Desktop".to_string(), format!("{}/Desktop", h)));
        dirs.push(("Documents".to_string(), format!("{}/Documents", h)));
        dirs.push(("Downloads".to_string(), format!("{}/Downloads", h)));
        dirs.push(("Music".to_string(), format!("{}/Music", h)));
        dirs.push(("Pictures".to_string(), format!("{}/Pictures", h)));
        dirs.push(("Videos".to_string(), format!("{}/Videos", h)));
    }

    Ok(dirs)
}

#[tauri::command]
fn get_app_state_cmd() -> Result<AppState, String> {
    Ok(get_app_state())
}

#[tauri::command]
fn save_app_state_cmd(last_folder: Option<String>, hidden_files: bool) -> Result<(), String> {
    save_app_state(&AppState {
        last_folder,
        hidden_files,
    })
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| kfs::format_io_err(&path, e))?;
    } else {
        fs::remove_file(&p).map_err(|e| kfs::format_io_err(&path, e))?;
    }
    Ok(())
}

#[tauri::command]
fn rename_file(path: String, new_name: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    let parent = p
        .parent()
        .ok_or_else(|| "No parent directory".to_string())?;
    let new_path = parent.join(&new_name);

    fs::rename(&p, &new_path).map_err(|e| kfs::format_io_err(&path, e))?;
    Ok(kfs::absolute_path(&new_path))
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open {}: {}", path, e))?;
    Ok(())
}

#[tauri::command]
fn copy_path(path: String) -> Result<(), String> {
    use std::process::Stdio;
    Command::new("xclip")
        .arg("-selection")
        .arg("clipboard")
        .stdin(Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            let mut stdin = child.stdin.take().ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::BrokenPipe, "No stdin")
            })?;
            stdin.write_all(path.as_bytes())?;
            Ok(())
        })
        .map_err(|e| format!("Failed to copy path: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .with_updater()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            list_files,
            get_xdg_dirs,
            get_app_state_cmd,
            save_app_state_cmd,
            delete_file,
            rename_file,
            open_file,
            copy_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
