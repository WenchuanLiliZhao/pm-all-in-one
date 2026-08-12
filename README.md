# pm-all-in-one

Project management for small teams where **humans and AI agents share one workspace**.

Jira, chat threads, and tool-only PM stacks split context across systems agents cannot reliably read or continue. This product keeps the project library as **files next to your code**: a clone is the full state; collaboration is git.

This repository is the product home — macOS app + [`pm-all-in-one`](https://www.npmjs.com/package/pm-all-in-one) CLI.

We run the product on itself: development of **pm-all-in-one** is planned and tracked in a local-pm workspace. A filtered snapshot of that dogfood ships in-repo as [`example-workspace/`](example-workspace/) (Open Folder on that directory in the app — not the product repo root). The README, releases, and disk contract below are what that dogfood has to survive, not a slide deck.

## What matters

1. **Workspace as a standard** — like an npm workspace: a public directory contract, not a private database behind an API. App, CLI, and agents all operate on the same files.
2. **Wiki and issues fully exposed to AI** — Markdown bodies, `props.ts`, and live `@issue-…` / `@wiki-…` / `@member-…` / `@handoff-…` locators resolve by path. No running server required to find a node.
3. **Handoff as a first-class node** — a sent “who → whom, about which work” record on disk (`handoffs/`), not chat residue or a buried comment.

The desktop UI is the **easy way in** — an intuitive path so people can accept this model. It is not the definition of the product. The workspace on disk is; the CLI and agent rules (`AGENTS.md` / `.pm/agent.md` / skills) are peers to the UI.

## Who this is for / not for

The dividing line is how work is produced, not company headcount: **is company state files on disk that agents can read and humans review in git?**

**Likely a fit**

- Solo developers or AI-native small teams who already share one workspace with agents
- Agent fleets / automation studios that need a durable, diffable ledger of intent (not chat residue)
- Knowledge or delivery work where the deliverable is already a repo of documents + code
- A pod inside a larger org that keeps agent-driven work on disk, while enterprise tickets stay elsewhere

**Not a fit**

- Compliance-heavy ticket flows (procurement, legal, regulated ops) that need a remote SoT and approval matrix
- Orgs whose primary users only use web forms — login, roles, SLA reports, and workflow engines as first-class
- Anyone who wants hosted sync, in-app ACL, or a board that hides the files

**Validation (honest):** There is **no large-team experiment** yet. Dogfood and active testing stay in the **3–5 person** range. Larger headcount may still adopt the model for an AI-native layer, but that scale is unproven here.

## Not Jira (even when it looks like Jira + Confluence)

The desktop shell borrows the familiar shape of **Jira + Confluence** — projects, issue trees, wiki, status and priority — **only so people do not have to relearn where to click**. Familiar chrome is onboarding, not identity.

There is one structural difference, and the rest follows from it:

> Jira's source of truth is a remote database reached through an API. Here it is a directory of text files you already have checked out.

What that buys, concretely:

- **Resolution without a server.** Every reference is a path join — `@issue-<projectId>::<issueId>` → `issue-hierarchy/<projectId>/<issueId>/`, `@wiki-<id>` → `wiki/<id>/README.md`. No index to rebuild, no app running, no auth.
- **Cross-cutting questions are a grep, not N API calls.** From this repo, against the shipped snapshot:

```sh
rg -l '"status": "in-progress"' example-workspace/issue-hierarchy   # everything in flight
rg -l 'blockedBy' example-workspace/issue-hierarchy                 # every declared dependency
```

- **A change of plan is a diff.** Intent moves on branches, arrives in PRs, and reverts like any other commit. `git log` over `issue-hierarchy/` is the decision history, with no separate audit feature.
- **Agent writes are typed, not trusted.** `props.ts` is `satisfies`-checked against a generated `schema.d.ts`, and a `level` that contradicts its `parentId` is reported by `pm-all-in-one doctor` — **never quietly reinterpreted**. A malformed write fails loudly instead of landing silently.

**"Jira has an MCP server now."** It does, and it works. The gap is not access, it is shape. An API answers questions an agent already knew to ask, one paginated call at a time, and hands back an unversioned snapshot it cannot diff. A directory hands over the corpus: grep it, `git log` it, and read the code in the same pass. Same reason a database endpoint is not "having the repo".

**Where the files live is your call.** A workspace is just a directory, so it can sit inside your code repo — intent and implementation in one PR — or be a repo beside it. pm-all-in-one takes the second path: the live dogfood library is a separate repo because it tracks more than this codebase, and [`example-workspace/`](example-workspace/) is a filtered snapshot of it. Same-repo co-review is available to you; it is not what we run daily.

**What it costs.** The ladder is fixed at epic → task → subtask — no configurable workflows, schemes, or issue types. That is a real capability loss against Jira, taken deliberately: a structure every workspace can redefine is a structure no agent learns once. Per-project custom fields exist (`custom-props.ts`), but the three ranks do not move. And Jira still wins at cross-org ticket flow, audit reports, SLA, and ACL — that is its home field, **walking onto it is losing**, and this product stays off it on purpose.

## Tradeoffs (read before you adopt)

- **Git is the multiplayer layer.** There is no account, hosted sync, or in-app permission matrix. That is intentional for developer-shaped small teams; it is the wrong product if you need SaaS ACL.
- **Agents can write as well as read.** Exposure is the point. Mistakes land in the same SoT — guardrails are workspace rules, skills, and `doctor`, not a sandbox ACL.
- **UX is still rough for non-technical teammates.** The desktop path works for dogfooding developers; several flows are still awkward enough that non-technical colleagues will feel the friction. We expect that gap to close with the trusted `1.0.0` surface (end of epic v1) — not with the current unsigned `0.x` preview.
- **Parallel edits on the same workspace remain a hard problem.** Two people (or a person and an agent) changing overlapping files still collide the usual git way. Git worktrees absorb some of that pain; they do not make concurrent project-library work feel solved. We have not found a better answer we are willing to pretend is finished.
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
| [example-workspace/](example-workspace/) | Filtered dogfood snapshot (open this folder in the app) |
| [docs/cli.md](docs/cli.md) | CLI install and common commands |
| [docs/releasing.md](docs/releasing.md) | Cut app + npm releases |
| [app/DEVELOPMENT.md](app/DEVELOPMENT.md) | Develop the desktop shell |

Inside an opened workspace, agent-facing law lives in `AGENTS.md` → `.pm/agent.md` (not duplicated here).

## Names

| Surface | Value |
| --- | --- |
| Product name (repo, CLI, npm, app bundle) | `pm-all-in-one` |
| macOS `appId` | `com.pm-all-in-one.desktop` |
