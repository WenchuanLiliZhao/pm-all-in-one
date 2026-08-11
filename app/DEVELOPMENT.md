# Development

## Requirements

- Node.js ≥ 20
- macOS (primary target for Electron; `node-pty` needs a native rebuild against Electron)

## Scripts

| Command | What |
| --- | --- |
| `npm install` | Installs deps; `postinstall` runs `electron-rebuild -f -w node-pty` |
| `npm run build:electron` | Compile `electron/` → `dist-electron/` (+ preload `.cjs`) and copy workspace/project templates |
| `npm run build:server` | Compile HTTP API (`server/` + `electron/core/`) → `dist-server/` and copy templates |
| `npm run dev` | Vite (5173) + tsc watch + Electron (`window.pm` via preload) |
| `npm run dev:web` | Vite **UI** (`http://127.0.0.1:5173/`) + HTTP API (`:8787`); open **5173**, not 8787 |
| `npm run build` | Typecheck renderer + Vite production build |
| `npm run build:cli` | Assemble the standalone CLI package → `dist-cli/` (see § CLI distribution) |
| `npm run package:mac` | electron-builder mac targets |

## UI Lab (dev only)

DEV design harness at `#/lab/*` (sidebar + per-component routes). Open via **Dev → UI Lab**, `Cmd/Ctrl+Shift+D`, or Welcome — Electron side window / web new tab. Lab renders **real** `@/components/ui/*` components. Global tokens live under self-contained `src/global-styles/` (see `src/lab/AGENTS.md`).

## Electron vs browser

**Default / trusted path = Electron.** Run `npm run dev` and use the desktop window. Do not treat the browser tab on `:5173` as the app unless you also started the API.

| Command | What you get | Test status |
| --- | --- | --- |
| `npm run dev` | Vite + Electron; `window.pm` via preload | **Current QA surface** |
| `npm run dev:web` | Vite + HTTP API (`:8787`); browser uses HTTP `PmApi` | **Exists, not daily-tested yet** |

- **Electron** — IPC → filesystem + `node-pty`.
- **Browser** — no preload; `getPm()` → HTTP client; Vite proxies `/api` → `8787`. Fixed workspace via `LOCAL_PM_WORKSPACE` (default `/Users/wenchuanzhao/Documents/GitHub/new-world`). No folder picker / no real terminal yet.

**Agent rule of thumb:** keep the dual bridge intact when changing data or IPC (shared `electron/core/`, mirror or stub in `server/` + `src/lib/bridge/http-pm.ts`, or gate UI for web). Product law + FAQ: repo root [[../AGENTS|AGENTS.md]] § Electron vs web.

| Env | Default | Meaning |
| --- | --- | --- |
| `LOCAL_PM_WORKSPACE` | `/Users/wenchuanzhao/Documents/GitHub/new-world` | Workspace path (relative to `app` cwd, or absolute) |
| `LOCAL_PM_API_PORT` | `8787` | API listen port |
| `LOCAL_PM_USER_DATA` | `(tmpdir)/local-pm-web` | Settings dir when not running under Electron |
| `LOCAL_PM_WORKSPACE_TEMPLATE` | (compiled sibling) | Override path to `workspace-template/` (tests / special builds) |
| `LOCAL_PM_PROJECT_TEMPLATE` | (compiled sibling) | Override path to `project-template/` |

Auth and remote terminals are out of scope for this slice.

## `node-pty` / Electron ABI

`node-pty` is a native addon. After install (or Electron version bumps), rebuild if terminals fail to spawn:

```bash
npx electron-rebuild -f -w node-pty
```

If rebuild fails, ensure Xcode CLT are installed (`xcode-select --install`).

## Workspace contract

A workspace is any folder with:

```text
workspace.ts         # title, createdDate
README.md            # workspace body (Home)
wiki/                # <nanoid(21)>/{props.ts,README.md} + sidebar.ts (nav SoT)
.pm/                 # views, derived index + tree.md
issue-hierarchy/     # <projectId>/<issueId>/ — flat (props.ts + README.md)
```

Dogfood library: `/Users/wenchuanzhao/Documents/GitHub/new-world`. Nodes / wiki disk pattern: `@wiki-WZ_eBxLpaAG_HYKecNZeW`. Electron vs server: `@wiki-X-Z3_3kcrIQ--pNVQhzcw`.

## Workspace templates

Create-time seeding is a **verbatim copy** of on-disk folders (not TS string literals):

```text
electron/workspace-template/   # → new workspace root
  AGENTS.md
  .pm/agent.md                 # product-owned mechanical law (rev stamp)
  .agents/skills/
    pm-content-placement/      # editorial: project / epic / wiki placement
    pm-create-skill/           # how to add user skills under .agents/skills/
  …
electron/project-template/     # → issue-hierarchy/<allocatedId>/ when seedProject is set
```

`scaffoldWorkspace` copies the tree, then patches only dynamic bits (`workspace.ts` title/createdDate, `.pm/views.json`, seed `project.ts` + `schema.d.ts`). The app does **not** rewrite harness files on open. Shipped skills under `.agents/skills/` are **user-owned from create** (no product refresh). Only `.pm/agent.md` is product-owned.

