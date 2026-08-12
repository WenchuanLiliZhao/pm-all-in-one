Agents that open only this PM workspace (no product install required) still need to place new wiki-nodes in the right Contents parent. This page records **where that knowledge lives**, and what it does **not** include.

Related: discovery of law files @wiki-pJ3oGRPyFA1QRT9pWIk5_; create / allocator path @wiki-D9Sd2WYlM-2hdgcXcUbhl; id draw @wiki-kF6sQ8ynVamZ-AL5QzTtc; harness / skills decision @issue-blwwMj6xHRYLCWXfa9wwl::FGQFTUjO4DrwyLCj8GQja.

## What “knowing Contents” means

Two facts:

1. **Law** — every wiki-node must appear in Contents (`wiki/sidebar.ts` `ref` tree). Create always inserts a Contents entry (`parentId` optional; default = Contents root).
2. **Placement** — which existing page (or root) should be the parent for *this* new node.

Law without the live tree is not enough to choose a parent. The live tree without law is easy to treat as “optional TOC.” Both are on disk in the workspace.

## Workspace disk (enough to know)

| What | Where |
| --- | --- |
| IDE entry | Workspace root `AGENTS.md` → points at `.pm/agent.md` |
| Structural law | `.pm/agent.md` Wiki section (Contents required; create via app/CLI; `parentId` defaults to root) |
| Editorial placement | Agent Skill `.agents/skills/core/pm-content-placement/SKILL.md` (project / epic / wiki boundaries) |
| Live Contents tree | `wiki/sidebar.ts` (nested `ref` nodes — **read this** before create) |
| Flat inventory | `wiki/<id>/` dirs (All pages); same set as Contents after the required-Contents invariant |

`.pm/tree.md` is the **issue** map only. It does **not** render wiki Contents. Do not use it to choose a wiki parent.

## Product / app side (not required to know)

| What | Role |
| --- | --- |
| Product repo `pm-all-in-one/AGENTS.md` | Law for **building the product**, not operating this library |
| `electron/workspace-template/` | Seed files copied once into new workspaces: `.pm/agent.md`, `AGENTS.md`, `.agents/skills/core/pm-content-placement/`, `.agents/skills/core/pm-create-skill/`, and other static create-time files |

There is **no** in-app model SDK that injects the current Contents tree into an agent session. Installing or running Electron does not feed IDE AI a second system prompt about wiki placement.

## Know ≠ create

Workspace-only is enough for an IDE agent to **discover** the rules and the tree (read the files above).

Actually **creating** a node still requires the allocator (`createWikiNode` via UI, or the same core from a built CLI / script). Hand-minting `wiki/<invented-id>/` violates `.pm/agent.md` even if you also edit `sidebar.ts`. Today the CLI may still lack `wiki create`; until it exists, prefer the app UI or call the shared core — details in @wiki-D9Sd2WYlM-2hdgcXcUbhl.

## Practical checklist

1. Read `.pm/agent.md` (Contents required).
2. Read `wiki/sidebar.ts` and pick `parentId` (or root).
3. Create through the allocator with that parent — never invent directory ids.
4. Prefer updating an existing topic page over adding a parallel overview (editorial policy: skill `pm-content-placement`).

## Current section map under @wiki-6HxCNuSO6tZMP6Te6JRY5

When creating a new product standing note, prefer one of these parents (not the Contents root under pm-all-in-one, unless it is a new section):

| Section | Parent |
| --- | --- |
| Disk shape, ladder, ids, props, membership | @wiki-oU9Fj3_lJOW9pHnLWvqx3 |
| Agent law, create path, CLI, machine-local paths | @wiki-YVMDahIyZt0DyMIFOiOfq |
| Electron/server, save contracts, browser chrome | @wiki-7aR8hAfpQc9S9cOV7yBMl |
| Product thesis / orientation | hang directly under @wiki-6HxCNuSO6tZMP6Te6JRY5 (sibling of the sections) |
