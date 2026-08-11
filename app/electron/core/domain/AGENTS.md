---
aliases:
  - core-domain
updated: 2026-08-11
description: >-
  Disk entity writers — OCC via sync/detail-diff; no hand-edited timestamps.
---

# `domain/`

<!-- ↔ README.md — file map -->
<!-- ↔ ../sync/AGENTS.md — OCC transport -->
<!-- ↔ ../infra/timestamps.ts — created/updated helpers -->

## Rules

1. **Writes go through these modules** — do not patch `props.ts` / README from UI or agents by inventing parallel writers.
2. **OCC** — update paths that take `expected` use slices from [`../sync/detail-diff.ts`](../sync/detail-diff.ts); throw `StaleWriteError` on conflict.
3. **System timestamps** — set `created` once; bump `updated` only on real props/body writes. Patches omit both keys.
4. **Workspace `createdDate`** is immutable (see workspace meta / product law).
