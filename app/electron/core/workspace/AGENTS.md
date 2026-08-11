---
aliases:
  - core-workspace
updated: 2026-08-11
description: >-
  Templates, agent.md rev, rebuild-index naming, createdDate immutable.
---

# `workspace/`

<!-- ↔ README.md — file map -->
<!-- ↔ workspace-template.ts — ../../workspace-template path depth -->
<!-- ↔ DEVELOPMENT.md — § Workspace templates -->

## Rules

1. **`rebuild-index.ts` is not a barrel** — only derived index / tree helpers. Do not turn it into `export *`.
2. **Template path depth** — compiled file lives under `core/workspace/`, so templates resolve via `../../workspace-template` (and `project-template`). Env overrides still win.
3. **`.pm/agent.md` rev** — bump the HTML comment `rev N` by hand when changing the product body of the factory file; do not tie to app semver.
4. **`workspace.ts` `createdDate`** — set once at create; never patch via UI / `WorkspacePatch` / hand edit.
5. Shipped skills under template `.agents/skills/core/` are create-time copy only — no product refresh on open.
