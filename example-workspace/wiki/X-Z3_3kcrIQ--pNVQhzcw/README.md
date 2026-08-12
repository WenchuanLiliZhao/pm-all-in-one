Whenever the question is “is the server a different product?” or “can today’s foundation host as-is?” — read this first.

Storage and node shape: @wiki-WZ_eBxLpaAG_HYKecNZeW. Current identity / roster truth: @wiki-7j0Ak3N2wsnQodOSxSzZ9.

## One sentence

**Same product data and API contract; two different stories for “how it is hosted” and “who is authorized to change it.”**

Not two unrelated products, and not “open a webpage in Electron and it becomes a server.”

## Comparison

| Dimension | Electron (current main path) | Server (later) |
| --- | --- | --- |
| Where truth lives | Files in a local workspace directory | Usually the same-shaped workspace tree, on storage the server can reach |
| How people sync | **git push / pull** (GitHub etc. are only remotes) | **HTTP API + authorization**; not everyone necessarily clones |
| Who can change shared content | Anyone with remote write access (SSH / credentials) | Anyone authorized through login and a permission model |
| “Current user” | **No app-level login**; local `me` in `.pm/local.json`; git commit author is historical residue | **Real auth** (session / OAuth / …) → authorize by visitor |
| Entry action | Open a local workspace directory; create allocates nanoid via app/CLI | **Login / OAuth** (verifiable subject) |
| UI / core | `PmApi` + `electron/core/` | Same `PmApi` shape + same core; swap auth middleware and hosting layer |
| Status today | Trusted daily path (`npm run dev`) | `dev:web` is an under-proven skeleton; **multi-visitor / real auth not done** |

## Electron: local + git collab (how it works)

Fit: individuals or small teams; each clones the same repo and opens the local directory in Electron.

1. Clone / pull the workspace.
2. Create project / issue / wiki-node / member / handoff via app or CLI — draw opaque `nanoid(21)` locally; no Writer setup.
3. Commit + push; resolve conflicts like any git directory merge (new-id dirs usually do not collide).
4. The real security boundary is **git credentials / remote write access**, not an identity panel in the app.

Member / assignee / `createdBy` are **facts on disk** (see @wiki-7j0Ak3N2wsnQodOSxSzZ9); they are **not** an app login gate.

## Server: “stack on” vs “replace” the current foundation

### Reuse as-is (stack)

- Workspace file contract: `issue-hierarchy/`, `props.ts`, opaque nanoid ids, `@issue-…` / `@wiki-…` / `@member-…` / `@handoff-…` references
- `electron/core/` read/write logic and `PmApi` method shape (create / list / patch / …)
- React UI (via HTTP bridge)

### Must replace (do not pretend to stack)

**Multi-visitor hosting needs real authentication and per-request authorization.**

For Electron, “one machine opens one local directory + git” is the correct model.  
For a multi-visitor server you must:

1. Add real auth (session / OAuth / …)
2. Attach “current visitor” to **every request**, not a process-level / machine-level userData pseudo-identity
3. Not cache “current user” at module top level

### Mental models not to mix

| Wrong claim | Right claim |
| --- | --- |
| Electron already has login | Electron has **no** app login; 1.0 collab is git; members are roster facts |
| Both sides are equally secure | Electron relies on git permissions; server relies on authz |
| Shipping server only needs a Login page | You must also replace hosting and per-visitor authorization |
| `dev:web` is already a hosted product | Skeleton only; not validated for multi-tenant |

## Decision checklist for later

When someone proposes “unify on login,” ask first:

1. Is the goal **flows that look the same**, or **the same trust model**? The former can be UI; the latter requires server auth.
2. Is it still OK for Electron to rely on **git credentials and no app password**? If not, you already want a different product shape.
3. Does the change write “current user” into a module singleton / global? If yes, it blocks later session mapping.

## Related code entry points (product repo)

| Topic | Location |
| --- | --- |
| Id allocation | `app/electron/core/ids.ts` / `dir-id.ts` |
| Layout rejects legacy | `app/electron/core/store.ts` (`assertSupportedLayout`) |
| HTTP skeleton | `app/server/main.ts`, `src/lib/bridge/http-pm.ts` |

## Do not

- Do not revive Writer setup / handle / roster counters as the 1.0 identity scheme (member nodes ≠ writer handles).
- Do not assume the server can keep using userData as “current user.”
- Do not sacrifice bare CLI/agent read ability for “mental-model unity” unless the product explicitly changes that stance.
