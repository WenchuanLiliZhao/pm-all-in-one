---
name: pm-content-placement
description: Decide whether content belongs in a project description, an epic README, or a wiki node in this local-pm library. Use when creating or editing project descriptions, epic bodies, or wiki pages, or when promoting a closed epic's learnings.
---

# What goes where (project / epic / wiki)

- **Project description** (`issue-hierarchy/<projectId>/README.md`): long-lived
  area — what this line is, its boundaries, how it operates. Slow-changing.
  No campaign dates and no done criteria here.
- **Epic README** (`issue-hierarchy/<projectId>/<issueId>/README.md` when
  `level` is `epic`): this campaign — why now, scope / non-goals, done
  criteria, status, dates. Freezes when status becomes `done` or `cancel` —
  going stale is history, not a defect.
- **Wiki node**: **current truth** — what something is, and its constraints. It
  carries a maintenance obligation — going stale *is* a defect.

| Question | Put it in |
| --- | --- |
| Still a standing rule next year? | Wiki |
| This wave's why / done / dates? | Epic |
| What this line is long-term? | Project description |

- Do not create one overview wiki page per project or per running epic. Wiki
  is organized by topic; a tree that mirrors the project/epic list has no
  reason to exist. Topic pages may be written anytime.
- Overlap is fine — two owners of the same fact is not. One place maintains it;
  the other links (`@wiki-<id>`) or marks a dated snapshot.
- When an epic closes, promote what became stable into wiki. Do not draft a
  parallel campaign-overview wiki page alongside a running epic. Do not run
  a promote ritual when a task or subtask alone is marked done.
