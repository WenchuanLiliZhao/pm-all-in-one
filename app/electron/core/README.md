# `electron/core/`

<!-- ↔ AGENTS.md — Zone-3 law for this tree -->
<!-- ↔ DEVELOPMENT.md — § Vibe zones / dual bridge / templates -->

Filesystem source of truth for workspace data. Shared by Electron main, the local HTTP API (`server/`), and the CLI. The renderer reaches a few pure modules via `@pm-core/<category>/<module>`.

**There is no public barrel** (`core/index.ts`). Import by category path. Derived `.pm/index.json` lives in [`workspace/rebuild-index.ts`](workspace/rebuild-index.ts) — not a re-export hub.

## Categories

| Dir | Role | Who may import |
| --- | --- | --- |
| [`identity/`](identity/) | Ids, `@…` links, status/priority catalogs, ladder law, core types | Anyone (pure / SoT); renderer via `@pm-core/identity/*` |
| [`domain/`](domain/) | Entity CRUD writers (projects, issues, wiki, members, handoffs, …) | Electron main, server, CLI — not the renderer |
| [`workspace/`](workspace/) | Scaffold, templates, watch, doctor, settings, derived index | Electron main, server, CLI |
| [`sync/`](sync/) | OCC / autosave policy / delete-cost | Dual bridge + renderer (`@pm-core/sync/*`) |
| [`views/`](views/) | `.pm/views.json` + view-orders | Electron main, server; pure apply via `@pm-core/views/*` |
| [`desktop/`](desktop/) | PTY, CLI shim, git sync, asar esbuild binary | **Electron only** — server must not import |
| [`infra/`](infra/) | `props.ts` load/write, schema.d.ts, timestamps, esbuild runtime | Core internals + domain writers |

## Import conventions

```ts
// Inside core (cross-category)
import { isValidEntityId } from "../identity/dir-id.js";

// Electron / server / CLI
import { listIssues } from "./core/domain/store.js";

// Renderer (pure modules only)
import { applyViewOrder } from "@pm-core/views/view-order-apply";
```

Agent rules: [`AGENTS.md`](AGENTS.md).
