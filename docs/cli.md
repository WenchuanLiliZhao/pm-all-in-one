# CLI manual (`pm-all-in-one`)

The public npm package **`pm-all-in-one`** allocates and inspects workspace nodes without the desktop app: projects, issues, members, handoffs, `doctor`, and `adopt`.

It does **not** host data. Collaboration remains git. The app’s **Install Command Line Tool…** and the in-app terminal shim install the **same** command name on `PATH`.

Registry: https://www.npmjs.com/package/pm-all-in-one

## Why not `local-pm`

The historical CLI name was `local-pm`. npm rejects bare `local-pm` as too similar to `local-pkg`. A scoped name would make `npx` painful. **Package name and bin are both `pm-all-in-one`.**

Internal env vars such as `LOCAL_PM_WORKSPACE` / `LOCAL_PM_USER_DATA` are unchanged. Workspace `.pm/agent.md` may still stamp `local-pm agent.md rev N` for `doctor`.

## Install

**Cold path** (Node ≥ 20, no app):

```sh
npx pm-all-in-one --help
npx pm-all-in-one doctor
npx pm-all-in-one --workspace /path/to/workspace issue list
```

**With the desktop app:** File → **Install Command Line Tool…**, then:

```sh
pm-all-in-one doctor
```

**Global install** (optional):

```sh
npm install -g pm-all-in-one
pm-all-in-one --help
```

## Workspace root

Resolution order:

1. `--workspace <path>`
2. `LOCAL_PM_WORKSPACE`
3. Walk upward from `cwd` looking for a workspace

## Common commands

```sh
pm-all-in-one project create --title "New Project"
pm-all-in-one project list

pm-all-in-one issue create --project <projectId> --parent <issueId|root> --title "…"
pm-all-in-one issue move   --project <projectId> --issue <issueId> --parent <issueId|root>
pm-all-in-one issue delete --project <projectId> --issue <issueId> [--force]
pm-all-in-one issue list   [--project <projectId>]

pm-all-in-one member create --title "…"
pm-all-in-one member list
pm-all-in-one member update <id> [--title <t>] [--membership involved|left]
pm-all-in-one member avatar <id> --file <path>

pm-all-in-one handoff create --from <memberId> --to <memberId> --related-project <projectId> [--title <t>] [--closed]
pm-all-in-one handoff list
pm-all-in-one handoff update <id> [--title <t>] [--from <id>] [--to <id>] [--related-project <id>] [--open|--closed]

pm-all-in-one doctor
pm-all-in-one adopt path/to/stray-dir
```

Add `--json` for machine-readable output.

**Never invent nanoid directory ids by hand** — create through this CLI or the app. Directory name = id and is never renamed.

Live locators in Markdown bodies (bare text, not backticks):

```text
@issue-<projectId>::<issueId>
@wiki-<wikiNodeId>
@member-<memberId>
@handoff-<handoffId>
```

## Current limits

- **No `wiki create` in the CLI yet** — wiki nodes still allocate via the app (same core).
- **Windows “Install Command Line Tool…”** is not supported yet; use `npx` / global npm on Windows.
- Publishing CLI versions: see [releasing.md](releasing.md).

## Related

- Product story and download: [../README.md](../README.md)
- Disk / agent law: inside a workspace, `AGENTS.md` → `.pm/agent.md`
