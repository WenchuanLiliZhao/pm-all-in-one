<!-- local-pm agent.md rev 9 — product-owned; do not hand-edit. Custom conventions go in .agents/skills/custom/ (see pm-create-skill). -->
# Agent rules (local-pm)

## Finding things

Every reference resolves by joining directory names, with no index and no running app:

```text
@issue-<projectId>::<issueId>  ->  issue-hierarchy/<projectId>/<issueId>/
@wiki-<wikiNodeId>             ->  wiki/<wikiNodeId>/README.md
@member-<memberId>             ->  members/<memberId>/
@handoff-<handoffId>           ->  handoffs/<handoffId>/
```

Ids are opaque `nanoid(21)` tokens (URL-safe alphabet). Collision resistance
comes from entropy at create time — there is no shared counter. Directory names
are ids and nothing else; **never rename one**.

Directories are flat, so they tell you nothing about ancestry. For that read
`.pm/tree.md` (derived, rebuilt by the app).

## Mentions (live cross-references)

In body Markdown (workspace Home, project / issue / wiki / member / handoff `README.md`, and
markdown custom-prop files), write **live** locators as bare text so the app
turns them into chips:

```text
See @issue-V1StGXR8_Z5jdHi6B-myT::abcDEF0123456789xyz01.
Standing rule: @wiki-V1StGXR8_Z5jdHi6B-myT.
Owner: @member-V1StGXR8_Z5jdHi6B-myT.
Handoff: @handoff-V1StGXR8_Z5jdHi6B-myT.
```

**Never** wrap a concrete locator (real nanoid tokens) in backticks. Mentions
inside inline code or fenced code stay literal and will not become chips.

Backticks are fine only when explaining the *syntax* with placeholders
(`@issue-<projectId>::<issueId>`, `@wiki-<id>`, `@member-<id>`, `@handoff-<id>`). Derived
`.pm/tree.md` emits bare locators; copy them without adding backticks.

## Shape of the workspace

```text
<workspace-root>/
  AGENTS.md                    # IDE entry → .pm/agent.md
  workspace.ts                 # title, createdDate
  README.md                    # workspace body (Home)
  .agents/skills/
    core/                      # create-time product skills (pm-content-placement, …)
    custom/                    # user conventions (see pm-create-skill)
  wiki/
    sidebar.ts                 # Contents SoT (export const props = [...])
    <nanoid>/                  # wiki-node dirs (ids never renamed)
      props.ts                 # title, description, created, updated, createdBy?
      README.md                # body
  members/
    <nanoid>/                  # member dirs (ids never renamed)
      props.ts                 # title, membership, created, updated
      README.md                # body
      avatar.<ext>             # optional
  handoffs/
    <nanoid>/                  # one sent handoff (ids never renamed)
      props.ts                 # title, description, relatedProject, open, from, to, created, updated
      README.md                # body (may cite @issue-…)
  issue-hierarchy/
    <nanoid>/                  # project container
      project.ts               # title, created, updated, createdBy?
      README.md
      custom-props.ts
      <nanoid>/                # issue
        props.ts               # …, assignee?, createdBy?
        README.md
  .pm/
    agent.md
    views.json
    view-orders.json
    fence-validators.json      # optional — fence lang → validator module
    local.json                 # gitignored — machine-local `me` (+ future repos table)
    local.md                   # optional, gitignored — NL notes for AI (code paths, etc.)
```

Required directories that may be empty (`members/`, `handoffs/`,
`issue-hierarchy/`, `.agents/skills/custom/`) always contain `.gitkeep` so git
can track them. The app writes these on create and on open; do not delete them.
Optional per-node `assets/` folders stay absent when empty — they are not this
rule.

Create `.pm/local.md` only when you have something to write (do **not** seed an empty
file). It is for agents and humans on this machine — natural-language checkout
paths and similar notes. It is **not** the app's resolution source of truth;
structured project ↔ code binding (when implemented) uses committed repo `key`s
plus `.pm/local.json` `repos`. Never commit `.pm/local.md` or `.pm/local.json`.

## Custom conventions

Agent Skills live under `.agents/skills/`, split by ownership:

- **`core/`** — create-time product seeds (e.g. `pm-content-placement`,
  `pm-create-skill`). Do not add library-specific conventions here.
