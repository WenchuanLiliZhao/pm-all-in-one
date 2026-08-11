# Local PM app

Desktop shell for **local-pm**: open a workspace folder (`issue-hierarchy/` + `.pm/`), edit issues in a three-pane UI, and run Cursor/Claude CLIs in embedded terminals.

**Use Electron to develop and smoke-test** (`npm run dev` → desktop window). A local web API + browser path also exists (`npm run dev:web`) but is **not** the current QA surface — see repo [[../AGENTS|AGENTS.md]] § Electron vs web.

## Layout

| Path | Role |
| --- | --- |
| `electron/` | Main process — IPC, menu, `node-pty` |
| `electron/core/` | Shared data core by category (`identity/`, `domain/`, …); also used by the web API |
| `server/` | Local HTTP + SSE API for browser / future host |
| `src/` | React renderer |
| `src/lib/bridge*` | `PmApi` — Electron preload or HTTP client |

## Quick start

```bash
cd app
npm install
npm run dev
```

Then **Open workspace…** and pick `/Users/wenchuanzhao/Documents/GitHub/new-world`.

See [[DEVELOPMENT|DEVELOPMENT.md]] for build/package notes (including `node-pty` rebuild and `dev:web`).