- Build: `scripts/copy-templates.mjs` runs after `tsc` in `build:electron` / `build:server` (tsc never emits non-`.ts` assets). Dot dirs (`.agents/`, `.pm/`) copy fine — both the build script and `copyTemplateTree` use recursive `readdir`.
- Runtime resolver: `electron/core/workspace-template.ts` (`import.meta.url` sibling; asar-safe hand copy). Drift check: `electron/core/agent-md.ts` ↔ `doctor.ts` (`agent-md-modified` / `agent-md-outdated`).
- **Rev stamp:** first line of template `.pm/agent.md` is `<!-- local-pm agent.md rev N — … -->`. When you change the **product body** of that file, bump `N` by hand. Do not tie it to app semver.
- **Dev caveat:** editing a template while `npm run dev` is running requires re-running `build:electron` — the tsc watchers do not copy templates.
- **House rule:** anything you put in the template folder lands in every new workspace. No scratch README/notes inside it.
- **Known side effect:** Cursor discovers nested `.agents/skills/` under `electron/workspace-template/` (and under `dist-electron/workspace-template/` after build) as skills of the **app repo**, scoped to that subtree. Noise is local; do not "fix" it by renaming the template path (keeps create-time copy a pure tree copy).

## CLI distribution

`.pm/agent.md` tells agents to allocate ids through `pm-all-in-one`. That command has to be reachable from wherever the agent runs, which is usually **not** the app's built-in terminal, so there are two channels.

