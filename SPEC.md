# Files — Spec (v1)

A minimal file browser for Linux. Sidebar quick-access (Home, Desktop, Documents, etc) + main pane shows the folder's contents. One folder per window.

## Identity

| Field | Value |
|---|---|
| Slug (directory) | `files` |
| productName | `Files` |
| Binary | `krill-files` |
| Identifier | `software.krill.files` |
| Document format | folder path (`.krill-files.json` state stores last-open folder) |
| Icon glyph | Lucide `folder-open` |

## The idea

A desktop file browser that does one thing: browse a folder and operate on its files. Not a project tree, not a sidebar vault. One window = one folder. Open a new window to browse another folder in parallel.

## Layout — app shell (mountChrome layout: "app")

No titlebar or status line. Aux pane (left sidebar) carries quick shortcuts; main pane shows folder contents with breadcrumb path + file list.

- **Aux (sidebar):**
  - Quick-access icons (Home, Desktop, Documents, Downloads, Music, Pictures, Videos)
  - Recently opened folders (expandable list below)
  - Mounted volumes/drives
- **Main:**
  - Breadcrumb path bar (clickable segments to navigate)
  - File list: name / size / type (icon) / modified (sortable columns)
  - Status bar at bottom: item count + total size
- **Interactions:** click file → open with default; right-click → context menu; drag folder on sidebar → navigate.

## M1 — browse & basic ops

- **Sidebar shortcuts:** Home, Desktop, Documents, Downloads, Music, Pictures, Videos (via XDG dirs); recently opened folders auto-added; click to navigate.
- **File list:** name, size, type (icon), modified date; sortable by column header.
- **Open files:** double-click or Enter → `xdg-open`.
- **Context menu:** open, open with, delete, rename, copy path.
- **Navigate:** breadcrumb path clicks; back/up buttons; keyboard Up/Down to select.
- **Hidden files:** Ctrl+H toggle, remembered in state.
- **Sort:** click column; remembered in state.
- **Remember last folder** in app state across sessions.
- **Keyboard:** Enter opens; Delete deletes; F5 refreshes; Ctrl+L focus path input.

## Non-goals (v1)

- No cut/paste, no drag-to-copy, no batch ops.
- No file preview, no archive browsing, no permissions display.
- No favorites/bookmarks beyond sidebar quick-access.

## Stack

Tauri 2 + TypeScript + Vite + pnpm. `@krill-software/desktop-ui`
`mountChrome({layout:"app"})`. Rust: `fs` module from `krill-desktop-core`
+ `std::process::Command` for `xdg-open`.

## Window

Canonical krill dimensions: 1296 × 800 default, 720 × 445 minimum, centered.

## Milestones

1. **M1 — browse & ops.** *(this pass)* Sidebar quick-access, file list (name/size/type/date), open/delete/rename via context menu, state persistence.
2. **M2 — polish.** Search/filter, toggle hidden, column sorting, breadcrumb nav refinements.
3. **M3 — advanced.** Batch ops, drag-to-copy, archives, file preview.

> files starts on the proof-of-concept list in CLAUDE.md until the design bar is signed off. Don't release until it graduates.
