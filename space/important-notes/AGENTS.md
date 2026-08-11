---
aliases:
  - important-notes
  - local-pm 重要说明
updated: 2026-07-29
description: >-
  Durable product notes that answer recurring “how do we think about X?”
  questions (Electron vs server, collaboration model, etc.).
---

# Important notes (`local-pm`)

Long-lived orientation notes — not session handoffs. Prefer updating these when
a decision stabilizes; keep [[../handoff/AGENTS|handoff/]] for in-flight design.

**Do not edit this directory unless the user explicitly asks.** Agents must not
rewrite, “fix links,” or quietly fold handoff decisions into these notes on
their own. Handoff cleanup / in-flight design stays in `handoff/`; touch
`important-notes/` only when the user requests it.

| Note | Role |
| --- | --- |
| [[nodes\|nodes]] | 文档/计划 **node** 的共享磁盘 pattern + workspace / project / issue / wiki-node 个别差异 |
| [[electron-vs-server\|electron-vs-server]] | Electron（本地 + git）vs 服务器托管：同一合同；1.0 无 writer；服务器后期才真 auth |
