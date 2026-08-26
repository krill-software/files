import "@krill-software/desktop-ui/styles";
import "./styles.css";

import { buildErrorState, mountChrome, showBootError } from "@krill-software/desktop-ui";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { getMatches } from "@tauri-apps/plugin-cli";
import { fileIcon, icon } from "./icons";

interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  modified: number;
}

type SortKey = "name" | "size" | "modified";

interface AppState {
  lastFolder: string | null;
  hiddenFiles: boolean;
  sortKey: SortKey | null;
  sortDesc: boolean;
  recent: string[];
}

const RECENT_MAX = 8;
const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "size", label: "Size" },
  { key: "modified", label: "Modified" },
];

let state: AppState = { lastFolder: null, hiddenFiles: false, sortKey: "name", sortDesc: false, recent: [] };
let currentPath = "";
let files: FileInfo[] = [];
let rows: HTMLElement[] = [];
let selectedIndex = -1;
/** Back stack — folders left via navigation, most recent last. */
const history: string[] = [];
/** Sidebar shortcuts as `[label, path]`; Home is always first. */
let shortcuts: Array<[string, string]> = [];
let home = "/";
let pathInputOpen = false;
let statusTimer: number | undefined;

const el = {
  header: document.createElement("div"),
  list: document.createElement("div"),
  breadcrumb: document.createElement("div"),
  status: document.createElement("div"),
  back: document.createElement("button"),
  up: document.createElement("button"),
  shortcuts: document.createElement("nav"),
  recentSection: document.createElement("div"),
  recent: document.createElement("div"),
  error: buildErrorState({ message: "Couldn't open this folder." }),
};

// ---- Formatting -------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[i]}`;
}

