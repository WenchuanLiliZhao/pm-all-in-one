---
aliases:
  - workspace handoff
  - 项目库 handoff
  - project library handoff
updated: 2026-08-07
description: >-
  用户工作区 sent handoffs：workspace 级 handoffs/<id>/；Handoffs
  卡片浏览。per-project sticky 另议。
topic: workspace-handoff
---

# Handoff: 项目库也需要 handoff？

## Outcome

**已拍板（sent handoff log）：**

- 落点：工作区级 `handoffs/<nanoid>/{props.ts,README.md}`（第六种 workspace-level node 族；**不是** wiki Contents，**不是** issue）
- 粒度：一篇 = **一次发送**；正文可用 `@issue-…` 覆盖多条 issue
- 人：`from` / `to` = member id；时间排序键 = `created`（发送时刻）
- 必选 props：`relatedProject`（project id）、`open`（boolean：`true` = open / `false` = closed）；另有 `title`、`description`（可空串）
- UI：顶栏 Handoffs → `/w/handoffs` 卡片列表（新→旧）+ Detail；创建默认 `from` = `.pm/local.json` `me`
- Locator：`@handoff-<id>`
- 与产品仓 `space/handoff/` **分开**（读者 / 生命周期不同）

**显式延后：** per-project sticky `HANDOFF.md`（进行中便利贴）— 另一需求，不与本 log 混为一谈。

## Context

### 两套 handoff

| | 产品 `pm-all-in-one/space/handoff/` | 项目库 handoff（本题） |
| --- | --- | --- |
| 读者 | 做 app 的人 / agent | 在**这个工作区**里干活的人 / agent |
| 内容 | 产品设计 in-flight | 战役进度、卡点、下次从哪接 |
| 生命周期 | 随产品讨论 | 随项目推进，易过期 |

### 工作区已有分层（缺「进行中 / 发出的交接」）

- Workspace README（Home）— 库是干什么的（慢变）
- Project description — 长期责任域（慢变）
- Epic 正文 — 这场战役（可冻结）
- Wiki — 现行真相（有维护义务）
- **Sent handoffs** — 发出去的会话包（本 outcome）
- **Sticky（延后）** — 每 project 进行中便利贴

### 风险

- 与 Home / project description 职责糊 → handoff 只写本轮交接，不当 durable 正文
- 变成第二个 wiki → 非 Contents、可空、body 短命
- 多人 git 冲突 → 可接受或约定短、勤清

## Artifacts

| Path | Notes |
| --- | --- |
| dogfood `@issue-blwwMj6xHRYLCWXfa9wwl::MGIaZIzemhSlYIa0nnKEM` | Handoffs view |
| `space/handoff/workspace-handoff.md` | 本篇 |

## Next

1. ~~拍板落点 / 人 / 时间~~ — done（见 Outcome）
2. 实现：disk + PmApi + CLI → Handoffs UI（分 vibe session）
3. 勿折进 `important-notes/` 除非用户要求

## Do not

- 不要把产品仓库 handoff 治理复制进用户工作区当第二套 wiki。
- 不要用项目库 handoff 写字段契约，或用 prop 说明写「明天改 login」。
- 不要改 `space/important-notes/`，除非用户明确要求。
