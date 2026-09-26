# Changelog

## Unreleased

## 0.2.17

- Node body file is `body.md`, not `README.md`: Open in pm-all-in-one and the PM Node editor bind to `body.md`; opening a workspace renames legacy `README.md` bodies. `README.md` is now always an ordinary Markdown document. Requires app / CLI 0.1.12 or later on the same tree
- Theme adapter redesigned: neutrals, hover, grid and status washes are derived from a few Cursor seeds (`editor.foreground` / `editor.background`, `textLink`, `errorForeground`, `editorWarning`, `charts.green`) with `color-mix()` at the product’s own ramp percentages, so surface / border / text hierarchy is monotone in every theme; inverse surfaces (toast, selected menu row, fill button, switch) are monochrome again instead of `button.background`; blue is reserved for links / in-progress
- Catalog webview rows are flat with a hairline edge (no longer painted with `list.inactiveSelectionBackground`)

## 0.2.16

- Open pm-all-in-one map opens a catalog webview (not QuickPick) when the folder contains several libraries; click a row to open that map

## 0.2.15

- Explorer second group: Open in pm-all-in-one (unchanged) and Open pm-all-in-one map (always the map webview)

## 0.2.14

- Open in pm-all-in-one from Explorer empty space / any folder (and from the Command Palette with no PM file selected): list outermost `.pmws` workspaces, then open the map

## 0.2.13

- Clarify that `assets/**/README.md` is ordinary Markdown with a `#` title (node README stays body-only)

## 0.2.12

- Open a `.pmws` workspace as Cursor Custom Editor tabs (map + node)
- Follow the Cursor color theme (`--color-use--*` remapped to `--vscode-*` in the webview)
- New PM Workspace… from Explorer; Open in pm-all-in-one from `.pmws` and node README files
