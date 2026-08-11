---
aliases:
  - electron-core
  - zone-3-core
updated: 2026-08-11
description: >-
  Zone-3 filesystem SoT under electron/core/ — categorized subdirs; opaque
  nanoid ids; dual bridge; no public barrel; desktop ≠ server.
---

# `electron/core/` (Zone 3)

<!-- ↔ README.md — category map juniors read first -->
<!-- ↔ DEVELOPMENT.md — § Vibe zones / dual bridge -->

## Boundary

This tree owns **disk law and filesystem writes**. Do not change `PmApi` / preload / HTTP bridge shapes in the same session (Zone 2 / 4 / 5). Do not pile UI here.

## Hard rules

1. **Opaque ids** — directory name = `nanoid(21)`; never invent or rename by hand. Allocate via app or CLI.
2. **No public barrel** — do not add `core/index.ts` as a re-export hub. `workspace/rebuild-index.ts` is derived-index only.
3. **Category paths** — new modules go in the matching subdir; import as `../<cat>/<module>.js` or `@pm-core/<cat>/<module>`.
4. **Dual bridge** — shared modules must stay usable from Electron main **and** `server/`. Electron-only code belongs in [`desktop/`](desktop/) (`AGENTS.md` there).
5. **Bidirectional indexes** — related modules/docs use `// ↔ path — relation` on **both** ends; update both when moving.
6. **System fields** — do not hand-edit `created` / `updated` / workspace `createdDate`; writers bump `updated` only on real writes.

## Layout

See [`README.md`](README.md). Subdir law: `identity/`, `domain/`, `workspace/`, `sync/`, `desktop/` each have their own `AGENTS.md` where needed.
