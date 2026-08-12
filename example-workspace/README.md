# pm-all-in-one example workspace

This directory is a **local-pm workspace snapshot**: the product planning itself under project **pm-all-in-one**, plus product standing wiki (Contents filtered from the live dogfood library).

It is **not** the live private dogfood tree, and **not** product source code. Refresh by copy/filter from the maintained library when cutting a public ship — not by git submodule.

## Open it

1. Install / run [pm-all-in-one](https://github.com/WenchuanLiliZhao/pm-all-in-one) (app Release or build from `app/`).
2. In the app: **Open folder** → select this `example-workspace/` directory (the folder that contains `workspace.ts`).
3. Or from a shell (with the CLI on PATH): `pm-all-in-one doctor --workspace /path/to/example-workspace`.

Do **not** open the product repo root as a PM workspace — only this subdirectory.

## What is included

- `issue-hierarchy/blwwMj6xHRYLCWXfa9wwl/` — project **pm-all-in-one**, **v0 campaign only**
- Wiki under the **pm-all-in-one** Contents section in `wiki/sidebar.ts` (other Contents roots omitted)
- Members needed for assignees / createdBy
- Workspace scaffold (`AGENTS.md`, `.pm/agent.md`, skills, …)

## What is omitted

- The **v1** epic and all of its tasks / subtasks (trusted 1.0.0 / signing / later UI)
- Other projects from the live library (e.g. eve-ask-lab)
- Machine-local files (`.pm/local.json`, `.pm/local.md`)
- Derived index files (`.pm/index.json`, `.pm/tree.md`)
