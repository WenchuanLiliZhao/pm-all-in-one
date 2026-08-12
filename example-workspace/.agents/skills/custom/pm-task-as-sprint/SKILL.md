---
name: pm-task-as-sprint
description: Schedule tasks and subtasks in this local-pm library using the owner's sprint-style preference — one/two-week Mon–Fri task windows, subtasks inherit the parent task dates. Use when setting or changing startDate/endDate, planning work, creating tasks/subtasks with dates, or when the user asks about scheduling, sprints, or timeboxing.
---

# Task as sprint (scheduling preference)

In this library, treat a **task** as a **sprint**, not as a fine-grained calendar slot.

## Task dates

- Prefer a **1-week or 2-week** window.
- `startDate` = **Monday**; `endDate` = **Friday** (same week for 1 week; Friday of the second week for 2 weeks).
- Do not invent mid-week starts/ends or weekend endpoints unless the user explicitly overrides.

## Subtask dates

- Set each subtask's `startDate` / `endDate` to **the same interval as its parent task**.
- Do **not** carve subtasks into smaller day/hour ranges — the owner prefers coarse windows.
- If the parent task's dates change, update its subtasks to match (unless the user says otherwise).

## Mental model

| Level | Role in scheduling |
| --- | --- |
| epic | Campaign / wave; dates optional and coarser if set |
| **task** | **Sprint container** — the unit that owns the timebox |
| subtask | Work item inside the sprint; inherits the task window |

## When scheduling

1. Pick the sprint length (1 or 2 weeks) with the user if unclear; default to **1 week** when both fit.
2. Anchor the task to Mon–Fri.
3. Copy that pair onto every subtask under it.
4. Leave epic dates alone unless asked; do not auto-shrink them to the task sprint.
