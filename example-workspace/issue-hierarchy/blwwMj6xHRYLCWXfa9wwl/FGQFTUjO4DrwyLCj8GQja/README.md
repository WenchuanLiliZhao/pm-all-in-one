## Decision (landed)

User-customizable conventions are **Agent Skills** under `.agents/skills/<name>/SKILL.md`, not a new node type and not a frontend Rules UI.

### Split

1. **Product / non-custom** — `.pm/agent.md` holds **mechanical** disk law only (ids, locators, hierarchy, create/move, timestamps, mentions). First line is `<!-- local-pm agent.md rev N -->`. `local-pm doctor` reports `agent-md-outdated` / `agent-md-modified` (detection only; no auto-refresh yet). Root `AGENTS.md` stays a thin IDE entry.
2. **User / custom** — conventions live as skills. Hosts discover `.agents/skills/` and load bodies via each skill’s `description`. Do not edit `AGENTS.md` / `.pm/agent.md` to add them (see skill `pm-create-skill`).

### What moved out of `.pm/agent.md`

The editorial section **What goes where (project / epic / wiki)** ships as skill `pm-content-placement` (user-owned from create). Template also ships `pm-create-skill`.

### Explicit non-goals (this pass)

- No fifth node type (`@rule-…` / prompt nodes)
- No Workspace Settings / Rules channel UI
- No multi-copy sync to `.cursor/skills` / `.claude/skills` (single tree: `.agents/skills/`)
- No automatic refresh of `.pm/agent.md` on open

Context: create-only template copy under `electron/workspace-template/`; app does not inject in-app system prompts.

## Done this week (2026-08-03 → 2026-08-08)

- @issue-blwwMj6xHRYLCWXfa9wwl::2wH6lkVOkcfZ9_tDu4jdj — split editorial policy into `pm-content-placement`
- @issue-blwwMj6xHRYLCWXfa9wwl::HCzgt18HYIwW-WfstOSxY — `pm-create-skill` + thin `AGENTS.md`
- @issue-blwwMj6xHRYLCWXfa9wwl::JSxcMlecCS57WbgMBwYE- — rev stamp + doctor drift warnings
- @issue-blwwMj6xHRYLCWXfa9wwl::THuQ1LDMcqfMl2uvavQpc — tests / docs / QA
- @issue-blwwMj6xHRYLCWXfa9wwl::Jzng9PSZ2y-_YavGHMeN7 — dogfood migrate + wiki updates
