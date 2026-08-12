---
aliases:
  - core-sync
updated: 2026-08-12
description: >-
  OCC StaleWriteError transport across Electron IPC and HTTP 409.
---

# `sync/`

<!-- ↔ README.md — file map -->
<!-- ↔ detail-diff.ts — encode/parse SoT -->
<!-- ↔ electron/main.ts — IPC catch encode -->
<!-- ↔ server/main.ts — HTTP 409 -->
<!-- ↔ src/lib/bridge/http-pm.ts — reconstruct -->

## Rules

1. **`detail-diff.ts` owns** editable field sets and `StaleWriteError` wire format. Keep main IPC encode, server `sendError` 409, and `http-pm` reconstruct aligned.
2. Domain writers (`wiki` / `members` / `handoffs` / …) throw `StaleWriteError`; bridges translate — do not invent a second stale protocol.
3. Renderer imports: `@pm-core/sync/detail-diff`. Explicit save / leave UX lives in `src/lib/workspace/detail-save.ts` + `unsaved-leave.ts` (not here).
