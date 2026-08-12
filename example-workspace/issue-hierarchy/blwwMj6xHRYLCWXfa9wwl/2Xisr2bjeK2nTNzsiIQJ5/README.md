## What to do

Land a **filtered snapshot** of pm-all-in-one dogfood as **`example-workspace/`** inside the product repo (`pm-all-in-one/example-workspace/`). Copy/paste (or scripted filter) — **not** a git submodule and **not** a second live SoT. App packages must not include this tree.

Purpose: measurable evidence that **`pm-all-in-one`** is used to plan itself — clone the product repo, Open Folder on `example-workspace/`, citable from README / Release notes.

## Decision (2026-08-12)

In-tree subdirectory beat a separate public example repo (fewer remotes, version-locked to product commits, app bundle unaffected). Product-root `AGENTS.md` states agents must not treat `example-workspace/` as product source.

## Scope (include)

- Project **`pm-all-in-one`**, **v0 campaign only** (epic `v0 — Open-source release` and its descendants)
- Wiki nodes selected **from `wiki/sidebar.ts`** (see rule below)
- Members / handoffs required for that product dogfood to open cleanly
- Workspace scaffold: `workspace.ts`, Home `README.md`, `AGENTS.md` → `.pm/agent.md`, `.agents/skills/…`, `.gitignore`, views as needed
- Example Home README: what this is, how to open it in the shipped app

## Wiki filter (SoT = source `wiki/sidebar.ts`)

1. **Include** the top-level Contents section labeled **`pm-all-in-one`** and every descendant `ref` id (recursive).
2. **Exclude** every other top-level Contents section and its descendants.
3. Copy only matching `wiki/<id>/` dirs; drop orphans not in Contents.
4. Write a **filtered** `wiki/sidebar.ts` with **only** that section.

## Scope (exclude)

- Entire **v1** epic tree (`v1 — Trusted 1.0.0 release…` / `fSADO94-kHCGNxYFFe_10` and all descendants, including post-v1 backlog)
- Other live-library projects (e.g. **eve-ask-lab**)
- Wiki outside the `pm-all-in-one` Contents subtree
- `.pm/local.json` / `.pm/local.md`, secrets
- Shipping inside the macOS app / asar (product `electron-builder` `files` already scoped to `app/` outputs)
- Replacing the thin self-dogfood story (@issue-blwwMj6xHRYLCWXfa9wwl::5WUPxDO4aDFioKSyGYUfU)

Source for refreshes: private maintained tree (@issue-blwwMj6xHRYLCWXfa9wwl::xGKn6_1_MdrSQBnOioXaE). Re-copy when cutting a public ship if the slice drifted.

## Layout

```text
pm-all-in-one/
  example-workspace/           # Open Folder here in the app
    workspace.ts
    README.md
    AGENTS.md
    .pm/…
    issue-hierarchy/blwwMj6xHRYLCWXfa9wwl/…
    wiki/                      # filtered sidebar + nodes
    members/…
    handoffs/…
  app/                         # product source — not a PM workspace root
```

## Done when

- `example-workspace/` exists in the product repo with **pm-all-in-one dogfood only**
- Wiki matches the **`pm-all-in-one` Contents subtree**; published `sidebar.ts` has no other root sections
- Example README explains how to open it; product README (or AGENTS) points at it
- Product-root `AGENTS.md` warns agents: example ≠ product source
- `doctor` against `example-workspace/` is clean enough to open (no structural refuse)
