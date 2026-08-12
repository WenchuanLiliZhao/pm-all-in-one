Structured metadata is **not YAML**. On disk it is a TypeScript object literal: `export const props = { … } as const`. The layer people often call “YAML” here is `props.ts` / `custom-props.ts` (plus sibling `.md` files for markdown custom fields).

Node shape overview: @wiki-WZ_eBxLpaAG_HYKecNZeW. Ladder and `parentId`/`level`: @wiki-yp5aoc8X1YX4UjCT5Ec-w.

## What the two layers are

### System fields (product-owned)

Hardcoded in types, readers/writers, and UI. **Do not** — and **cannot** — redeclare them in `custom-props.ts`.

Common system keys on an issue (`props.ts`):

| Category | Fields |
| --- | --- |
| Structure | `title`, `level`, `parentId` |
| Workflow | `status`, `priority`, `startDate`, `endDate`, `assignee` |
| Identity / time | `createdBy`, `created`, `updated` |

- `status`: `draft` \| `todo` \| `in-progress` \| `done` \| `cancel` (create default `draft`)
- `priority`: `very-low` … `very-high` (create default `medium`)
- `id` exists only as the **directory name**; never write it into a props file
- `created` / `updated` are maintained by the app on real writes; patches omit both keys

Project / wiki-node / workspace each have their own system meta, but **not** the issue custom-field mechanism.

### User custom fields (project-owned)

One declaration per project: `issue-hierarchy/<projectId>/custom-props.ts`, keyed by ladder rank:

```ts
export const props = {
  epic: CustomPropDef[],
  task: CustomPropDef[],
  subtask: CustomPropDef[],
} as const;
```

Each def: `{ key, label, type, help? }`, `type` ∈ `string` \| `number` \| `boolean` \| `date` \| `markdown`.

- **Non-markdown:** values live in the same issue `props.ts`, flat beside system fields
- **Markdown:** values live in a sibling `<kebab-key>.md` (e.g. key `updates` → `updates.md`), **not** in `props.ts`

Runtime `Issue` splits them: system fields first-class; non-markdown → `fields`; markdown → `markdownFields`.

## Disk layout

```text
issue-hierarchy/<projectId>/
  custom-props.ts     # SoT for which custom fields exist
  schema.d.ts         # generated from custom-props; IDE / satisfies
  <issueId>/
    props.ts          # system + non-markdown custom (one flat object)
    README.md         # body
    updates.md        # example markdown custom field
```

Authority:

| Concern | SoT |
| --- | --- |
| Which custom fields exist | `custom-props.ts` |
| Shape check for hand edits | `schema.d.ts` (derived) |
| System + scalar custom values | issue `props.ts` |
| Markdown custom bodies | sibling `.md` |
| Tree + ladder | `parentId` + `level` (`level` also selects which custom schema applies) |

## How they coexist (merge rules)

### 1. Reserved-key gate

Writing `custom-props.ts` **hard-rejects** these keys (clash with system):

`id`, `created`, `updated`, `title`, `level`, `parentId`, `status`, `priority`, `startDate`, `endDate`, `assignee`, `createdBy`

### 2. Generated type merge

In `schema.d.ts`, `BaseProps` = system shape; `EpicProps` / `TaskProps` / `SubtaskProps` add that level’s custom keys. Markdown defs **do not** appear on the TS interface (they are files, not props keys).

Issue writes emit:

```ts
import type { TaskProps } from "../schema";
export const props = { … } as const satisfies TaskProps;
```

Note: load uses esbuild and **erases types**; `satisfies` is for humans/IDE, not runtime enforcement.

### 3. Read path

1. Load the project’s `custom-props.ts`
2. Take defs for the issue `level`
3. Markdown → sibling `.md` into `markdownFields`; other declared keys → `fields`
4. Remaining `props.ts` keys that are neither system nor already in `fields` are **still copied into `fields`** (orphan / undeclared tolerance)
5. Invalid or missing `status` / `priority` **soft-normalize** to defaults

### 4. Write path (essentials)

- System editable keys use dedicated patch fields (title, status, priority, dates, assignee, …)
- `patch.fields` strips timestamps and structural/system keys so the “custom channel” cannot rewrite system truth
- `level` / `parentId` change only via create / move
- Markdown keys are not written back into `props.ts`; write sibling `.md`
- `created` / `updated` / `createdBy` are never accepted from patch

### 5. UI layout

- Issue detail: fixed system block above (Status / Priority / Assignee / timestamps, …); **Custom fields** below driven by the current `level` schema
- Project settings: edit `custom-props.ts` (and generated `schema.d.ts`); removing a field warns if still in use but **does not** auto-purge orphans on disk
- Table: system columns + union of custom keys across projects/levels; empty cell if that row’s level does not declare the key

## Dogfood examples

This project's `custom-props.ts` (`issue-hierarchy/blwwMj6xHRYLCWXfa9wwl/`):

- task: `movementField1` (string, UI label Note)
- subtask: `updates` (markdown, with help)

Task @issue-blwwMj6xHRYLCWXfa9wwl::2dWYa7YzOJ-fa6l5yNSWD — system keys and `"movementField1": "In fact"` flat in the same `props.ts`.

Subtask @issue-blwwMj6xHRYLCWXfa9wwl::mg6bIUXfu0nW3PQjgWYUE — `props.ts` system-only; progress in sibling `updates.md`.

## Hand-edit reminders

- Safe: `README.md`, scalar custom values, markdown sidecars, and non-structural system fields (title, dates, status, priority, …)
- Do not edit: `created` / `updated`, `parentId` / `level` (move via CLI/UI), directory-name ids
- Do not declare reserved keys or `id` in `custom-props.ts`
- Keep `satisfies …Props`; it checks shape only, not whether `parentId` is a legal parent — that is `local-pm doctor`

## Known edges

- Removing a custom field from the schema can leave orphans in `props.ts` / `.md`; reads may still put them in `fields`
- Custom values get **no** runtime Zod check against declared `type`; hand edits can be the wrong shape
- Illegal `status`/`priority` on disk soft-default on read; explicit patch of illegal values hard-fails
- Renaming a markdown field key without migrating the filename loses the body in the UI (`keyToKebab` mapping)
