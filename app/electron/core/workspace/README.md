# `electron/core/workspace/`

<!-- ↔ AGENTS.md — template / agent.md / index law -->
<!-- ↔ ../README.md — category map -->
<!-- ↔ DEVELOPMENT.md — § Workspace templates -->

Workspace lifecycle: create from shipped templates, open-time health (doctor), chokidar watch, app/settings + gitignored local config, and rebuild of derived `.pm/index.json` + `tree.md`.

**Who may import:** Electron main, server, CLI.

| File | Role |
| --- | --- |
| `rebuild-index.ts` | Derived `.pm/index.json` + `tree.md` (**not** a barrel) |
| `watch.ts` | Chokidar → rebuild + doctor payload |
| `doctor.ts` | Filesystem-shape stray scan + `scanWorkspace` (fence validators) |
| `fence-validators.ts` | Workspace-declared Markdown fence lint (opt-in module import) |
| `agent-md.ts` | `.pm/agent.md` rev stamp + drift vs factory |
| `scaffold-workspace.ts` | Create workspace from templates |
| `workspace-template.ts` | Resolve/copy `workspace-template/` + `project-template/` |
| `workspace-gitkeep.ts` | Keep `.gitkeep` in required empty dirs |
| `workspace-gitignore.ts` | Ensure local files listed in `.gitignore` |
| `local-config.ts` | Gitignored `.pm/local.json` (`me`, `trustFenceValidators`, …) |
| `settings.ts` | App-level `settings.json` (last workspace + Open Recent MRU) |
