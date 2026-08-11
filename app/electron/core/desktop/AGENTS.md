---
aliases:
  - core-desktop
updated: 2026-08-11
description: >-
  Electron-only core — server/web and CLI package must not import this folder.
---

# `desktop/`

<!-- ↔ README.md — file map -->
<!-- ↔ local-pm-shim.ts — ../../cli.js path depth -->
<!-- ↔ DEVELOPMENT.md — § CLI distribution / esbuild asar -->

## Rules

1. **`server/` and `build:cli` must not import this folder.** Keep Electron/`node-pty`/asar concerns here so the CLI graph stays pure Node.
2. **Path depth** — modules live one level deeper than old flat `core/`: shim resolves `cli.js` via `../../cli.js`; do not “fix” by pointing into `app.asar` for the CLI link target.
3. Git sync / PTY are desktop product surfaces — mirror or stub at the `PmApi` / HTTP layer if the UI needs a web gate, do not pull these modules into `server/main.ts`.
