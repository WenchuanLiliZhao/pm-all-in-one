The public npm package **`pm-all-in-one`** is the allocator CLI for workspaces: create / move / delete issues, projects, members, handoffs, run `doctor`, and `adopt` stray directories — without the desktop app.

App Install Command Line Tool… and the in-app terminal shim install the **same command name** on PATH. Collaboration remains git; this package does not host data.

Registry: https://www.npmjs.com/package/pm-all-in-one  
Product repo: https://github.com/WenchuanLiliZhao/pm-all-in-one

## Why not `local-pm`

The historical CLI name was `local-pm`. npm rejects bare `local-pm` as too similar to existing package `local-pkg` (HTTP 403). Scoped `@wenchuanlilizhao/local-pm` would force a long `npx` invocation. **Package name and bin are therefore both `pm-all-in-one`.**

Env vars such as `LOCAL_PM_WORKSPACE` / `LOCAL_PM_USER_DATA` are unchanged (internal). The agent.md stamp line still says `local-pm agent.md rev N` so doctor can parse it.

## Install / run

Cold path (Node ≥ 20, no app):

```sh
npx pm-all-in-one --help
npx pm-all-in-one doctor
npx pm-all-in-one --workspace /path/to/workspace issue list
```

With the desktop app: **File → Install Command Line Tool…**, then:

```sh
pm-all-in-one doctor
```

Global install (optional):

```sh
npm install -g pm-all-in-one
pm-all-in-one --help
```

Workspace root resolution order: `--workspace <path>`, then `LOCAL_PM_WORKSPACE`, then walk upward from cwd looking for a workspace.

## Common commands

```sh
pm-all-in-one project create --title "New Project"
pm-all-in-one issue create --project <projectId> --parent <issueId|root> --title "…"
pm-all-in-one issue move   --project <projectId> --issue <issueId> --parent <issueId|root>
pm-all-in-one issue delete --project <projectId> --issue <issueId> [--force]
pm-all-in-one issue list   [--project <projectId>]
pm-all-in-one member create --title "…"
pm-all-in-one handoff create --from <memberId> --to <memberId> --related-project <projectId>
pm-all-in-one doctor
pm-all-in-one adopt path/to/stray-dir
```

Add `--json` for machine-readable output. Never invent nanoid directory ids by hand — create through this CLI (or the app).

## Limits (current)

- **No `wiki create` in the CLI yet.** Wiki nodes still allocate via the app / `createWikiNode` (same core). See @wiki-D9Sd2WYlM-2hdgcXcUbhl.
- Windows Install Command Line Tool… is not supported yet.
- Publishing a new version: build `dist-cli/` from the product repo and `npm publish ./dist-cli --access public` (version tracks `app/package.json`). Prefer a granular npm token with Bypass 2FA; interactive OTP is easy to rate-limit. Details: product `docs/releasing.md`.

## Related

- Disk law for agents: workspace `.pm/agent.md` (rev stamp + create rules)
- Create-path conventions: @wiki-D9Sd2WYlM-2hdgcXcUbhl
- Campaign that shipped the first publish: @issue-blwwMj6xHRYLCWXfa9wwl::7IqV4uCACewDyRFOpeFfP
