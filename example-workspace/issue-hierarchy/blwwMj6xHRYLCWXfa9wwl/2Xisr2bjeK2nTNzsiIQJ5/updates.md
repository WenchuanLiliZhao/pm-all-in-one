## 2026-08-12

**Status:** done.

**Decision**
- Example lives at **`pm-all-in-one/example-workspace/`** (in-tree snapshot), not a separate public repo
- Copy/filter from live dogfood — not git submodule; app package does not include it
- Product-root `AGENTS.md` states: example ≠ product source

**Landed**
- Filtered snapshot: project `blwwMj6xHRYLCWXfa9wwl` **v0 only** (dropped full v1 epic tree, 39 nodes); wiki = `pm-all-in-one` Contents subtree (21 nodes); excluded `eve-ask-lab` and sibling Contents roots
- Example Home README with Open Folder / `doctor` instructions
- `pm-all-in-one doctor --workspace example-workspace` → OK (only existing `agent-md-outdated` warning)
- Product README + root `AGENTS.md` point at / bound the example

## 2026-08-12 (later)

**Tighten:** removed v1 issues from `example-workspace/` (epic `fSADO94-kHCGNxYFFe_10` + descendants); scrubbed matching keys from `.pm/view-orders.json`.
