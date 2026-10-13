# pm-all-in-one

A local Jira replacement for small teams: projects, issues, wiki, and handoffs live as **files in a git repository**, so a clone is the full state and collaboration is a pull request.

It is built for teams where work state is produced on disk — written by people and by AI agents, reviewed by people in git. Jira, chat threads, and tool-only PM stacks split that state across systems agents cannot reliably read or continue; here the project library sits **next to your code**.

This repository is the product home — macOS app, [`pm-all-in-one`](https://www.npmjs.com/package/pm-all-in-one) CLI, and the Cursor extension (`wenchuanlilizhao.pm-all-in-one` on Open VSX).

We run the product on itself: development of **pm-all-in-one** is planned and tracked in a separate pm-all-in-one library, not this product repo. The README, releases, and disk contract below are what that dogfood has to survive, not a slide deck.

## What matters

1. **Workspace as a standard** — like an npm workspace: a public directory contract, not a private database behind an API. App, CLI, and agents all operate on the same files.
2. **Wiki and issues fully exposed to AI** — Markdown bodies, `props.ts`, and live `@issue-…` / `@wiki-…` / `@member-…` / `@handoff-…` locators resolve by path. No running server required to find a node.
3. **Handoff as a first-class node** — a sent “who → whom, about which work” record on disk (`handoffs/`), not chat residue or a buried comment.

The desktop UI is the **easy way in** — the Jira-shaped surface so people do not have to relearn where to click. It is not the definition of the product. The workspace on disk is; the CLI and agent rules (`AGENTS.md` / `.pm/agent.md` / skills) are peers to the UI.

## Who this is for / not for

The dividing line is how work is produced, not company headcount: **is company state files on disk that agents can read and humans review in git?**

**Likely a fit**

- Solo developers or small teams who already share one workspace with agents
- Agent fleets / automation studios that need a durable, diffable ledger of intent (not chat residue)
- Knowledge or delivery work where the deliverable is already a repo of documents + code
- A pod inside a larger org that keeps agent-driven work on disk, while enterprise tickets stay elsewhere

**Not a fit**

- Compliance-heavy ticket flows (procurement, legal, regulated ops) that need a remote SoT and approval matrix
- Orgs whose primary users only use web forms — login, roles, SLA reports, and workflow engines as first-class
- Anyone who wants hosted sync, in-app ACL, or a board that hides the files

**Validated range (honest):** dogfood and active testing cover **1–5 people** on one library. That is the range where git can still absorb concurrent edits by hand, and it is the only range we can vouch for. There is **no large-team experiment** yet; larger headcount may still adopt the model for an on-disk layer, but that scale is unproven here.

## Same shape as Jira, different source of truth

The desktop shell keeps the familiar shape of **Jira + Confluence** — projects, issue trees, wiki, status and priority — so a team that already knows Jira can switch without relearning the screen. What changes is underneath:

> Jira's source of truth is a remote database reached through an API. Here it is a directory of text files you already have checked out.

What that buys, concretely:

- **Resolution without a server.** Every reference is a path join — `@issue-<projectId>::<issueId>` → `issue-hierarchy/<projectId>/<issueId>/`, `@wiki-<id>` → `wiki/<id>/body.md`. No index to rebuild, no app running, no auth.
- **Cross-cutting questions are a grep, not N API calls.** From an opened workspace:

```sh
rg -l '"status": "in-progress"' issue-hierarchy   # everything in flight
rg -l 'blockedBy' issue-hierarchy                 # every declared dependency
```

- **A change of plan is a diff.** Intent moves on branches, arrives in PRs, and reverts like any other commit. `git log` over `issue-hierarchy/` is the decision history, with no separate audit feature.
- **Agent writes are typed, not trusted.** `props.ts` is `satisfies`-checked against a generated `schema.d.ts`, and a `level` that contradicts its `parentId` is reported by `pm-all-in-one doctor` — **never quietly reinterpreted**. A malformed write fails loudly instead of landing silently.

**"Jira has an MCP server now."** It does, and it works. The gap is not access, it is shape. An API answers questions an agent already knew to ask, one paginated call at a time, and hands back an unversioned snapshot it cannot diff. A directory hands over the corpus: grep it, `git log` it, and read the code in the same pass. Same reason a database endpoint is not "having the repo".

**Where the files live is your call.** A workspace is just a directory, so it can sit inside your code repo — intent and implementation in one PR — or be a repo beside it. pm-all-in-one takes the second path: the live dogfood library is a separate repo because it tracks more than this codebase. Same-repo co-review is available to you; it is not what we run daily.

## What you get, and what is deliberately missing

"Replacement" invites a feature-by-feature comparison, so here is the honest one.

| In the box | Not in the box (on purpose) |
| --- | --- |
| Projects with an epic → task → subtask tree | Configurable workflows, schemes, or issue types — the three ranks are fixed |
| Status, priority, assignee, dates, dependencies (`blockedBy`) | Accounts, roles, in-app ACL, hosted sync |
| Table, roadmap, home, and saved filter views; per-project custom fields (`custom-props.ts`) | SLA and audit reports, approval matrices |
| Wiki with cross-links to issues, members, handoffs | A board that hides the files |
| Members and handoffs as on-disk nodes | Comments as a separate chat stream — the body file and git history carry discussion |
| `doctor` that rejects a malformed write instead of reinterpreting it | A sandbox between agents and the source of truth — guardrails are workspace rules, skills, and `doctor` |

The fixed ladder is a real capability loss against Jira, taken deliberately: a structure every workspace can redefine is a structure no agent learns once. Cross-org ticket flow, audit reports, SLA, and ACL remain Jira's home field; this product stays off it.

## Tradeoffs (read before you adopt)

- **Git is the multiplayer layer.** There is no account, hosted sync, or in-app permission matrix. That is what makes a 1–5 person team work without a server; it is the wrong product if you need SaaS ACL.
- **Agents can write as well as read.** Exposure is the point. Mistakes land in the same SoT — guardrails are workspace rules, skills, and `doctor`, not a sandbox ACL.
- **UX is still rough for non-technical teammates.** The desktop path works for dogfooding developers; several flows are still awkward enough that non-technical colleagues will feel the friction. We expect that gap to close with the trusted `1.0.0` surface (end of epic v1) — not with the current unsigned `0.x` preview.
- **Parallel edits on the same workspace remain a hard problem.** Two people (or a person and an agent) changing overlapping files still collide the usual git way. Git worktrees absorb some of that pain; they do not make concurrent project-library work feel solved. This is also why the validated range stops at five.
- **Not a chat substitute for a project library**, and not an enterprise workflow suite. If you want a board that hides the files, look elsewhere.

## Status: v0 (open-source, unsigned)

Builds are **unsigned and not notarized**. There is no Apple Developer ID on the build machine yet.

**What happens on first open of a downloaded build:** macOS will refuse to launch it. On Apple Silicon it usually reports the app as *damaged* rather than *unsigned*. That is Gatekeeper reacting to an unidentified download — not a corrupted file.

**Version rule:** epic `vN` ships only when that epic ends. **v0** ends with an unsigned `0.x` developer preview; **v1** ends with signed, notarized `1.0.0`. Do not spend `1.0.0` on an unsigned build.

Today this is aimed at developers who will clear quarantine or build from source — not a friction-free double-click download for a general audience. See **Get it** below for the exact `xattr` command and the source-build path.

## Get it

### CLI (no app required)

Node ≥ 20:

```sh
npx pm-all-in-one doctor
```

Full install paths and commands: [docs/cli.md](docs/cli.md).

### Cursor extension

Cursor installs third-party extensions from [Open VSX](https://open-vsx.org), not the Visual Studio Marketplace. After the first Open VSX upload, search **pm-all-in-one** in Cursor’s Extensions panel for `wenchuanlilizhao.pm-all-in-one`.

Sideload a local VSIX, or cut that listing: [docs/cursor-extension.md](docs/cursor-extension.md).

### Build the app from source (no Gatekeeper friction)

A locally built app carries no quarantine attribute, so it just opens.

```sh
cd app
npm install
npm run dev          # Electron window — not the bare Vite tab
npm run package:mac  # local .app / DMG
```

### Download a release

Prebuilt macOS artifacts: [GitHub Releases](https://github.com/WenchuanLiliZhao/pm-all-in-one/releases) (DMG + zip, Apple Silicon).

Because the build is unsigned, macOS will refuse the first open — on Apple Silicon it usually reports the app as *damaged* rather than *unsigned*. After moving it into `/Applications`:

```sh
xattr -dr com.apple.quarantine "/Applications/pm-all-in-one.app"
```

Only do that if you trust this source. The app embeds a terminal and reads/writes your workspace directory.

## Docs

| Doc | Role |
| --- | --- |
| [docs/cli.md](docs/cli.md) | CLI install and common commands |
| [docs/releasing.md](docs/releasing.md) | Cut app + npm releases |
| [docs/cursor-extension.md](docs/cursor-extension.md) | Package and publish the Cursor extension (Open VSX) |
| [app/DEVELOPMENT.md](app/DEVELOPMENT.md) | Develop the desktop shell |

Inside an opened workspace, agent-facing law lives in `AGENTS.md` → `.pm/agent.md` (not duplicated here).

## Names

| Surface | Value |
| --- | --- |
| Product name (repo, CLI, npm, app bundle) | `pm-all-in-one` |
| Cursor extension (Open VSX) | `wenchuanlilizhao.pm-all-in-one` |
| macOS `appId` | `com.pm-all-in-one.desktop` |
