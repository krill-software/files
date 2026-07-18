import "@krill-software/desktop-ui/styles";
import "./styles.css";

import { mountChrome } from "@krill-software/desktop-ui";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import {
  Home, Folder, FileText, Download, Music, Image, Video,
  File, FileJson, Code, GitBranch, Package, Archive,
} from "lucide";

const appWindow = getCurrentWindow();

const LUCIDE_ICONS: Record<string, (size: number, color: string) => string> = {
  home: (size, color) => Home({ size, color }).outerHTML,
  desktop: (size, color) => Folder({ size, color }).outerHTML,
  documents: (size, color) => FileText({ size, color }).outerHTML,
  downloads: (size, color) => Download({ size, color }).outerHTML,
  music: (size, color) => Music({ size, color }).outerHTML,
  pictures: (size, color) => Image({ size, color }).outerHTML,
  videos: (size, color) => Video({ size, color }).outerHTML,
};

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

function getFileIcon(file: FileInfo): HTMLElement {
  const accentColor = "var(--fm-accent)";
  const iconContainer = document.createElement("span");
  iconContainer.className = "file-icon-lucide";

  if (file.isDir) {
    const folderIcon = document.createElement("div");
    folderIcon.innerHTML = Folder({ size: 16, color: "#DD7596" }).outerHTML;
    iconContainer.appendChild(folderIcon.firstElementChild as HTMLElement);
  } else {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let svg: HTMLElement;

    const iconMap: Record<string, any> = {
      json: FileJson,
      js: Code,
      ts: Code,
      py: Code,
      rs: Code,
      txt: FileText,
      md: FileText,
      pdf: FileText,
      mp3: Music,
      mp4: Video,
      png: Image,
      jpg: Image,
      jpeg: Image,
      gif: Image,
      zip: Archive,
      tar: Archive,
      gz: Archive,
    };

    const IconComponent = iconMap[ext] || File;
    const div = document.createElement("div");
    div.innerHTML = IconComponent({ size: 16, color: "#DD7596" }).outerHTML;
    iconContainer.appendChild(div.firstElementChild as HTMLElement);
  }

  return iconContainer;
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
    files.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    renderFileList();
    renderStatusBar();
  } catch (e) {
    console.error("Failed to list files:", e);
  }
}

function renderFileList(): void {
  if (!elements.fileList) return;

  elements.fileList.innerHTML = "";

  files.forEach((file, idx) => {
    const row = document.createElement("div");
    row.className = `file-row ${idx === selectedIndex ? "selected" : ""}`;

    const icon = getFileIcon(file);
    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = file.name;

    row.appendChild(icon);
    row.appendChild(name);

    row.addEventListener("click", () => selectFile(idx));
    row.addEventListener("dblclick", () => openFile(idx));
    row.addEventListener("contextmenu", (e) => showContextMenu(e, idx));

    elements.fileList!.appendChild(row);
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
  let path = "";

  parts.forEach((part, idx) => {
    path += "/" + part;

    const btn = document.createElement("button");
    btn.className = "breadcrumb-btn";
    btn.textContent = part;
    btn.addEventListener("click", () => navigateTo(path));
    elements.breadcrumb.appendChild(btn);

    if (idx < parts.length - 1) {
      const slash = document.createElement("span");
      slash.className = "breadcrumb-slash";
      slash.textContent = " / ";
      elements.breadcrumb.appendChild(slash);
    }
  });
}

async function renderSidebar(): Promise<void> {
  if (!elements.shortcuts) return;

  const dirs = await invoke<Array<[string, string]>>("get_xdg_dirs");

  elements.shortcuts.innerHTML = "";

  const iconMap: Record<string, any> = {
    Home: Home,
    Desktop: Folder,
    Documents: FileText,
    Downloads: Download,
    Music: Music,
    Pictures: Image,
    Videos: Video,
  };

  dirs.forEach(([name, path]) => {
    const btn = document.createElement("button");
    btn.className = "shortcut-btn";

    const IconComponent = iconMap[name] || Folder;
    const iconDiv = document.createElement("div");
    iconDiv.className = "shortcut-icon";
    iconDiv.innerHTML = IconComponent({ size: 16, color: "#DD7596" }).outerHTML;

    const label = document.createElement("span");
    label.textContent = name;

    btn.appendChild(iconDiv.firstElementChild as HTMLElement);
    btn.appendChild(label);
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
      <div class="nav-bar">
        <div class="breadcrumb-bar"></div>
        <div class="status-bar"></div>
      </div>
      <div class="file-list"></div>
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