**With the app.** `ensureLocalPmShim` writes a `/bin/sh` shim into `userData/bin` on every launch (`ELECTRON_RUN_AS_NODE=1` + the app's own Electron binary running `cli.js`). `PtyManager` prepends that dir to the PATH of terminals the app spawns — which is why `pm-all-in-one` works there and nowhere else. **File → Install Command Line Tool…** symlinks the shim into `/usr/local/bin` when writable, else `~/.local/bin`, and reports when the chosen dir is not on PATH. The link points at the userData shim rather than into the app bundle, so it survives app moves and upgrades (each launch rewrites the shim in place). It refuses to overwrite a file at that path that it did not generate — see `core/cli-install.ts`.

**Without the app.** The CLI is pure Node: its import graph reaches no Electron module and its only third-party deps are `esbuild`, `nanoid`, and `zod`. `npm run build:cli` walks the graph from `dist-electron/cli.js`, copies just those modules plus both templates into `dist-cli/`, and generates a `package.json` with a `bin` entry for the public npm package **`pm-all-in-one`**, so anyone with Node can run `npx pm-all-in-one …` without the desktop app. Publish steps and version policy live in [`docs/releasing.md`](../docs/releasing.md).

- The graph walk is what keeps Electron-importing siblings (`core/settings.ts`) out of the package. Dependency versions are read from app `package.json`; the build fails rather than guessing if the CLI grows an import that is not declared there.
- Workspace addressing without the app: `--workspace <path>`, then `LOCAL_PM_WORKSPACE`, then an upward search from cwd.
- `dist-cli/` is a build artifact and gitignored. Package name on the registry is bare `pm-all-in-one` (command name matches). Bare `local-pm` was rejected by npm as too similar to `local-pkg`.
- Windows has neither channel yet: the shim is `/bin/sh` and the menu item is hidden there.

## Package weight (`dependencies` vs `devDependencies`)

electron-builder copies **every production `dependency`** into `app.asar` regardless of `build.files`. Vite already bundles the renderer into `dist/`, so a renderer package listed under `dependencies` ships **twice** and the second copy is never required at runtime.

`dependencies` is therefore exactly the runtime import surface of `electron/` — verify with `rg -o --no-filename 'from "[^".][^"]*"' electron --glob '*.ts'`:

| Dep | Used by |
| --- | --- |
| `zod` | `core/custom-props.ts`, `props-load.ts`, `timestamps.ts`, `views.ts`, `view-orders.ts`, `wiki.ts` |
| `esbuild` | `core/props-load.ts`, `core/wiki.ts` (evaluates `props.ts`) |
| `nanoid` | `core/ids.ts`, `core/views.ts` |
| `chokidar` | `core/watch.ts` |
| `node-pty` | `core/pty.ts` (native; stays unpacked) |

Everything else — React, CodeMirror, xterm, lucide, highlight.js, fontsource, the remark/mdast tree — belongs in `devDependencies`. Moving them there took the DMG from 127M to 108M and the installed app from 334M to 269M (`app.asar` 75M → 11M). **Do not promote a renderer package to `dependencies` to make an import resolve** — that is a bundler question, not a packaging one.

`build:cli` reads versions from `dependencies`, so the CLI's `esbuild` / `nanoid` / `zod` must stay there.

### esbuild inside `app.asar`

esbuild spawns a platform executable, and `spawn` cannot run a path inside the asar archive — a packaged app fails `ENOTDIR` on the first `props.ts` it evaluates, which is `openWorkspaceAt` → `ensureMembers`. `core/esbuild-binary.ts` points `ESBUILD_BINARY_PATH` at the `app.asar.unpacked` copy, and `core/esbuild-runtime.ts` is the only module that imports `esbuild`, with `./esbuild-binary.js` declared first because esbuild captures that variable when its module body loads. Two files rather than one because the CLI packager reads compiled JS and only follows `from "…"` edges: a bare side-effect import would not be copied, and a type-only import of `esbuild` would be erased and drop the dependency from the published package.

Smoke test after any packaging change — this must print `OK`, not `spawn ENOTDIR`:

```sh
APP="release/mac-arm64/pm all in one.app"
ELECTRON_RUN_AS_NODE=1 "$APP/Contents/MacOS/pm all in one" \
  "$APP/Contents/Resources/app.asar/dist-electron/cli.js" doctor --workspace <path>
```

## Architecture notes

- Files are the source of truth; the JSON index is a cache.
- Issues are stored **flat**: `issue-hierarchy/<projectId>/<issueId>/`, so `@issue-<p>::<i>` resolves to a path with no index and no running app. Directory names are opaque `nanoid(21)` ids and are never renamed.
- Hierarchy lives in `props.ts`: `parentId` is the only authority for the tree, and `level` (epic → task → subtask) is stated alongside it. When the two disagree, both are kept and a violation is reported — see `core/ladder.ts` and dogfood `@wiki-WZ_eBxLpaAG_HYKecNZeW`.
- `npm test` builds electron and runs `node --test` over `dist-electron/core/*.test.js`.
- CLI / external edits are picked up via `chokidar` → rebuild → Electron IPC `pm:changed` or web SSE `changed`.

## Vibe zones (session boundaries)

For vibe coding (one human + AI): treat roles as **session zones**, not packages. One session → one zone; never change `PmApi` / disk law in the same session as feature UI.

| Zone | Owns |
| --- | --- |
| 1 Spec | Repo `AGENTS.md`; durable orientation in dogfood wiki (`@wiki-WZ_eBxLpaAG_HYKecNZeW`, `@wiki-X-Z3_3kcrIQ--pNVQhzcw`) |
| 2 Contract | `src/lib/types.ts`, `src/lib/bridge/pm-api.ts` (+ OCC slice types from `@pm-core/detail-diff`) |
| 3 Core | `electron/core/*` (filesystem SoT; also `@pm-core/*` Vite/TS alias) |
| 4 Desktop | `electron/main.ts`, `electron/preload.cts`, pty / packaging |
| 5 Web bridge | `server/main.ts`, `src/lib/bridge/http-pm.ts` |
| 6 Design system | `src/components/ui/`, `src/global-styles/`, `src/lab/` |
| 7 Markdown | `src/components/markdown-editor/`, `src/lib/markdown/` |
| 8 Feature / shell | `src/pages/`, feature components; **shell hub** `src/lib/workspace/workspace-context.tsx` (orchestrates only — do not pile logic) |

**Dual bridge (must stay paired):** `pm-api.ts` ↔ `preload.cts` ↔ `http-pm.ts`; IPC handlers in `electron/main.ts` ↔ HTTP in `server/main.ts`; entry `src/lib/bridge.ts` (`getPm`). Stale-write transport: `electron/core/detail-diff.ts` encode/parse ↔ main IPC catch ↔ `server` `sendError` 409 ↔ `http-pm` reconstruct. Code comments use `// ↔ path — relation` on both ends.

### Mirror / alias inventory (do **not** merge this pass)

| Renderer / client | Core / twin | Notes |
| --- | --- | --- |
| `src/lib/types.ts` | `electron/core/types.ts` | Hand-mirrored Zone-2 IPC shapes; core splits `EntityId` / ladder / doctor — sync on contract change, **do not collapse** |
| `src/lib/types.ts` | `electron/src/lib/types.ts` | Orphan Electron-root twin of renderer types (no runtime importers) |
| `src/lib/issue-status.ts` | `electron/core/issue-status.ts` | Builtin status catalog; SoT in core |
| `src/lib/issue-status.ts` | `electron/src/lib/issue-status.ts` | Orphan twin of renderer |
| `src/lib/ai-locator.ts` | `electron/core/ai-locator.ts` | Thin re-export via `@pm-core/ai-locator` |
| `src/lib/workspace/slugify-folder.ts` | `electron/core/slugify-folder.ts` | Hand-copy; body identical |
| `src/lib/workspace/delete-cost.ts` | `electron/core/delete-cost.ts` | **Sibling APIs** (tree walk vs `parentId` graph) — related, not byte-sync |
| _(no `src/lib` twin)_ | `electron/core/detail-diff.ts` via `@pm-core/detail-diff` | Shared core / contract-adjacent; not a third bridge |

Do **not** unify mirrors into one file or delete `electron/src/lib` in a comment-only tidy — that is a Zone 2/3 refactor.
