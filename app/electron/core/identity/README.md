# `electron/core/identity/`

<!-- ↔ AGENTS.md — id / catalog law -->
<!-- ↔ ../README.md — category map -->

Pure-ish identity and hierarchy law: opaque entity ids, `@issue-` / `@wiki-` / `@member-` / `@handoff-` shapes, builtin status/priority catalogs, ladder placement, and the core type SoT.

**Who may import:** Electron, server, CLI, and the renderer (via `@pm-core/identity/*` for selected modules).

| File | Role |
| --- | --- |
| `dir-id.ts` | nanoid(21) grammar + legacy rejection |
| `ids.ts` | Allocate unique ids under workspace roots; `.gitkeep` on required empty dirs |
| `links.ts` | Parse/emit `@…` locators |
| `ai-locator.ts` | “Copy for AI” plaintext locators |
| `issue-status.ts` / `issue-priority.ts` | Builtin catalogs (SoT) |
| `ladder.ts` | epic → task → subtask placement rules |
| `deps.ts` | `blockedBy` normalize / cycle / prune |
| `types.ts` | Core data-layer type SoT (hand-mirrored in `src/lib/types.ts`) |
| `slugify-folder.ts` | ASCII folder segment from title |
