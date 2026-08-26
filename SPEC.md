# Files — Spec (v1)

A minimal file browser for Linux. Sidebar quick-access (Home, Desktop, Documents, …) + main pane shows the folder's contents. One folder per window.

## Identity

| Field | Value |
|---|---|
| Slug (directory) | `files` |
| productName | `Files` |
| Binary | `krill-files` |
| Identifier | `software.krill.files` |
| Document | a folder path (CLI arg or `inode/directory` association) |
| State | `$XDG_STATE_HOME/krill-files/state.json` — last folder, hidden-files flag, sort, recent folders |
| Icon glyph | Lucide `folder-open` |

## The idea

A desktop file browser that does one thing: browse a folder and operate on its files. Not a project tree, not a sidebar vault. One window = one folder. Open a new window to browse another folder in parallel.

## Layout — app shell (mountChrome layout: "app")

No titlebar or status line. Aux pane (left sidebar) carries quick shortcuts; main pane shows folder contents.

- **Aux (sidebar):**
  - Quick-access shortcuts (Home + the XDG user dirs that exist)
  - Recently opened folders (below, only when there are any)
- **Main topbar:** back / up buttons, breadcrumb path (clickable segments, ellipsizes from the left), item count + total size at the right.
- **Main:** sticky column header (name / size / modified — click to sort) over the file list.
- **Interactions:** double-click or Enter opens (folders navigate, files go to `xdg-open`); right-click → context menu; hamburger menu mirrors every shortcut.

## M1 — browse & basic ops *(done)*

- **Sidebar shortcuts:** Home, Desktop, Documents, Downloads, Music, Pictures, Videos (via XDG user dirs; missing ones are skipped); recently opened folders auto-added; click to navigate.
- **File list:** icon, name, size, modified; folders first; sortable by column header, remembered in state.
- **Open files:** double-click or Enter → `xdg-open`.
- **Context menu:** open, rename, move to trash, copy path.
- **Navigate:** breadcrumb clicks; back / up buttons; Backspace = up; keyboard Up/Down/Home/End to select.
- **Rename:** F2 → inline editor on the row (stem preselected). Enter commits, Escape cancels.
- **Trash, never delete:** Delete key / context menu moves to the freedesktop trash. No confirmation — it's recoverable.
- **Hidden files:** Ctrl+H toggle, remembered in state.
- **Go to folder:** Ctrl+L swaps the breadcrumb for an editable path (`~` expands).
- **Remember last folder** across sessions; a CLI folder argument wins; a folder that no longer opens falls back to Home.
- **Errors** (unreadable folder, failed op) show inline — error placeholder in the list area, one-line message in the topbar status — never a dialog.
- **Keyboard:** Enter opens; Delete trashes; F2 renames; F5 refreshes; Ctrl+Shift+C copies path; Alt+Left back; Alt+Up up.

## Non-goals (v1)

- No cut/paste, no drag-to-copy, no batch ops.
- No file preview, no archive browsing, no permissions display.
- No favorites/bookmarks beyond sidebar quick-access.

## Stack

Tauri 2 + TypeScript + Vite + pnpm. `@krill-software/desktop-ui`
`mountChrome({layout:"app"})`. Rust: `fs` + `state` from `krill-desktop-core`,
`dirs` for XDG user dirs, `trash` for deletion, `arboard` for the clipboard,
`std::process::Command` for `xdg-open`. Lucide glyphs via the `lucide` package.

## Window

Canonical krill dimensions: 1296 × 800 default, 720 × 445 minimum, centered.

## Milestones

1. **M1 — browse & ops.** *(done)* Everything above.
2. **M2 — polish.** Type-to-filter (desktop-ui `buildFilterInput`), "Open with…", mounted volumes in the sidebar, multi-select.
3. **M3 — advanced.** Batch ops, drag-to-copy, archives, file preview.

> files is on the proof-of-concept list in CLAUDE.md until the design bar is signed off. Don't release until it graduates.