/** Today → time; this year → "12 Mar"; older → "12 Mar 2025". */
function formatDate(secs: number): string {
  if (!secs) return "—";
  const d = new Date(secs * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString(undefined, opts);
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? "/";
}

/** Expand `~`, collapse duplicate slashes, drop the trailing slash. */
function normalizePath(path: string): string {
  let p = path.trim();
  if (p === "~" || p.startsWith("~/")) p = home + p.slice(1);
  p = p.replace(/\/+/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

function parentOf(path: string): string {
  return path.replace(/\/[^/]*$/, "") || "/";
}

// ---- State ------------------------------------------------------------

async function saveState(): Promise<void> {
  await invoke("save_app_state_cmd", { state });
}

function addRecent(path: string): void {
  if (shortcuts.some(([, p]) => p === path)) return;
  state.recent = [path, ...state.recent.filter((p) => p !== path)].slice(0, RECENT_MAX);
}

// ---- Status -----------------------------------------------------------

function renderStatus(): void {
  window.clearTimeout(statusTimer);
  const n = files.length;
  const total = files.reduce((sum, f) => sum + f.size, 0);
  el.status.textContent = `${n} ${n === 1 ? "item" : "items"} · ${formatSize(total)}`;
}

/** Briefly replace the count with a one-line message (an error, "Path copied"). */
function flash(message: unknown): void {
  window.clearTimeout(statusTimer);
  el.status.textContent = String(message);
  statusTimer = window.setTimeout(renderStatus, 4000);
}

// ---- File list --------------------------------------------------------

function sortFiles(): void {
  const dir = state.sortDesc ? -1 : 1;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  files.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp = 0;
    if (state.sortKey === "size") cmp = a.size - b.size;
    else if (state.sortKey === "modified") cmp = a.modified - b.modified;
    if (cmp === 0) cmp = collator.compare(a.name, b.name);
    return cmp * dir;
  });
}

function renderHeader(): void {
  el.header.replaceChildren();
  for (const col of COLUMNS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `col-btn col-${col.key}`;
    btn.textContent = col.label;
    if (col.key === state.sortKey) {
      btn.classList.add("active");
      btn.appendChild(icon(state.sortDesc ? "chevron-down" : "chevron-up", 12));
    }
    btn.addEventListener("click", () => void setSort(col.key));
    el.header.appendChild(btn);
  }
}

async function setSort(key: SortKey): Promise<void> {
  if (state.sortKey === key) {
    state.sortDesc = !state.sortDesc;
  } else {
    state.sortKey = key;
    // Biggest / newest first is what you're after when you sort by these.
    state.sortDesc = key !== "name";
  }
  const keep = files[selectedIndex]?.path;
  sortFiles();
  renderHeader();
  renderList();
  reselect(keep);
  await saveState();
}

function cell(className: string, text: string): HTMLElement {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function renderList(): void {
  rows = files.map((file, idx) => {
    const row = document.createElement("div");
    row.className = "file-row";
    row.append(
      fileIcon(file.name, file.isDir),
      cell("file-name", file.name),
      cell("file-size", file.isDir ? "" : formatSize(file.size)),
      cell("file-date", formatDate(file.modified)),
    );
    row.addEventListener("click", () => select(idx));
    row.addEventListener("dblclick", () => void open(idx));
    row.addEventListener("contextmenu", (e) => showContextMenu(e, idx));
    return row;
  });
  el.list.replaceChildren(...rows);
  if (selectedIndex >= 0) rows[selectedIndex]?.classList.add("selected");
}

function select(idx: number): void {
  rows[selectedIndex]?.classList.remove("selected");
  selectedIndex = files.length === 0 ? -1 : Math.max(0, Math.min(files.length - 1, idx));
  const row = rows[selectedIndex];
  if (row) {
    row.classList.add("selected");
    row.scrollIntoView({ block: "nearest" });
  }
}

function reselect(path: string | undefined): void {
  const idx = path ? files.findIndex((f) => f.path === path) : -1;
  if (idx >= 0) select(idx);
  else selectedIndex = -1;
}

async function listFiles(): Promise<boolean> {
  const keep = files[selectedIndex]?.path;
  try {
    files = await invoke<FileInfo[]>("list_files", { path: currentPath, showHidden: state.hiddenFiles });
  } catch (e) {
    files = [];
    selectedIndex = -1;
    renderList();
    renderStatus();
    el.error.setFilename(String(e));
    el.error.element.hidden = false;
    el.header.hidden = true;
    return false;
  }
  el.error.element.hidden = true;
  el.header.hidden = false;
  sortFiles();
  renderList();
  reselect(keep);
  renderStatus();
  return true;
}

// ---- Navigation -------------------------------------------------------

async function navigateTo(path: string, opts: { push?: boolean } = {}): Promise<boolean> {
  path = normalizePath(path);
  if (path === currentPath) return true;
  const prev = currentPath;
  currentPath = path;
  selectedIndex = -1;
  renderBreadcrumb();
  const ok = await listFiles();
  // Push even on failure so Back returns to the folder that worked. On
  // failure currentPath stays on the bad folder — its crumbs are still
  // clickable — but lastFolder isn't touched, so next launch is unaffected.
  if (prev && opts.push !== false) history.push(prev);
  if (ok) {
    state.lastFolder = path;
    addRecent(path);
    await saveState();
  }
  renderSidebar();
  el.back.disabled = history.length === 0;
  el.up.disabled = currentPath === "/";
  return ok;
}

async function goBack(): Promise<void> {
  const prev = history.pop();
  if (prev) await navigateTo(prev, { push: false });
}

async function goUp(): Promise<void> {
  await navigateTo(parentOf(currentPath));
}

async function open(idx: number): Promise<void> {
  const file = files[idx];
  if (!file) return;
  if (file.isDir) {
    await navigateTo(file.path);
    return;
  }
  try {
    await invoke("open_file", { path: file.path });
  } catch (e) {
    flash(e);
  }
}

async function toggleHidden(): Promise<void> {
  state.hiddenFiles = !state.hiddenFiles;
  await saveState();
  await listFiles();
}

// ---- Breadcrumb / path input -----------------------------------------

function renderBreadcrumb(): void {
  if (pathInputOpen) return;
  const bar = el.breadcrumb;
  bar.replaceChildren();

  const parts = currentPath.split("/").filter(Boolean);
  const crumb = (label: string, target: string) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "breadcrumb-btn";
    btn.textContent = label;
    btn.addEventListener("click", () => void navigateTo(target));
    return btn;
  };
  const slash = () => {
    const s = document.createElement("span");
    s.className = "breadcrumb-slash";
    s.textContent = " / ";
    return s;
  };

  if (parts.length === 0) {
    bar.appendChild(crumb("/", "/"));
    return;
  }
  let path = "";
  parts.forEach((part, idx) => {
    path += "/" + part;
    bar.appendChild(crumb(part, path));
    if (idx < parts.length - 1) bar.appendChild(slash());
  });

  // Overflow ellipsizes to the LEFT: drop head crumbs behind a "…" until the
  // tail of the path fits. Re-run on resize by the ResizeObserver in boot().
  if (bar.scrollWidth > bar.clientWidth) {
    const ell = document.createElement("span");
    ell.className = "breadcrumb-slash";
    ell.textContent = "… / ";
    bar.prepend(ell);
    while (bar.scrollWidth > bar.clientWidth && bar.children.length > 2) {
      bar.children[1].remove();
      if (bar.children[1]?.classList.contains("breadcrumb-slash")) {
        bar.children[1].remove();
      }
    }
  }
}

/** Ctrl+L: swap the crumbs for an editable path in place. */
function showPathInput(): void {
  if (pathInputOpen) return;
  pathInputOpen = true;
  const input = document.createElement("input");
  input.className = "path-input";
  input.spellcheck = false;
  input.value = currentPath;
  el.breadcrumb.replaceChildren(input);
  input.focus();
  input.select();

  let done = false;
  const finish = (commit: boolean) => {
    if (done) return;
    done = true;
    pathInputOpen = false;
    const value = input.value;
    renderBreadcrumb();
    if (commit && value.trim()) void navigateTo(value);
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    else if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(false));
}

// ---- File operations --------------------------------------------------

/** F2: edit the name in place. Enter commits; Escape or focus loss cancels. */
function startRename(idx: number): void {
  const file = files[idx];
  const row = rows[idx];
  if (!file || !row) return;
  const nameEl = row.querySelector<HTMLElement>(".file-name")!;
  const input = document.createElement("input");
  input.className = "rename-input";
  input.spellcheck = false;
  input.value = file.name;
  nameEl.replaceChildren(input);
  input.focus();
  const dot = file.isDir ? -1 : file.name.lastIndexOf(".");
  input.setSelectionRange(0, dot > 0 ? dot : file.name.length);

  let done = false;
  const finish = async (commit: boolean) => {
    if (done) return;
    done = true;
    const newName = input.value.trim();
    nameEl.textContent = file.name;
    if (!commit || !newName || newName === file.name) return;
    try {
      const newPath = await invoke<string>("rename_file", { path: file.path, newName });
      await listFiles();
      reselect(newPath);
    } catch (e) {
      flash(e);
    }
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void finish(true);
    else if (e.key === "Escape") void finish(false);
  });
  input.addEventListener("blur", () => void finish(false));
  // Clicks inside the input mustn't re-select / open the row.
  input.addEventListener("click", (e) => e.stopPropagation());
  input.addEventListener("dblclick", (e) => e.stopPropagation());
}

