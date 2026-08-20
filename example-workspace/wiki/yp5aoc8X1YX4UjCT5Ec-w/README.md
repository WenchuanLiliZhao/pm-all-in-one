This note explains how **Project** and the three-level issue ladder (epic → task → subtask) are defined in pm-all-in-one, and why that design makes structural mistakes discoverable instead of silently “fixed.”

Create path and soft rules: @wiki-D9Sd2WYlM-2hdgcXcUbhl; node pattern overview: @wiki-WZ_eBxLpaAG_HYKecNZeW; workspace law: `.pm/agent.md`.

## Overview

| Layer | What it is | Where it lives |
| --- | --- | --- |
| **Project** | Special container (responsibility domain / portfolio), **not** a rung on the issue ladder | `issue-hierarchy/<projectId>/` + `project.ts` |
| **Epic** | Top-level campaign (why now / scope / done criteria) | Flat issue directory + `props.ts` |
| **Task** | Breakdown inside a campaign | Same |
| **Subtask** | One step finer | Same |

The fixed ladder is three levels only:

```text
epic → task → subtask
```

These are **ladder ranks** (epic / task / subtask). Do not invent a fourth level, and do not write `level` as concerto/movement/phrase (legacy musical aliases).

## Hierarchy is not directory nesting

Issues on disk are **flat**:

```text
issue-hierarchy/<projectId>/<issueId>/
  props.ts
  README.md
```

Directory depth does **not** express parent/child. Tree and rank both live in `props.ts`:

| Field | Authoritative role |
| --- | --- |
| `parentId` | **Tree authority**: parent issue id, or `null` (top-level epic) |
| `level` | **Interpretation authority**: `"epic"` \| `"task"` \| `"subtask"` (also which custom props apply) |

Rules (the two must agree):

- Top level (`parentId: null`) must be `epic`
- A child must be exactly one rank below its parent (epic → task only; task → subtask only)
- Subtask cannot have child issues

`@issue-<projectId>::<issueId>` resolves by joining paths only; **.pm/tree.md** / **index.json** are derived views—editing them does not change real hierarchy. The same `tree.md` file also renders wiki Contents; `wiki/sidebar.ts` remains that tree’s source of truth.

## Intentional dual authority

`level` and `parentId` are declared separately—that redundancy is deliberate.

If we only trusted the parent and silently recomputed `level` from depth, hand-edit mistakes would stay invisible. Keeping both sides: contradictions become **violations** (e.g. `ladder-break`, `root-not-epic`, missing parent, self-loop, cycles), the UI shows badges, `local-pm doctor` reports—**no silent repair**.

## How to keep AI (and humans) from breaking hierarchy

There is no filesystem hard lock; compliance is law + allocator + doctor. In practice:

1. **Never invent / rename** nanoid directories; create via the app or `local-pm issue create`.
2. **Do not hand-edit** `parentId` / `level` / `created` / `updated`.
3. Reparent with **`local-pm issue move`** (or UI): not a single-field edit—promoting a task to epic rewrites `level` for the whole subtree.
4. A hand-made directory is not a valid issue until `local-pm adopt` (or UI Adopt).
5. Suspect broken structure: run `local-pm doctor`; check violation badges on the tree.

Safe to hand-edit: body `README.md`, non-structural fields (title, dates, custom props, etc.). Structural fields go through create / move.

## Boundary with Project / Wiki (one line each)

- **Project**: container and long-lived responsibility domain; issues hang flat underneath; no issue-style `parentId`.
- **Issue ladder**: only describes one campaign and its breakdown; an epic frozen to done/cancel becomes history.
- **Wiki**: maintains current truth by topic; do not mirror every project / in-flight epic as an overview page. Content boundaries: skill `pm-content-placement` under `.agents/skills/`.

## Checklist

- Create: `local-pm issue create --project … --parent <issueId|root>` (or UI)
- Reparent: `issue move`, do not only edit `parentId`
- Read the tree: derived `.pm/tree.md` is for reading only
- Structural anomalies: `local-pm doctor`; stray directories: `adopt`
