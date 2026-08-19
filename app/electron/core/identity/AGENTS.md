---
aliases:
  - core-identity
updated: 2026-08-11
description: >-
  Opaque nanoid(21) ids, @-locators, status/priority catalogs, ladder law.
---

# `identity/`

<!-- ↔ README.md — file map -->
<!-- ↔ ../AGENTS.md — Zone-3 root law -->

## Rules

1. **Never invent or rename** entity directory ids. `dir-id` / `ids` allocate; callers only consume.
2. **Catalogs are SoT** — `issue-status` / `issue-priority` here; keep `src/lib/issue-*.ts` and UI chrome in sync (do not collapse).
3. **Keep pure** — prefer no Node filesystem side effects except id allocation under known roots (`ids.ts`) and `.gitkeep` on those required empty dirs.
4. Renderer imports use `@pm-core/identity/<module>` (e.g. `ladder`, `dir-id`, `ai-locator`, `links`).
