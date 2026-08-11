# `electron/core/domain/`

<!-- ↔ AGENTS.md — write / OCC law -->
<!-- ↔ ../README.md — category map -->
<!-- ↔ ../sync/detail-diff.ts — OCC slices -->

Entity CRUD against the workspace tree: projects/issues, wiki, members, handoffs, custom props, workspace meta, optional node assets.

**Who may import:** Electron main, server, CLI. Not the renderer (use `PmApi`).

| File | Role |
| --- | --- |
| `store.ts` | Project / issue CRUD, ladder moves |
| `wiki.ts` | Wiki nodes + `sidebar.ts` SoT |
| `members.ts` | Members + avatars |
| `handoffs.ts` | Handoffs CRUD |
| `custom-props.ts` | Per-project `custom-props.ts` |
| `workspace-meta.ts` | Root `workspace.ts` + README |
| `node-assets.ts` | Per-node `assets/` (wired from Electron today) |
