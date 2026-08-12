---
aliases:
  - pm-all-in-one
  - local-pm
updated: 2026-07-31
description: >-
  Local-first project manager—fixed Project container + epic/task/subtask
  flat issue store (parentId + level in props.ts); opaque nanoid(21) ids;
  Electron shell with CLI terminals; dual PmApi (Electron + untested local web API).
hosting: in-tree
visibility: private
distributable: false
type: product-app
remote: null
members: []
---

# `pm-all-in-one/`

Local-first project manager for personal (and later small-team) developers who find Jira / MCP-backed PM too rigid and context-lossy.

| Path | Role |
| --- | --- |
| [[app/README\|app/]] | Electron + Vite + React desktop app (+ local web API skeleton) |
| [[app/src/components/markdown-editor/AGENTS\|app/src/components/markdown-editor/]] | App-local Markdown edit/preview module |
| `example-workspace/` | Filtered **local-pm workspace snapshot** (pm-all-in-one dogfood only). Open **that folder** in the app — not the product repo root. |

**`example-workspace/` is not product source.** Do not implement app features there, do not treat its nested `AGENTS.md` / `.agents/skills` as rules for editing `app/`, and do not open the product repo root as a PM workspace. The live dogfood library remains outside this repo (`new-world`); refresh the snapshot by copy/filter when shipping, not via submodule.

Dogfood PM library (outside repo): `/Users/wenchuanzhao/Documents/GitHub/new-world`. Durable product orientation lives there as wiki (and is mirrored in the example snapshot): nodes disk pattern `@wiki-WZ_eBxLpaAG_HYKecNZeW`; Electron vs server `@wiki-X-Z3_3kcrIQ--pNVQhzcw`.

**Source of truth:** the files under `issue-hierarchy/`. **Project** is a special container (`project.ts`); **issues** are epic → task → subtask (`props.ts` + `README.md`). Workspace root has `workspace.ts` + `README.md` (title / createdDate / Home body). Wiki-nodes live under `wiki/<id>/{props.ts,README.md}` with opaque `nanoid(21)` ids; **Contents** (`wiki/sidebar.ts` `ref` tree) is the required hierarchy — every wiki-node must appear there (All pages is the flat admin inventory of the same set); create always places into Contents (`parentId` optional, default root) — link with `@wiki-<id>`. Storage is **flat** — `issue-hierarchy/<projectId>/<issueId>/` — so `@issue-<projectId>::<issueId>` resolves to a path by joining those ids, with no index and no running app. Ids are **opaque `nanoid(21)` tokens** (URL-safe alphabet, e.g. `V1StGXR8_Z5jdHi6B-myT`); directory name = id and is never renamed. Hierarchy lives in `props.ts` as `parentId` + `level`, checked against each other at runtime. Disk pattern overview: dogfood `@wiki-WZ_eBxLpaAG_HYKecNZeW`. Issues also carry system `status` (`draft` | `todo` | `in-progress` | `done` | `cancel`; create default `draft`) and `priority` (`very-low` | `low` | `medium` | `high` | `very-high`; create default `medium`). Custom props are declared per project in `custom-props.ts`. Derived `.pm/index.json` and `.pm/tree.md` are rebuildable and gitignored. There is **no writer handle**, no `.pm/handles.json` / `.pm/members.ts`, and no per-handle counters — create (app or CLI) allocates ids via a single local draw; collab is git. Identity / assignee are not encoded in ids.

**Immutable:** `workspace.ts` `createdDate` is set once at workspace creation. Do **not** edit it in the UI, via `WorkspacePatch` / `updateWorkspace`, or by rewriting `workspace.ts` by hand (including agent edits). Title and README body remain editable. Wiki-node / project / issue `created` and `updated` are system fields (ISO-8601 UTC `…Z`): `created` is set once at create; `updated` is bumped only by the app on a real props or body write. Patches omit both keys; do not hand-edit them or declare them in `custom-props.ts`. Issue `status` and `priority` are also reserved (not custom props).

## Electron vs web (read this)

**Today we only trust Electron.** Daily smoke = `cd app && npm run dev` → use the **Electron window**, not the browser tab on `:5173`.

There is also a **local web path** (`npm run dev:web`: Vite + HTTP API on `:8787`). It shares the same React UI and the same `PmApi` contract (`getPm()` → Electron preload **or** HTTP client). **It exists so we can host later, but it is not the current test surface** — treat it as “shipped sketch, unproven.”

| Question | Short answer |
| --- | --- |
| Which one do I run? | **Electron** (`npm run dev`) |
| Why did the browser show `window.pm` / `/api` 500? | Browser ≠ Electron. Without `dev:web`, `:5173` has no API → proxy 500. That’s expected if you only started `dev`. |
| Do features need to work on web too? | **Don’t break the dual bridge.** Prefer changes in `electron/core/` + `PmApi` shape; if you add Electron-only IPC, mirror or stub it in `server/` + `src/lib/bridge/http-pm.ts`, or explicitly gate the UI for `platform === "web"`. You do **not** need to manually QA web every PR until we say so. |
| Terminals / Open folder? | Desktop-only for now. Web stubs or hides them on purpose. |

Details: [[app/DEVELOPMENT|app/DEVELOPMENT.md]].

## Vibe coding (agents)

Session discipline for vibe coding. Zone map: [[app/DEVELOPMENT|DEVELOPMENT]] § Vibe zones.

1. Declare **one zone per session**; do not cross (e.g. feature UI + `PmApi` in one go).
2. Contract changes (`PmApi` / `types` / disk law) = **separate session** from feature UI.
3. Dual bridge: prefer `electron/core/` + `PmApi`; mirror, stub, or gate in `server/` + `src/lib/bridge/http-pm.ts`.
4. When touching paired files, update **both** ends of file-header `↔` comments.
5. Daily QA = Electron (`npm run dev`), not bare `:5173`.
6. `src/lib/workspace/workspace-context.tsx` is the Zone 8 shell hub — orchestrate only; no new algorithms there.
7. Do not merge `src/lib` ↔ `electron/core` mirrors unless the session is an explicit Zone 2/3 refactor.

**Out of scope (still):** OpenAI SDK agent, production server deploy / auth / multi-tenant, SQLite index, comments/line anchors, kanban. (Local `dev:web` API ≠ “server deploy.”)

In-flight product work lives in dogfood issues (e.g. Prop「这是什么」+ Project settings → `@issue-blwwMj6xHRYLCWXfa9wwl::mg6bIUXfu0nW3PQjgWYUE`；UI 打磨 `@issue-blwwMj6xHRYLCWXfa9wwl::usNnrv-FvzXQN1IwgZ54q`).
Nodes (disk pattern): dogfood `@wiki-WZ_eBxLpaAG_HYKecNZeW`.
Electron vs server: dogfood `@wiki-X-Z3_3kcrIQ--pNVQhzcw`.
Save / leave contracts: dogfood `@wiki-n8_7zg25NlxwdV6nIBVcD`.
