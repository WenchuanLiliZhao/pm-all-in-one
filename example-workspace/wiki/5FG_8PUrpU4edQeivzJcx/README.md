Browser `localStorage` holds **machine-local UI chrome preferences** for the Electron renderer (same origin for a given install). It is not product source of truth, not member data, and not a place for secrets.

Related identity facts live on disk under `members/` and `.pm/local.json` (`me`) — see @wiki-7j0Ak3N2wsnQodOSxSzZ9. Fold / view state must not be written into `members/<id>/`.

## Inventory

| Key | Value | Owner | Purpose | Scope notes |
| --- | --- | --- | --- | --- |
| `pm.markdown-editor.borderless-mode` | `"live"` \| `"source"` | `src/components/markdown-editor/markdown-editor.tsx` | Remember Live vs Source for borderless editor hosts | Global to the app origin; illegal / missing → `"live"`. Editor-own escape hatch — not `.pm/local.json` without a Zone 2/3 session. |
| `pm.roadmap.collapsed` | JSON array of tree node keys (`projectId` or `projectId::issueId`) | `src/pages/.../roadmap/index.tsx` | Persist Roadmap expand/collapse fold set across reloads | Skips writes while a label drag forces temporary collapses. Empty / corrupt → all expanded. Not workspace-partitioned today. |
| `pm.roadmap.zoom-level` | `"week"` \| `"month"` \| `"quarter"` | `src/pages/.../roadmap/index.tsx` | Persist Roadmap timeline zoom across reloads | Illegal / missing → `"month"`. Not workspace-partitioned today. |
| `pm.wiki.contents.collapsed` | JSON array of Contents fold keys (wiki-node id or `group:…`) | `src/lib/wiki-contents-collapse.ts` + `wiki-shell` | Persist Wiki Contents expand/collapse across reloads | Skips writes while a Contents drag forces temporary collapses. Missing → derive from default expand depth. Not workspace-partitioned. |
| `pm.wiki.contents.defaultExpandDepth` | non-negative integer string | Settings + `wiki-contents-collapse.ts` | Default nesting depth shown in Contents (0 = top-level only) | Changing the setting re-applies depth and overwrites the collapsed set. Illegal / missing → `1`. |

Reads and writes use `try/catch` so private-mode or disabled storage fails soft.

## Do not put here

| Kind | Put it in instead |
| --- | --- |
| Shared roster / assignee / createdBy facts | `members/`, issue / project / wiki props (git) |
| “Who I am on this machine” | `.pm/local.json` `me` (gitignored) |
| Machine path tables (e.g. repo checkouts) | `.pm/local.json` (planned / gitignored) |
| Freeform machine path notes for AI | `.pm/local.md` (gitignored) — see @wiki-YbNSJCTtN-d33xG4h4N6D |
| Shared view definitions / sibling order | `.pm/views.json`, `.pm/view-orders.json` |
| Secrets, tokens, credentials | OS keychain / never the workspace |

## Related (not `localStorage`)

| Store | Key | Purpose |
| --- | --- | --- |
| `sessionStorage` | `pm.shell.routerHistoryLength` | Electron shell back/forward stack length for the session |

When adding a new `localStorage` key: prefer the `pm.<area>.<name>` prefix, document it in this table in the same change, and keep values non-sensitive UI state only.
