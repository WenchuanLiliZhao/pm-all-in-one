---
name: pm-create-skill
description: Create or place a custom Agent Skill for this local-pm workspace. Use when the user asks to add a convention, prompt, editorial policy, or reusable agent workflow for this library — including /create-skill and requests to write a new SKILL.md.
---

# Creating a skill in this workspace

Custom conventions for this library live as **Agent Skills**, not as edits to
`AGENTS.md` or `.pm/agent.md`.

## Where to put it

- **Workspace-wide:** `.agents/skills/<name>/SKILL.md`
- **Per project:** `issue-hierarchy/<projectId>/.agents/skills/<name>/SKILL.md`
  (hosts that support nested skills scope it to that subtree automatically)

Use **one** directory: `.agents/skills/`. Do **not** copy the same skill into
`.cursor/skills/`, `.claude/skills/`, or other host-specific trees.

## Naming and frontmatter

Each skill is a directory whose name is the skill id. Required `SKILL.md`
frontmatter:

```yaml
---
name: my-skill-name
description: What it does and when to use it.
---
```

Constraints:

- `name` must equal the parent folder name
- lowercase letters, digits, and hyphens only; max 64 characters; no leading,
  trailing, or consecutive hyphens
- `description` max 1024 characters — write **what** and **when**; hosts load
  this at startup to decide whether to open the body
- keep the body under ~500 lines; put long references in sibling files

## Do not

- Edit `AGENTS.md` or `.pm/agent.md` to add your own conventions
- Invent a second copy under `.cursor/skills/` “just in case”
- Put mechanical disk law (ids, locators, `parentId` / `level`, timestamps) in a
  skill — that stays in `.pm/agent.md` (product-owned)
