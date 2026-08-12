This page only nails **how entity directory ids are produced**. It underpins the “references resolve by path join / no writer handle” base in @wiki-hXnkzhcPc1eVN25SwOZ3d; create entry points and soft-rule limits are in @wiki-D9Sd2WYlM-2hdgcXcUbhl.

## Law vs algorithm

| Layer | What it says | Where it lives |
| --- | --- | --- |
| **Law** | Ids are opaque `nanoid(21)`; directory name = id; never rename; no shared counter; collision resistance comes from entropy | `.pm/agent.md` (mechanical law), this workspace’s `AGENTS.md` (thin entry); editorial policy is not here |
| **Algorithm** | Draw + no same-name sibling under the parent dir + bounded retries | Product implementation: `allocateEntityId` (`app/electron/core/ids.ts`) |

The law does not depend on whether `pm-all-in-one` / the app is installed. Without app / CLI, any compliant process can still draw ids by the same law; what is missing is a trusted implementation and `doctor` / `adopt` guardrails — not the law itself.

## Algorithm (reproducible)

For project / issue / wiki-node / member / handoff, the allocator follows one path: draw an unused entity id under the matching parent directory.

1. Ensure the parent directory exists (create it if missing).
2. Call `nanoid(21)` with the URL-safe alphabet `A-Za-z0-9_-` (same as nanoid’s default).
3. Validate shape: the whole string matches `^[A-Za-z0-9_-]{21}$`.
4. If `parentDir/<id>` already exists, discard and return to step 2.
5. Retry at most **8** times; still failing throws (practically never — entropy does the work; exists-check is a seatbelt).
6. Return that id; the caller uses it as the new directory name and writes valid meta / body.

Wrappers only swap the parent directory:

| Function | Parent directory |
| --- | --- |
| `allocateProjectId` | `issue-hierarchy/` |
| `allocateIssueId` | `issue-hierarchy/<projectId>/` |
| `allocateWikiNodeId` | `wiki/` |
| `allocateMemberId` | `members/` |
| `allocateHandoffId` | `handoffs/` |

**Uniqueness is scoped to the parent directory, not cross-kind across the whole library.** The contract does not promise a wiki id and a member id never share the same string; practice relies on entropy. Issue ids are unique only within a project, so the live locator is `@issue-<projectId>::<issueId>`.

Live references always carry a kind prefix (`@issue-…` / `@wiki-…` / `@member-…` / `@handoff-…`); `@` completion in body editors offers the same candidate set everywhere, and insertion is always the full form. There is no short form that omits the prefix within a kind.

No writer handle, no global sequence, no central service. Two people creating in two clones at once rely on token space not to collide; git just merges two new directories.

## How IDE AI should use this

AI does **not** invent an id, and should not hand-craft strings that “look like nanoid.”

- **With CLI / app:** go through create entry points and let the allocator draw (issues: `pm-all-in-one issue create`; wiki: prefer UI / `createWikiNode` for now — CLI gap: @wiki-D9Sd2WYlM-2hdgcXcUbhl).
- **Without pm-all-in-one:** the law still holds — an equivalent implementation (same alphabet, length, exists-check) may draw and then create the directory; risk is wrong shape, skipped validation, or a directory without valid `props.ts`. A hand-made directory is **not** a formal issue until `adopt`.

## Why nanoid, not readable slugs

- Directory names are part of the reference address; renaming orphans every `@issue-…` / `@wiki-…` / `@member-…` / `@handoff-…` and off-disk bookmarks.
- Display names (titles) change often; ids must not.
- Small-team concurrent create does not need to coordinate “who owns the next number.”

## Do not

- Do not invent directory ids by hand, and do not rename existing nanoid directories.
- Do not read “CLI not installed” as “mkdir is fine” — either call the allocator, or use an equivalent algorithm and own the `doctor` risk.
- Do not expand the create-entry matrix or review-surface design on this page — see @wiki-D9Sd2WYlM-2hdgcXcUbhl and @wiki-hXnkzhcPc1eVN25SwOZ3d.
