Collaboration still runs on git. This UI only makes two things honest in the app: whether the remote has anything new, and what is still only on this computer. There is no in-app commit or push.

Related: hosting boundary @wiki-X-Z3_3kcrIQ--pNVQhzcw; product stance (collaboration is git) @wiki-6HxCNuSO6tZMP6Te6JRY5.

## Mental model: two states only

| User language | Meaning |
| --- | --- |
| **Synced to remote** | Clean relative to upstream; no unsynced node changes locally |
| **Only on this computer** | Uncommitted or unpushed changes; colleagues cannot see them yet, and they can be lost if this machine dies |

Do not use commit / ahead / dirty / upstream on the primary UI path. `ahead` (commit count) is intentionally not shown — it is commit-scoped and cannot be limited to the workspace path. The panel only reports path-scoped, node-aggregated counts.

## Entry

Single entry: **Changes** (mac titlebar icon or non-mac topbar button). Opening it shows a panel; it does not Sync immediately.

- **Top — Incoming** — When the remote has new changes, show a count and offer **Sync** (`git pull --ff-only`). Sync is blocked while there are uncommitted local edits; the UI tells you to finish those in the terminal first.
- **Bottom — Only on this computer** — Lists unsynced items **by node** (issue / project / wiki / member / handoff / workspace), with **Props** vs **Body** marks. Paths that do not belong to a node fold into **Other files**. Clicking a row opens that node. When something is local-only, **Push from terminal** opens the built-in terminal (the app itself does not push). The path set matches `git status` / Cursor Source Control: a props file that only bumps system `updated` (or an undo that restores editable fields but leaves a different `updated`) still appears as **Props**.

Footer honesty:

- No remote configured → say so; do not pretend synced
- `git fetch` failed → Offline + last-checked time; do not show a fake 0
- Clean and nothing Incoming → Synced to remote

## Where the data comes from

| Capability | Location |
| --- | --- |
| ahead / behind / dirty / fetch | `electron/core/desktop/git-sync.ts` → `getGitSyncStatus` |
| Unsynced list aggregated by node | `electron/core/desktop/git-changes.ts` → `getUnsyncedChanges` (local only; no fetch; same dirty paths as `git status`) |
| Dual bridge | `PmApi.getGitSyncStatus` / `getUnsyncedChanges` / `pullWorkspace`; web stub is not-repo |
| UI | `components/git-sync-panel`; state in `git-sync-context` |

Refresh:

- Window focus + about every 60s: networked status (updates Incoming)
- Workspace disk changes (`onChanged`): after ~1s debounce, **local** refresh of status + unsynced list (no network) — so after you edit an issue in the app, Changes should update within about a second

Lab matrix: `#/lab/git-sync-panel` (nine scenarios).

## Explicitly out of scope

- In-app commit / push / “publish this batch”
- Workspace-wide history timeline / full “since last time” ledger
- Real git on the web bridge (stub only)
- Promoting the `updates` markdown field into a seventh node type

## How to test

Always use the **Electron window** (`cd app && npm run dev`), workspace `/Users/wenchuanzhao/Documents/GitHub/new-world`. Do not use bare `:5173`.

| Action | Expect |
| --- | --- |
| Open Changes | Two-band panel (Incoming / Only on this computer); entry label is Changes, not Sync |
| Change an issue’s status in the app; reopen the panel after ~1s | That issue appears with **Props**; no manual refresh needed |
| Only bump `updated` on disk (or undo editable fields leaving a new `updated`) | Same issue still listed with **Props** (matches Cursor SCM) |
| Edit the same issue’s body | Same row shows **Body** (or Props+Body) |
| Built-in terminal: `git add -A && git commit`, do not push | Row still under Only on this computer |
| `git push` | Back to Synced to remote; local list empty |
| Create a new issue (untracked directory) | One issue row with both Props and Body |
| Edit a wiki page body | Wiki row; Body only |
| With local unsynced items, click Push from terminal | Built-in terminal opens |
| After the remote advances, wait for focus / ~1 minute, or reopen the panel | Incoming shows new changes; Sync pulls when the tree is clean |
| Click Sync while uncommitted local edits exist | Sync disabled or prompts terminal first; no silent overwrite |
| Sync / network poll while offline | Footer Offline + last checked; does not claim synced |
| Scan all visible panel copy | No commit, ahead, dirty, or upstream (except “Push from terminal”) |
| Lab `#/lab/git-sync-panel`, walk nine scenarios | Layout and copy sane for each (especially offline, clean, incoming+local, only otherFiles) |

Fastest smoke: edit status → commit without push → push → create issue → scan forbidden words.
