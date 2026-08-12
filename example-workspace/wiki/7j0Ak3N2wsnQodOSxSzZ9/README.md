This workspace uses **member nodes** for “who is on this project,” **assignee** on issues for “who owns this work,” and **createdBy** (a system field) for “who created it.” All of these are **facts** and go into git.

## Current model

- Layout: `members/<nanoid>/{props.ts,README.md,avatar.*}`. Ids are opaque; renaming the display name only changes the title.
- `membership: involved | left`: people who left stay on disk; the picker only lists involved; historical references still resolve.
- **No roles, no login gate.** “Who you are (for attribution)” is a skippable local setting (`.pm/local.json` → `me`), not authentication. The real security boundary remains git credentials.
- When CLI / agents create bare, `createdBy` may be empty.
- Machine-absolute **code paths are not a member attribute** — do not write them into `members/*/README.md`. Use `.pm/local.md` (interim) / future `.pm/local.json` `repos`; see @wiki-YbNSJCTtN-d33xG4h4N6D.

Roster entry: @member-Ff09X74FARCjAB-7yp3vO.

## Facts vs policy

| Allowed in git (facts) | Not in the local edition (policy) |
| --- | --- |
| Whether this person is present; who owns the work; who created it | Who can change what; admin / viewer; forced login |

When real auth arrives: the IdP becomes authoritative, `members/` demotes to a projection; `assignee` / `createdBy` references need zero migration. If we write roles now, that day becomes a rewrite.

## Doctor

- `member-broken-ref` — reference points at a missing member
- `assignee-left-member` — open issue assigned to someone who left (the real value of `left`)
- `member-invalid-name` — directory that is not a nanoid
- `agent-md-outdated` — `.pm/agent.md` missing, unstamped, or lagging the shipped template rev (detection only)
- `agent-md-modified` — same product rev as the template, but the body was edited

## Do not

- Do not gate writes on member identity.
- Do not encode “current user” as a module singleton.
- Do not create `members/roster.ts`, and do not use `members/archive/` to express leaving.
- Do not hand-edit `createdBy`; do not delete member directories.

Design rationale is folded into this page; hosting / auth boundary: @wiki-X-Z3_3kcrIQ--pNVQhzcw.
