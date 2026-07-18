import "@krill-software/desktop-ui/styles";
import "./styles.css";

import { mountChrome } from "@krill-software/desktop-ui";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";

const appWindow = getCurrentWindow();

interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  modified: number;
}

interface AppState {
  lastFolder: string | null;
  hiddenFiles: boolean;
}

let state: AppState = { lastFolder: null, hiddenFiles: false };
let currentPath = "";
let files: FileInfo[] = [];
let selectedIndex = -1;
let sortColumn: "name" | "size" | "modified" = "name";
let sortAsc = true;

const elements = {
  fileList: null as HTMLElement | null,
  breadcrumb: null as HTMLElement | null,
  sidebar: null as HTMLElement | null,
  shortcuts: null as HTMLElement | null,
  recentList: null as HTMLElement | null,
  statusBar: null as HTMLElement | null,
};

function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIdx = 0;
  while (size > 1024 && unitIdx < units.length - 1) {
    size /= 1024;
    unitIdx++;
  }
  return unitIdx === 0 ? `${size}B` : `${size.toFixed(1)}${units[unitIdx]}`;
}

function formatDate(secs: number): string {
  if (!secs) return "—";
  const date = new Date(secs * 1000);
  return date.toLocaleDateString();
}

function getFileIcon(file: FileInfo): string {
  if (file.isDir) return "📁";
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    pdf: "📄",
    txt: "📝",
    md: "📝",
    json: "⚙",
    js: "📜",
    ts: "📜",
    py: "🐍",
    rs: "🦀",
    png: "🖼",
    jpg: "🖼",
    jpeg: "🖼",
    gif: "🖼",
    mp3: "🎵",
    mp4: "🎬",
    zip: "📦",
    tar: "📦",
    gz: "📦",
  };
  return icons[ext] || "📄";
}

async function loadState(): Promise<void> {
  state = await invoke<AppState>("get_app_state_cmd");
}

async function saveState(): Promise<void> {
  await invoke("save_app_state_cmd", {
    lastFolder: state.lastFolder,
    hiddenFiles: state.hiddenFiles,
  });
}

async function listFiles(): Promise<void> {
  try {
    files = await invoke<FileInfo[]>("list_files", {
      path: currentPath,
      showHidden: state.hiddenFiles,
    });
    sortFiles();
    renderFileList();
    renderStatusBar();
  } catch (e) {
    console.error("Failed to list files:", e);
  }
}

function sortFiles(): void {
  files.sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    if (sortColumn === "name") {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else if (sortColumn === "size") {
      aVal = a.size;
      bVal = b.size;
    } else {
      aVal = a.modified;
      bVal = b.modified;
    }

    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });
}

function renderFileList(): void {
  if (!elements.fileList) return;

  elements.fileList.innerHTML = `
    <div class="file-list-header">
      <div class="col-name">
        <button class="sort-btn" data-col="name">Name ${sortColumn === "name" ? (sortAsc ? "↑" : "↓") : ""}</button>
      </div>
      <div class="col-size">
        <button class="sort-btn" data-col="size">Size ${sortColumn === "size" ? (sortAsc ? "↑" : "↓") : ""}</button>
      </div>
      <div class="col-modified">
        <button class="sort-btn" data-col="modified">Modified ${sortColumn === "modified" ? (sortAsc ? "↑" : "↓") : ""}</button>
      </div>
    </div>
    <div class="file-list-body"></div>
  `;

  const body = elements.fileList.querySelector(".file-list-body");
  if (!body) return;

  files.forEach((file, idx) => {
    const row = document.createElement("div");
    row.className = `file-row ${idx === selectedIndex ? "selected" : ""}`;
    row.innerHTML = `
      <div class="col-name">${getFileIcon(file)} ${file.name}</div>
      <div class="col-size">${formatSize(file.size)}</div>
      <div class="col-modified">${formatDate(file.modified)}</div>
    `;

    row.addEventListener("click", () => selectFile(idx));
    row.addEventListener("dblclick", () => openFile(idx));
    row.addEventListener("contextmenu", (e) => showContextMenu(e, idx));

    body.appendChild(row);
  });

  document.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const col = (e.target as HTMLElement).getAttribute("data-col") as
        | "name"
        | "size"
        | "modified";
      if (sortColumn === col) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = col;
        sortAsc = true;
      }
      sortFiles();
      renderFileList();
    });
  });
}

