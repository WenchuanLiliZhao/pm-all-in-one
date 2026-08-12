This note records the current pm-all-in-one conventions for “who allocates ids, how AI should create, and where the constraints stop.” The hierarchy ladder itself (`parentId` + `level`) is in @wiki-yp5aoc8X1YX4UjCT5Ec-w; this page covers only the **create path**. CLI package details: @wiki-MEJy28mhBISjYTGCr8IIo.

## There is no standalone create-issue script

The product has no separate `create-issue.sh`. Creation goes through one shared set of core functions, with multiple entry points:

| Entry | What it calls | Typical user |
| --- | --- | --- |
| Electron UI | IPC → `createIssue` / `createWikiNode` / `createMember` / `createHandoff` | Human |
| `pm-all-in-one` CLI | `app/electron/cli.ts` → same | Human / AI (terminal) |
| Local HTTP API (`dev:web`) | `server/` → same | Not the daily QA surface |

The installed CLI binary and npm package are both **`pm-all-in-one`** (see @wiki-MEJy28mhBISjYTGCr8IIo). Older notes may say `local-pm`; treat that as the historical command name before the first public npm publish.

CLI examples:

```sh
pm-all-in-one issue create --project <projectId> --parent <issueId|root> --title "…"
pm-all-in-one issue move   --project <projectId> --issue <issueId> --parent <issueId|root>
pm-all-in-one member create --title "…"
pm-all-in-one handoff create --from <memberId> --to <memberId> --related-project <projectId> [--title "…"]
```

Cold path without the app: `npx pm-all-in-one …`. With the app: **File → Install Command Line Tool…**, or use the in-app terminal PATH.

## What AI is expected to do

Workspace root `AGENTS.md` → `.pm/agent.md` (mechanical law) plus `.agents/skills/` (editorial / custom) requires:

- **Never invent** nanoid directories; create only via the app or CLI (the allocator draws the id).
- **Do not hand-edit** `parentId` / `level` / `created` / `updated`; reparent with `issue move` (rewrites `level` for the whole subtree).
- A hand-made directory is not a valid issue until `pm-all-in-one adopt` (or UI Adopt).
- Live locators always use kind prefixes (`@issue-…` / `@wiki-…` / `@member-…` / `@handoff-…`); bare text, never backticks.

So a compliant AI **should** use `pm-all-in-one issue create` (or a human create in the UI), not `mkdir` + hand-written `props.ts`. In the IDE you usually hit the **CLI**, not Electron’s `createIssue` IPC; both share the same implementation.

## Limit: soft rules today, not enforcement

**There is no technical gate.** The IDE / agent does not block “hand-made directories” or “hand-edited parentId” at the filesystem layer. Compliance depends on:

1. the agent reading and following `.pm/agent.md` / `AGENTS.md` / relevant `.agents/skills/`;
2. the operator installing `pm-all-in-one` (npx or Install Command Line Tool…) when it is missing, instead of falling back to hand edits.

Therefore:

- even if the user only `cd`s into the workspace in the IDE, there is **no guarantee** the AI will take the create path;
- the rules **nudge** toward the allocator; compliance is convention, not a lock;
- recovery after mistakes is **report a violation / `pm-all-in-one doctor` / Adopt**, not a hard failure at create time (for the hand-written path).

This is an intentional stage choice: the disk stays readable, git stays collaborative, agents can edit body text directly; structural fields rely on law + doctor, not on making the whole library write-only through a service.

## Extra gap for wiki create

As of writing, the `pm-all-in-one` CLI **does not yet** have `wiki create`. The proper wiki-node allocator is `createWikiNode` (app / HTTP API / same core module). In a pure-terminal scenario, an agent that needs a new wiki must temporarily call that implementation (e.g. against a built `dist-cli/core/wiki.js`), or wait for a human to create it in the UI and then write the body.

This is asymmetric with issues / members / handoffs (those have CLI create). Until wiki create lands, wiki create is more tempting to hand-invent ids—be even more deliberate about using the allocator.

## Practical checklist

- New issue: `pm-all-in-one issue create` (or UI); confirm the directory name is an allocated nanoid.
- Reparent: `pm-all-in-one issue move`; do not only edit `parentId`.
- New member / handoff: `pm-all-in-one member create` / `pm-all-in-one handoff create` (or UI).
- New wiki: prefer UI / `createWikiNode`; reference with `@wiki-<id>` after writing.
- Suspect broken structure: `pm-all-in-one doctor`; stray directories: `pm-all-in-one adopt`.
- Body / non-structural fields only: edit `README.md` etc. directly (see `.pm/agent.md` “Editing by hand”).

## If we harden later

If the product turns soft rules into enforcement, the direction is roughly: CLI coverage for wiki; IDE / agent environments that always discover `pm-all-in-one`; optionally reject or quarantine un-adopted hand-made directories. Until then, the soft rules + doctor / Adopt described here remain the current truth.