async function trashFile(idx: number): Promise<void> {
  const file = files[idx];
  if (!file) return;
  try {
    await invoke("trash_file", { path: file.path });
  } catch (e) {
    flash(e);
    return;
  }
  selectedIndex = -1;
  await listFiles();
  select(idx);
}

async function copyPath(idx: number): Promise<void> {
  const file = files[idx];
  if (!file) return;
  try {
    await invoke("copy_path", { path: file.path });
    flash("Path copied");
  } catch (e) {
    flash(e);
  }
}

// ---- Context menu -----------------------------------------------------

let menu: HTMLElement | null = null;

function closeMenu(): void {
  menu?.remove();
  menu = null;
}

function showContextMenu(e: MouseEvent, idx: number): void {
  e.preventDefault();
  closeMenu();
  select(idx);

  const items: Array<{ label: string; action: () => void }> = [
    { label: "Open", action: () => void open(idx) },
    { label: "Rename", action: () => startRename(idx) },
    { label: "Move to trash", action: () => void trashFile(idx) },
    { label: "Copy path", action: () => void copyPath(idx) },
  ];

  const m = document.createElement("div");
  m.className = "context-menu";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "context-item";
    btn.textContent = item.label;
    btn.addEventListener("click", () => {
      closeMenu();
      item.action();
    });
    m.appendChild(btn);
  }
  document.body.appendChild(m);
  menu = m;

  // Keep the menu inside the window.
  const x = Math.min(e.clientX, window.innerWidth - m.offsetWidth - 4);
  const y = Math.min(e.clientY, window.innerHeight - m.offsetHeight - 4);
  m.style.left = `${Math.max(0, x)}px`;
  m.style.top = `${Math.max(0, y)}px`;
}

