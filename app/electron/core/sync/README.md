# `electron/core/sync/`

<!-- ↔ AGENTS.md — OCC / StaleWrite transport -->
<!-- ↔ ../README.md — category map -->

Optimistic concurrency and related pure helpers shared across writers and the dual bridge.

**Who may import:** Electron main, server, HTTP client, renderer (`@pm-core/sync/*`).

| File | Role |
| --- | --- |
| `detail-diff.ts` | Editable slices + `StaleWriteError` encode/parse |
| `autosave-policy.ts` | Pure autosave decide (idle / hold / wait / save) |
| `delete-cost.ts` | Descendant counts via `parentId` graph |
