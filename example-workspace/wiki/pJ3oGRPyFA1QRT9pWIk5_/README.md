Users often open only the **PM workspace root** as an IDE folder. In that case they never see the product repo `pm-all-in-one` system prompts, and agents tend to treat the tree like a normal repo (invent nanoids, edit `parentId`, touch `created`, etc.).

The fix is not a second documentation set—it is wiring existing structural law into the IDE’s conventional entrypoint, plus **Agent Skills** for editorial policy and user conventions.

## Three harness layers

| Layer | File | Role | Ownership |
| --- | --- | --- | --- |
| IDE entry (thin) | Workspace root `AGENTS.md` | Cursor etc. ingest by default; identity + pointer + hard-ban summary | Product seed; do not grow custom law here |
| Mechanical law | `.pm/agent.md` | Disk law only (ids, locators, hierarchy, create/move, timestamps, mentions) | **Product-owned** (`rev N` stamp; `local-pm doctor` warns on drift) |
| Situational / custom | `.agents/skills/custom/<name>/SKILL.md` | User / library conventions; host loads by `description` | **User-owned** |
| Create-time seed | `.agents/skills/core/<name>/SKILL.md` | Product editorial helpers (`pm-content-placement`, `pm-create-skill`, …) | Copied once at create; not product-refreshed |

`AGENTS.md` is **not** a second full law. Custom conventions go in skills (see skill `pm-create-skill`), not by editing `AGENTS.md` or `.pm/agent.md`.

The product repo root `pm-all-in-one/AGENTS.md` governs **building the product**; this workspace harness governs **operating this PM library**. Do not copy the former wholesale into the latter.

## App templates ≠ system prompt text

Create-time seed text lives as real files under the product’s `electron/workspace-template/` (mirrored workspace shape). `scaffoldWorkspace` **copies that folder** into a new workspace; it is **not** an API system prompt the app injects when calling a model.

| Location | What it is |
| --- | --- |
| Product `electron/workspace-template/` | Source files at create time (copy-paste seed), including `.agents/skills/core/pm-content-placement/` and `core/pm-create-skill/` |
| Workspace on-disk copy | What the IDE AI consumes: `AGENTS.md` → `.pm/agent.md`, plus host-discovered skills under `.agents/skills/core/` and `.agents/skills/custom/` |

Copies are written **once at create**. The app does **not** rewrite harness files on open. `.pm/agent.md` carries a `<!-- local-pm agent.md rev N -->` stamp; `doctor` reports `agent-md-outdated` / `agent-md-modified` when it diverges from the shipped template (**detection only** — no auto-refresh yet). Shipped skills are user-owned and are not product-refreshed. Design history: @issue-blwwMj6xHRYLCWXfa9wwl::FGQFTUjO4DrwyLCj8GQja.

The app carries **no** other in-app system-prompt surfaces (no clipboard promote briefs, no priority scoring prompts in product UI).

## Who reads them, who does not

| Consumer | Reads harness Markdown? |
| --- | --- |
| IDE AI | Yes — root `AGENTS.md`, then `.pm/agent.md`; skills via host discovery of `.agents/skills/` |
| Electron UI / `local-pm` CLI | **No** for behavior — code (`store` / `doctor`, etc.) is authoritative; CLI only **reports** agent-md drift |

So installing the app does **not** mean the IDE AI will follow the rules. What matters is whether the opened workspace root **has** this harness. Without the app installed, an already-scaffolded library still feeds the prompts / skills.

## Principle: prompt convention, not a path engine

There is no “detect pm-all-in-one on this machine and auto-mount rules” logic. The chain is:

1. IDE opens a folder → stuffs root `AGENTS.md` into agent context;
2. the body says in natural language: read `.pm/agent.md` first;
3. the host may also surface Agent Skills from `.agents/skills/` (progressive disclosure via each skill’s `description`);
4. whether the agent actually reads and obeys is prompt discipline.

The relative path `.pm/agent.md` is a location note for humans / agents, not a runtime path check.

## New Workspace writes them automatically

`scaffoldWorkspace` copies the template folder, which includes root `AGENTS.md`, `.pm/agent.md`, and `.agents/skills/core/` (at least `pm-content-placement` and `pm-create-skill`). A standalone empty directory always gets the root pointer; if we later support “nest into an existing host repo,” avoid overwriting a host `AGENTS.md` that already exists.

## Relation to create soft rules

This harness only solves **discovery**: so an IDE AI that only opened the workspace can find the law and conventions. They do **not** force the allocator—hand-made directories can still happen; compliance remains soft rules, with doctor / Adopt as recovery. Create path and limits: @wiki-D9Sd2WYlM-2hdgcXcUbhl.

## One-liner for practice

To make an “IDE AI that only opened the workspace” obey pm-all-in-one law: rely on on-disk `AGENTS.md` → `.pm/agent.md` plus `.agents/skills/core/` and `.agents/skills/custom/`, not on where the app is installed, and not on the CLI reading these Markdown files for its own behavior.