function installMenuDismissal(): void {
  document.addEventListener("mousedown", (e) => {
    if (menu && !menu.contains(e.target as Node)) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  window.addEventListener("blur", closeMenu);
  window.addEventListener("resize", closeMenu);
  el.list.parentElement?.addEventListener("scroll", closeMenu);
}

// ---- Sidebar ----------------------------------------------------------

function sidebarButton(label: string, path: string, glyph: string): HTMLElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shortcut-btn";
  btn.title = path;
  if (path === currentPath) btn.classList.add("active");
  btn.append(icon(glyph), cell("shortcut-label", label));
  btn.addEventListener("click", () => void navigateTo(path));
  return btn;
}

const SHORTCUT_GLYPHS: Record<string, string> = {
  Home: "home",
  Desktop: "monitor",
  Documents: "file-text",
  Downloads: "download",
  Music: "music",
  Pictures: "image",
  Videos: "video",
};

function renderSidebar(): void {
  el.shortcuts.replaceChildren(
    ...shortcuts.map(([label, path]) => sidebarButton(label, path, SHORTCUT_GLYPHS[label] ?? "folder")),
  );
  el.recent.replaceChildren(...state.recent.map((path) => sidebarButton(basename(path), path, "folder")));
  el.recentSection.hidden = state.recent.length === 0;
}

// ---- Boot -------------------------------------------------------------

function topbarButton(label: string, glyph: string, action: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "main-topbar-btn";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.appendChild(icon(glyph, 14));
  btn.addEventListener("click", action);
  return btn;
}

async function boot(): Promise<void> {
  const version = await getVersion().catch(() => "0.0.0");

  const chrome = mountChrome({
    productName: "Files",
    version,
    layout: "app",
    showAuxPane: true,
    updater: true,
    actions: {
      first: () => select(0),
      last: () => select(files.length - 1),
    },
    customMenu: [
      {
        group: "file",
        items: [
          { label: "Rename", shortcut: "F2", action: () => startRename(selectedIndex) },
          { label: "Move to trash", shortcut: "Delete", action: () => trashFile(selectedIndex) },
          { label: "Copy path", shortcut: "Ctrl+Shift+C", action: () => copyPath(selectedIndex) },
        ],
      },
      {
        group: "view",
        items: [
          { label: "Show hidden files", shortcut: "Ctrl+H", action: toggleHidden },
          { label: "Refresh", shortcut: "F5", action: () => void listFiles() },
        ],
      },
      {
        group: "go",
        items: [
          { label: "Back", shortcut: "Alt+ArrowLeft", action: goBack },
          { label: "Up", shortcut: "Alt+ArrowUp", action: goUp },
          { label: "Go to folder…", shortcut: "Ctrl+L", action: showPathInput },
        ],
      },
    ],
    bindings: {
      ArrowUp: () => select(selectedIndex - 1),
      ArrowDown: () => select(selectedIndex + 1),
      Enter: () => open(selectedIndex),
      Backspace: goUp,
    },
  });

  // Main topbar: [←] [↑] crumbs … status [— □ ×]. The drag-region attribute
  // keeps the gaps between crumbs draggable; the buttons lack it and stay
  // clickable. The status never shrinks — the crumbs ellipsize instead.
  el.back = topbarButton("Back", "arrow-left", () => void goBack());
  el.up = topbarButton("Up", "arrow-up", () => void goUp());
  el.breadcrumb.className = "breadcrumb-bar";
  el.breadcrumb.setAttribute("data-tauri-drag-region", "");
  el.status.className = "topbar-status";
  el.status.setAttribute("data-tauri-drag-region", "");
  chrome.viewport.querySelector(".main-topbar")!.prepend(el.back, el.up, el.breadcrumb, el.status);
  new ResizeObserver(() => renderBreadcrumb()).observe(el.breadcrumb);

  // Main content: sticky column header over the row list; the error
  // placeholder overlays the same area when a folder can't be read.
  const main = document.createElement("div");
  main.className = "files-main";
  el.header.className = "file-list-header";
  el.list.className = "file-list";
  el.error.element.hidden = true;
  main.append(el.header, el.list, el.error.element);
  chrome.mainContent!.appendChild(main);
  installMenuDismissal();

  // Aux: XDG shortcuts, then recently opened folders.
  const sidebar = document.createElement("div");
  sidebar.className = "files-sidebar";
  el.shortcuts.className = "shortcuts";
  el.recentSection.className = "sidebar-section";
  el.recent.className = "recent-list";
  el.recentSection.append(cell("section-title", "Recent"), el.recent);
  sidebar.append(el.shortcuts, el.recentSection);
  chrome.aux!.appendChild(sidebar);

  const loaded = await invoke<Partial<AppState>>("get_app_state_cmd");
  state = { ...state, ...loaded, sortKey: loaded.sortKey ?? "name" };
  shortcuts = await invoke<Array<[string, string]>>("get_xdg_dirs");
  home = shortcuts[0]?.[1] ?? "/";
  renderHeader();

  // CLI arg wins over the remembered folder; a folder that no longer opens
  // falls back to Home.
  let start = state.lastFolder ?? home;
  try {
    const arg = (await getMatches()).args.folder?.value;
    if (typeof arg === "string" && arg.length > 0) start = arg;
  } catch {
    /* cli plugin unavailable */
  }
  if (!(await navigateTo(start, { push: false })) && normalizePath(start) !== home) {
    await navigateTo(home, { push: false });
  }
}

boot().catch((e) => {
  console.error("boot failed:", e);
  showBootError(e);
});
