# Files

A minimal file browser for Linux. One folder per window: sidebar shortcuts
to the XDG user folders and recent places, a clickable breadcrumb with Back
and Up, a sortable name / size / modified list, inline rename, and move to
trash. Files open with whatever the system already uses for them.

Part of the [krill](https://krill.software) suite. Landing page, downloads,
and install instructions: https://krill.software/files/

- **Browse:** breadcrumb segments are buttons; Backspace goes up; Ctrl+L
  types a path. The last folder and your sort order are remembered.
- **Act:** Enter or double-click opens; F2 renames inline; Delete moves to
  the freedesktop trash (never a permanent delete); Ctrl+Shift+C copies the
  path; Ctrl+H toggles hidden files.
- **Not in scope:** no tabs, no project tree, no cut/paste or drag-to-copy,
  no previews. Open a second window for a second folder.

Built with Tauri 2, TypeScript, and Rust on the shared
[`@krill-software/desktop-ui`](https://github.com/krill-software/desktop-ui)
chrome and [`krill-desktop-core`](https://github.com/krill-software/desktop-core).
See [SPEC.md](SPEC.md) for the design and milestones. MIT licensed.

## Develop

```sh
pnpm install
pnpm tauri dev      # opens your home folder, or pass a path
pnpm release        # AppImage + .deb under release/v<version>/
```