function renderStatusBar(): void {
  if (!elements.statusBar) return;
  const count = files.length;
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  elements.statusBar.textContent = `${count} items · ${formatSize(totalSize)}`;
}

function selectFile(idx: number): void {
  selectedIndex = idx;
  renderFileList();
}

async function openFile(idx: number): Promise<void> {
  if (idx < 0 || idx >= files.length) return;
  const file = files[idx];
  if (file.isDir) {
    await navigateTo(file.path);
  } else {
    await invoke("open_file", { path: file.path });
  }
}

function showContextMenu(e: MouseEvent, idx: number): void {
  e.preventDefault();
  selectFile(idx);

  const file = files[idx];
  const menu = document.createElement("div");
  menu.className = "context-menu";

  const items = [
    { label: "Open", action: () => openFile(idx) },
    file.isDir ? null : { label: "Open with...", action: () => {} }, // placeholder
    { label: "Delete", action: () => deleteFile(idx) },
    { label: "Rename", action: () => renameFile(idx) },
    { label: "Copy path", action: () => copyPath(idx) },
  ].filter((x) => x !== null) as Array<{ label: string; action: () => void }>;

  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = "context-item";
    btn.textContent = item.label;
    btn.addEventListener("click", () => {
      item.action();
      menu.remove();
    });
    menu.appendChild(btn);
  });

  menu.style.left = e.clientX + "px";
  menu.style.top = e.clientY + "px";
  document.body.appendChild(menu);

  document.addEventListener(
    "click",
    () => menu.remove(),
    { once: true }
  );
}

