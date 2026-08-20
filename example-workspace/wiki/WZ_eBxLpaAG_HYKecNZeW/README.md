Anything that is “an editable body + structured metadata, on disk, addressable with `@`” is a **node** in this product.  
The UI may say page / issue / project; on disk and in types, think in the pattern below.

Mechanism detail: ladder and `parentId`/`level` → @wiki-yp5aoc8X1YX4UjCT5Ec-w; system fields vs custom props → @wiki-mzvgnLTWniBW9NTCAOjC7; id draws → @wiki-kF6sQ8ynVamZ-AL5QzTtc; per-node `assets/` cites → @wiki-Q2CEIt__VycnUMBF9TaN9; content placement → skill `pm-content-placement`. This page only nails **what a node is, what it looks like, and how kinds differ**.

## Shared pattern (read this tree first)

Every node is “**one directory (or workspace root) = one node**” with at least a **meta file** + a **`README.md` body**:

```text
<node>                                      # identity locus (below)
├── <meta>.ts                               # structured props (export const props = …)
├── README.md                               # body (Markdown; do not repeat title as a # heading)
├── assets?/                                # optional; files only — cite rules @wiki-Q2CEIt__VycnUMBF9TaN9
└── …                                       # optional: kind-specific side files
```

Workspace-wide picture:

```text
<workspace-root>/                           # ← workspace node (special: root is the node)
├── workspace.ts                            # meta: title, createdDate
├── README.md                               # Home body
├── assets?/                                # optional workspace-node bag
├── wiki/
│   ├── sidebar.ts                          # not a node — Contents navigation SoT
│   └── <wikiNodeId>/                       # ← wiki-node
│       ├── props.ts
│       ├── README.md
│       └── assets?/
├── members/
│   └── <memberId>/                         # ← member node
│       ├── props.ts
│       ├── README.md
│       ├── avatar.<ext>                    # optional
│       └── assets?/
├── handoffs/
│   └── <handoffId>/                        # ← handoff node (one send)
│       ├── props.ts
│       ├── README.md
│       └── assets?/
└── issue-hierarchy/
    └── <projectId>/                        # ← project node
        ├── project.ts                      # meta (naming exception: not props.ts)
        ├── README.md                       # project description
        ├── custom-props.ts                 # not a node — custom field declarations for this project
        ├── schema.d.ts                     # not a node — generated from custom-props
        ├── assets?/
        └── <issueId>/                      # ← issue node (epic | task | subtask)
            ├── props.ts
            ├── README.md
            ├── assets?/
            └── <markdown-custom-prop>.md   # optional; not a separate node
```

### Shared rules

| Rule | Meaning |
| --- | --- |
| **Id = directory name** | Project / issue / wiki-node / member / handoff ids are opaque `nanoid(21)`; directory name is the id and is **never renamed**. Workspace has no separate id directory — the root itself is the node. |
| **Meta + body** | Meta lives in `export const props` in a `*.ts` file; body is always sibling `README.md`. |
| **System timestamps** | Project / issue / wiki-node / member / handoff: `created` / `updated` (ISO-8601 UTC `…Z`). `created` is written once; `updated` is bumped only by the app on a real props/body write. Patches **omit** both keys. Workspace uses `createdDate` (`YYYY-MM-DD`), also immutable. |
| **Title in meta, not as README H1** | Do not repeat the title with `#` in `README.md`. |
| **References by path join** | No running app / index required: `@issue-<projectId>` (project), `@issue-<projectId>::<issueId>`, `@wiki-<wikiNodeId>`, `@member-<memberId>`, `@handoff-<handoffId>` join directories directly. |
| **Create draws id locally** | No writer handle, no shared counter; concurrency relies on nanoid entropy. See @wiki-kF6sQ8ynVamZ-AL5QzTtc. |

**Not nodes:** `wiki/sidebar.ts` (Contents), `.pm/*` (derived / views), `custom-props.ts` / `schema.d.ts`, markdown custom-prop files on an issue, and sidebar `group` / `link` entries. Those are navigation, config, or fields — not “a document / plan.”

---

## Per-kind notes

### 1. Workspace

| | |
| --- | --- |
| **Gloss** | Workspace root / Home |
| **Locus** | `<workspace-root>/` (not a nanoid subdirectory) |
| **Meta file** | `workspace.ts` → `{ title, createdDate }` |
| **Body** | Root `README.md` (UI: Home) |
| **Hierarchy** | Outermost container; holds `wiki/`, `members/`, `handoffs/`, and `issue-hierarchy/` |
| **Reference** | No `@workspace-…`; opening the workspace is this node |

**Kind-specific:**

- No opaque id; identity = this root directory on disk.
- `createdDate` is set at create and must not move via UI / `WorkspacePatch` / hand edit.
- Patchable: `title`, `description` (the README).

### 2. Project

| | |
| --- | --- |
| **Gloss** | Project container / long-lived area of responsibility (portfolio / area) — **not** a dated “campaign” |
| **Locus** | `issue-hierarchy/<projectId>/` |
| **Meta file** | `project.ts` (naming exception; content is still `export const props`) |
| **Body** | `README.md` = **project description** (slow-changing; no campaign dates / done criteria) |
| **Hierarchy** | Under workspace; issue dirs hang flat underneath |
| **Reference** | `@issue-<projectId>` (no `::`; not `@project-…`). Issue refs add `::<issueId>`. |

