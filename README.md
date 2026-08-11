# pm all in one

Project management for small teams where **humans and AI agents share one workspace**.

Jira, chat threads, and tool-only PM stacks split context across systems agents cannot reliably read or continue. This product keeps the project library as **files next to your code**: a clone is the full state; collaboration is git.

This repository is the product home — macOS app + [`pm-all-in-one`](https://www.npmjs.com/package/pm-all-in-one) CLI.

We run the product on itself: development of **pm all in one** is planned and tracked in a local-pm workspace. The README, releases, and disk contract below are what that dogfood has to survive, not a slide deck.

## What matters

1. **Workspace as a standard** — like an npm workspace: a public directory contract, not a private database behind an API. App, CLI, and agents all operate on the same files.
2. **Wiki and issues fully exposed to AI** — Markdown bodies, `props.ts`, and live `@issue-…` / `@wiki-…` / `@member-…` / `@handoff-…` locators resolve by path. No running server required to find a node.
3. **Handoff as a first-class node** — a sent “who → whom, about which work” record on disk (`handoffs/`), not chat residue or a buried comment.

The desktop UI is the **easy way in** — an intuitive path so people can accept this model. It is not the definition of the product. The workspace on disk is; the CLI and agent rules (`AGENTS.md` / `.pm/agent.md` / skills) are peers to the UI.

## Tradeoffs (read before you adopt)

- **Git is the multiplayer layer.** There is no account, hosted sync, or in-app permission matrix. That is intentional for developer-shaped small teams; it is the wrong product if you need SaaS ACL.
- **Agents can write as well as read.** Exposure is the point. Mistakes land in the same SoT — guardrails are workspace rules, skills, and `doctor`, not a sandbox ACL.
- **UX is still rough for non-technical teammates.** The desktop path works for dogfooding developers; several flows are still awkward enough that non-technical colleagues will feel the friction. We expect that gap to close with the trusted `1.0.0` surface (end of epic v1) — not with the current unsigned `0.x` preview.
- **Parallel edits on the same workspace remain a hard problem.** Two people (or a person and an agent) changing overlapping files still collide the usual git way. Git worktrees absorb some of that pain; they do not make concurrent project-library work feel solved. We have not found a better answer we are willing to pretend is finished.
- **Not a chat substitute for a project library**, and not an enterprise workflow suite. If you want a board that hides the files, look elsewhere.

## Status: v0 (open-source, unsigned)

Builds are **unsigned and not notarized**. There is no Apple Developer ID on the build machine yet, so macOS treats a downloaded build as an unidentified app.

**Version rule:** epic `vN` ships only when that epic ends. **v0** ends with an unsigned `0.x` developer preview; **v1** ends with signed, notarized `1.0.0`. Do not spend `1.0.0` on an unsigned build.

Today this is aimed at developers who will clear quarantine or build from source — not a friction-free double-click download for a general audience.

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
xattr -dr com.apple.quarantine "/Applications/pm all in one.app"
```

Only do that if you trust this source. The app embeds a terminal and reads/writes your workspace directory.

## Docs

| Doc | Role |
| --- | --- |
| [docs/cli.md](docs/cli.md) | CLI install and common commands |
| [docs/releasing.md](docs/releasing.md) | Cut app + npm releases |
| [app/DEVELOPMENT.md](app/DEVELOPMENT.md) | Develop the desktop shell |

Inside an opened workspace, agent-facing law lives in `AGENTS.md` → `.pm/agent.md` (not duplicated here).

## Names

| Surface | Value |
| --- | --- |
| Display / app bundle | pm all in one |
| Repo / slug | `pm-all-in-one` |
| CLI / npm | `pm-all-in-one` |
| macOS `appId` | `com.pm-all-in-one.desktop` |