async function deleteFile(idx: number): Promise<void> {
  const file = files[idx];
  const ok = await confirm(
    `Delete ${file.isDir ? "folder" : "file"} "${file.name}"?`,
    { title: "Delete" }
  );
  if (ok) {
    try {
      await invoke("delete_file", { path: file.path });
      await listFiles();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }
}

async function renameFile(idx: number): Promise<void> {
  const file = files[idx];
  const newName = prompt("Rename to:", file.name);
  if (newName && newName !== file.name) {
    try {
      await invoke("rename_file", { path: file.path, newName });
      await listFiles();
    } catch (e) {
      console.error("Rename failed:", e);
    }
  }
}

async function copyPath(idx: number): Promise<void> {
  try {
    await invoke("copy_path", { path: files[idx].path });
  } catch (e) {
    console.error("Copy failed:", e);
  }
}

async function navigateTo(path: string): Promise<void> {
  currentPath = path;
  state.lastFolder = path;
  await saveState();
  selectedIndex = -1;
  renderBreadcrumb();
  await listFiles();
}

async function navigateUp(): Promise<void> {
  const parent = currentPath.substring(0, currentPath.lastIndexOf("/"));
  if (parent) {
    await navigateTo(parent);
  }
}

function renderBreadcrumb(): void {
  if (!elements.breadcrumb) return;

  elements.breadcrumb.innerHTML = "";

  const parts = currentPath.split("/").filter((p) => p);
  const upBtn = document.createElement("button");
  upBtn.className = "breadcrumb-btn";
  upBtn.textContent = "↑";
  upBtn.addEventListener("click", () => navigateUp());
  elements.breadcrumb.appendChild(upBtn);

  let path = "";
  parts.forEach((part, idx) => {
    path += "/" + part;
    const btn = document.createElement("button");
    btn.className = "breadcrumb-btn";
    btn.textContent = part || "/";
    btn.addEventListener("click", () => navigateTo(path));
    elements.breadcrumb.appendChild(btn);
  });
}

async function renderSidebar(): Promise<void> {
  if (!elements.shortcuts) return;

  const dirs = await invoke<Array<[string, string]>>("get_xdg_dirs");

  elements.shortcuts.innerHTML = "";
  dirs.forEach(([name, path]) => {
    const btn = document.createElement("button");
    btn.className = "shortcut-btn";
    btn.textContent = name;
    btn.addEventListener("click", () => navigateTo(path));
    elements.shortcuts.appendChild(btn);
  });

  const section = document.createElement("div");
  section.className = "sidebar-section";
  section.innerHTML = "<div class='section-title'>Recently opened</div>";
  elements.shortcuts.parentElement?.appendChild(section);

  elements.recentList = document.createElement("div");
  elements.recentList.className = "recent-list";
  section.appendChild(elements.recentList);
}

function setupKeyboard(): void {
  document.addEventListener("keydown", async (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      selectFile(Math.max(0, selectedIndex - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      selectFile(Math.min(files.length - 1, selectedIndex + 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      await openFile(selectedIndex);
    } else if (e.key === "Delete" && selectedIndex >= 0) {
      await deleteFile(selectedIndex);
    } else if (e.key === "F5") {
      e.preventDefault();
      await listFiles();
    } else if (e.ctrlKey && e.key === "h") {
      e.preventDefault();
      state.hiddenFiles = !state.hiddenFiles;
      await saveState();
      await listFiles();
    } else if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      const path = prompt("Go to:", currentPath);
      if (path) {
        try {
          await navigateTo(path);
        } catch (e) {
          console.error("Navigation failed:", e);
        }
      }
    }
  });
}

function setupWindowControls(): void {
  setTimeout(() => {
    const minimizeBtn = document.querySelector("#titlebar-min");
    const maximizeBtn = document.querySelector("#titlebar-max");
    const closeBtn = document.querySelector("#titlebar-close");

    if (!minimizeBtn || !maximizeBtn || !closeBtn) {
      console.warn("Window control buttons not found in DOM");
      return;
    }

    minimizeBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await appWindow.minimize();
      } catch (err) {
        console.error("Minimize failed:", err);
      }
    });

    maximizeBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const isMaximized = await appWindow.isMaximized();
        if (isMaximized) {
          await appWindow.unmaximize();
        } else {
          await appWindow.maximize();
        }
      } catch (err) {
        console.error("Maximize failed:", err);
      }
    });

    closeBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await appWindow.close();
      } catch (err) {
        console.error("Close failed:", err);
      }
    });
  }, 100);
}

async function boot(): Promise<void> {
  const version = await getVersion().catch(() => "0.0.0");

  const chrome = mountChrome({
    productName: "Files",
    version,
    layout: "app",
    actions: {},
    showAuxPane: true,
    updater: true,
  });

  const main = chrome.mainContent!;
  main.innerHTML = `
    <div class="files-main">
      <div class="breadcrumb-bar"></div>
      <div class="file-list"></div>
      <div class="status-bar"></div>
    </div>
  `;

  elements.fileList = main.querySelector(".file-list");
  elements.breadcrumb = main.querySelector(".breadcrumb-bar");
  elements.statusBar = main.querySelector(".status-bar");
  elements.sidebar = chrome.aux!;

  const sidebar = document.createElement("div");
  sidebar.className = "files-sidebar";
  const shortcuts = document.createElement("nav");
  shortcuts.className = "shortcuts";
  sidebar.appendChild(shortcuts);
  elements.sidebar.appendChild(sidebar);
  elements.shortcuts = shortcuts;

  await loadState();

  try {
    if (state.lastFolder) {
      currentPath = state.lastFolder;
    } else {
      const dirs = await invoke<Array<[string, string]>>("get_xdg_dirs");
      currentPath = dirs[0]?.[1] || "/home";
    }

    await renderSidebar();
    renderBreadcrumb();
    await listFiles();
    setupKeyboard();
    setupWindowControls();
  } catch (e) {
    console.error("Boot failed:", e);
  }

  await appWindow.show().catch(() => {});
}

boot().catch((e) => {
  console.error("boot failed:", e);
});