**Kind-specific:**

- Schema has **no** `status` / start–end dates / archive — lifecycle events do not live on Project.
- Common meta fields: `title`, `created`, `updated` (description is in README, not `project.ts`).
- Side files: `custom-props.ts` + generated `schema.d.ts` declare custom fields for issues under this project.
- Content boundary vs epic / wiki: skill `pm-content-placement`.

### 3. Issue (epic / task / subtask)

| | |
| --- | --- |
| **Gloss** | Issue; fixed three-level ladder (campaign → task → subtask) |
| **Locus** | `issue-hierarchy/<projectId>/<issueId>/` (**flat** — parent/child is not nested directories) |
| **Meta file** | `props.ts` |
| **Body** | `README.md` |
| **Hierarchy** | Declared by `level` + `parentId`; independent of directory depth |
| **Reference** | `@issue-<projectId>::<issueId>` |

**Kind-specific:**

- `level`: `"epic"` \| `"task"` \| `"subtask"` — fixed, not configurable.
- `parentId`: parent issue id, or `null` (top-level epic). **Tree authority is `parentId`; interpretation authority is `level`.** When they disagree, keep both and report a violation — no silent repair (detail: @wiki-yp5aoc8X1YX4UjCT5Ec-w).
- Other system fields: `status` (`draft` \| `todo` \| `in-progress` \| `done` \| `cancel`; create default `draft`), `priority` (`very-low` \| `low` \| `medium` \| `high` \| `very-high`; create default `medium`), `startDate` / `endDate`, `assignee`, `createdBy`.
- **Epic** body = this campaign (why now / scope / done criteria / dates); freezes into history when status becomes `done` / `cancel`. Task / subtask are breakdown inside the campaign, not separate content-placement layers.
- Optional side files: one `.md` per markdown-typed custom prop — still part of that issue, not a new node.

### 4. Wiki-node

| | |
| --- | --- |
| **Gloss** | Wiki node (UI often says **page**) |
| **Locus** | `wiki/<wikiNodeId>/` |
| **Meta file** | `props.ts` → `{ title, description, created, updated, createdBy? }` |
| **Body** | `README.md` = **current truth** (maintenance obligation; going stale is a defect) |
| **Hierarchy** | **No** `parentId` on the node’s `props.ts`; Contents nesting lives only in `wiki/sidebar.ts` |
| **Reference** | `@wiki-<wikiNodeId>` → `wiki/<id>/README.md` |

**Kind-specific:**

- Disk inventory (All pages) and Contents (`ref` entries in `sidebar.ts`) are two views of the same set: every wiki-node **must** appear in Contents; `unlisted` is illegal (doctor `wiki-unlisted`). `getWiki` hangs legacy orphans under the Contents root.
- `createWikiNode` **always** writes into Contents (`parentId` optional, default root).
- Organize by topic; do not mirror every project / running epic with an overview page.
- Sidebar `group` / `link` entries are navigation, **not** wiki-nodes.
- Placement discovery: @wiki-uDY1G0KYgYaC1AD6EVqXi.

### 5. Member

| | |
| --- | --- |
| **Gloss** | Workspace member (roster fact, not a login account) |
| **Locus** | `members/<memberId>/` |
| **Meta file** | `props.ts` → `{ title, membership, created, updated }` |
| **Body** | `README.md` |
| **Reference** | `@member-<memberId>` |

**Kind-specific:** No role; `membership` is `"involved"` \| `"left"`. Current truth: @wiki-7j0Ak3N2wsnQodOSxSzZ9.

### 6. Handoff

| | |
| --- | --- |
| **Gloss** | Sent session packet (one send = one node) |
| **Locus** | `handoffs/<handoffId>/` |
| **Meta file** | `props.ts` (includes `relatedProject`, `open`, `from` / `to`, etc.) |
| **Body** | `README.md` (may cite multiple `@issue-…`) |
| **Reference** | `@handoff-<handoffId>` |

**Kind-specific:** Not wiki Contents, not an issue. Not durable standing prose; use it for campaign progress, wiki for standing law.

---

## Quick comparison

| Node | Directory / locus | Meta file | Body | How tree is expressed | `@` reference |
| --- | --- | --- | --- | --- | --- |
| **workspace** | Workspace root | `workspace.ts` | `README.md` | — | — |
| **project** | `issue-hierarchy/<id>/` | `project.ts` | `README.md` | Container; no issue-style parent | (embedded in issue ref) |
| **issue** | `…/<projectId>/<issueId>/` | `props.ts` | `README.md` | `parentId` + `level` | `@issue-p::i` |
| **wiki-node** | `wiki/<id>/` | `props.ts` | `README.md` | `sidebar.ts` only | `@wiki-id` |
| **member** | `members/<id>/` | `props.ts` | `README.md` | — | `@member-id` |
| **handoff** | `handoffs/<id>/` | `props.ts` | `README.md` | — | `@handoff-id` |

## Do not

- Do not treat sidebar `group` / `link`, custom markdown field files, or `.pm/*` as nodes.
- Do not add `parentId` to a wiki-node’s `props.ts` (nesting belongs to Contents).
- Do not store issues as nested directories for parent/child (flat + `parentId`).
- Do not hand-edit or include `created` / `updated` / workspace `createdDate` in patches.
- Do not rename nanoid directories.
- Do not re-expand content-placement philosophy or IPC detail on this page — link the matching wiki / skill.