- **`custom/`** — user / library conventions as
  `.agents/skills/custom/<name>/SKILL.md` (see skill `pm-create-skill`).

Do **not** edit this file or root `AGENTS.md` to add conventions.

## Fence validators

Product Markdown may contain fenced blocks whose language is a workspace DSL
(not generic mermaid / js). Doctor does not learn those languages. A workspace
that wants them linted declares validators at **workspace scope** (not per
project):

`.pm/fence-validators.json`

```json
{
  "validators": [
    { "lang": "plot", "module": "fence-validators/plot.mjs" }
  ]
}
```

`lang` matches the first token of the fence info string (`plot riemann` →
`plot`). `module` is a path relative to the workspace root, inside the
workspace. The file is ESM and must `export function validate({ lang, info, body })`
returning `{ message, line? }[]`. `line` is 1-based within the fence body;
doctor maps it to a **file** line.

**Opt-in.** Doctor never imports those modules by default (a `git pull` must
not run someone else's code). Enable with `.pm/local.json`
`"trustFenceValidators": true` (machine-local, gitignored) or this run only:

```sh
pm-all-in-one doctor --trust-fence-validators
```

If validators are declared but not trusted, doctor prints
`fence-validators-untrusted` and skips them.

**No eval, no codegen.** `validate` must parse the body (YAML / an AST / a
schema) and walk that tree. Do not `eval`, `new Function`, or compile the
fence into runnable code. Doctor itself only `import()`s the opted-in module.

**Exit code.** `fence-invalid` and `fence-validators-untrusted` are warnings
in the same doctor output as ladder / shape findings; they do **not** fail
doctor. Structural problems (strays, ladder, unreadable declaration, failed
module load) still fail.

Do not seed an empty `.pm/fence-validators.json`; omit the file until you have
a validator.

## Wiki

Each wiki-node is `wiki/<id>/{props.ts,README.md}` where `id` is an opaque
token. Props include `title` and `description` (required key, may be `""`).
**Contents** (`wiki/sidebar.ts` `ref` tree) is the required hierarchy —
every wiki-node must appear there. Create via the app or CLI so ids allocate
correctly; new nodes always enter Contents (`parentId` optional, default root).
Prefer `@wiki-<id>` for links. Home is root `README.md`, not a file under
`wiki/`. All pages is a flat admin inventory of the same set.

## Members

Members live under `members/<id>/`. There are **no roles** — only
`membership`: `"involved"` | `"left"` (current state, not interval history).
`createdBy` on projects / issues / wiki-nodes is a **system field** set at
create from the local actor (`.pm/local.json` `me`, or an explicit actor).
Do **not** hand-edit `createdBy`. Issue `assignee` is editable; prefer the
app or CLI. Collaboration between people is still **git** (commit / push /
pull).

**Do not** put machine-absolute code paths (or other per-machine location notes)
in `members/*/README.md` or any other file that enters git. Those belong in
`.pm/local.md` (or, when the product path table ships, `.pm/local.json`).

## Handoffs

Sent collaboration notes live under `handoffs/<id>/` — **not** wiki, **not**
an issue, **not** Home. One directory = one send (may span many issues via
`@issue-…` in the body). Props: `title`, `description` (required key, may be
`""`), `relatedProject` (project id, required), `open` (boolean, required;
`true` = open / `false` = closed), `from` / `to` (member ids), `created` /
`updated`. Sort / browse by `created` (send time). Prefer the
app Handoffs view or CLI (`pm-all-in-one handoff create`). Do **not** invent
directory ids by hand. Do not use handoffs as a second wiki or as durable
project / epic truth.

## Shape of an issue

```text
issue-hierarchy/<projectId>/<issueId>/
  props.ts                     # title, level, parentId, created, updated, …
  README.md                    # the body
  verification-standard.md     # one file per markdown custom prop
```

`props.ts` states structural fields:

- `level` — `"epic"` | `"task"` | `"subtask"`. Decides which custom props the
  issue is read against, so it is authoritative and must be present.
- `parentId` — the id of the parent issue, or `null` for a top-level epic. Sole
  authority for the tree.
- `status` — `"draft"` | `"todo"` | `"in-progress"` | `"done"` | `"cancel"`.
  New issues start as `draft`.
- `blockedBy` — array of same-project issue ids that must complete before this
  issue (hard dependencies). Optional; default `[]`. Cross-level edges are
  allowed; cross-project edges are not. Cycles are rejected at write time.

They are checked against each other: a child's level must be exactly one step
below its parent's (`epic > task > subtask`). A file that disagrees with its
parent is **reported, never quietly reinterpreted** — run `pm-all-in-one doctor`.

`blockedBy` is orthogonal to `parentId`: parent is ownership; blockedBy is
ordering. Do not encode hierarchy in `blockedBy`.

These names are **ladder ranks** (epic / task / subtask). Do not invent a fourth
rank; do not write `level` as concerto/movement/phrase (legacy musical aliases).

## Create / move (required)

**Never invent directory ids by hand.** Always create through the app or CLI so
the allocator draws a unique token:

```sh
pm-all-in-one project create --title "New Project"
pm-all-in-one issue create --project <projectId> --parent <issueId|root> --title "…"
pm-all-in-one issue move   --project <projectId> --issue <issueId> --parent <issueId|root>
pm-all-in-one issue list   --project <projectId>
pm-all-in-one doctor
pm-all-in-one adopt path/to/stray-dir
```

**Reaching the CLI.** Inside the app's built-in terminal `pm-all-in-one` is already
on PATH. Anywhere else — an editor, an agent, a plain shell — prefer one of:

1. **File → Install Command Line Tool…** (when the desktop app is installed), or
2. **`npx pm-all-in-one …`** (Node only; no app required — public npm package `pm-all-in-one`).

A bare `pm-all-in-one` that is not found means neither path is set up here, not that
this workspace is broken; do not go looking for the app bundle. If Node is
missing, `npx` will fail the same way — install Node, or use the app install
path above.

**When no CLI is reachable, stop and say so.** Reading, body edits, and the
non-structural fields listed under *Editing by hand* need no CLI. Allocation and
moves do, and there is no hand substitute: a directory you create yourself is
not an issue until `pm-all-in-one adopt` takes it, and a hand-made `wiki/` node is
also absent from `wiki/sidebar.ts`.

Collaboration between people is **git** (commit / push / pull). Members exist
on disk; `createdBy` is stamped at create from local `me` when set. There are
no roles.

**Do not reparent by editing `parentId` yourself.** A move is not a one-field
edit: re-leveling a task to an epic re-levels its whole subtree, and `issue move`
rewrites every affected `level` in one go.

Hand-created directories under a project are **not** issues until adopted
(`pm-all-in-one adopt` or the app's Adopt button).

## Editing by hand

Fine to edit: workspace / issue / project / member `README.md`, `wiki/*/README.md`,
markdown prop files, and the non-structural fields of `workspace.ts`,
`project.ts`, and `props.ts` (title, `startDate`/`endDate`, `blockedBy`,
`assignee`, custom props, member `membership`).

**Title vs body.** Title lives in `workspace.ts` / `project.ts` / issue, wiki-node,
or member `props.ts`. The matching `README.md` is body only — do **not** start
it with a `#` heading that repeats the title (the UI already renders title).
Start the body with prose or `##` sections. When you need the full entity,
read both the props file and the README.

**Do not edit `created` or `updated` in `props.ts` / `project.ts` / wiki-node
or member `props.ts`.** They are system fields: `created` is set once at create;
`updated` is refreshed only by the app on a real write of props or body.

**Do not edit `createdBy`.** It is a system field set once at create.

- Prefer the app (or CLI) for `wiki/sidebar.ts` structure changes.
- Never write an `id` field into `workspace.ts`, `project.ts`, `props.ts`, or
  `custom-props.ts`. Do not declare `created`/`updated`/`createdBy`/`assignee`
  as custom props.
- Keep the `satisfies` clause: `<project>/schema.d.ts` is generated from
  `custom-props.ts` and catches misspelled fields. It checks shape only — it
  cannot tell whether a `parentId` is a legal parent.
- `.pm/index.json` and `.pm/tree.md` are derived. Editing them changes nothing.
- `.pm/local.json` is machine-local (gitignored) — current `me` member id
  (and, later, structured `repos` path table). Optional
  `trustFenceValidators` opts in to importing workspace fence-validator
  modules for this machine.
- `.pm/local.md` is optional machine-local prose (gitignored) for AI-oriented
  path notes; create only when needed; never commit.
- `.pm/fence-validators.json` is committed workspace config (see *Fence
  validators*). The CLI has no built-in fence languages.
