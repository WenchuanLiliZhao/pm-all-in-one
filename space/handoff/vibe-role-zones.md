---
aliases:
  - vibe coding 角色分区
  - role zones architecture
updated: 2026-07-30
description: >-
  传统角色 → vibe 会话分区；心智文件树。硬规则已入口径化到仓库根 AGENTS.md § Vibe coding。
topic: vibe-role-zones
---

# Handoff: vibe coding 角色分区架构

## Outcome

- 约 **8 席**心智分区（非招人、非拆仓）；vibe coding 用「一次一区」。
- 轻整理已落：[[../app/DEVELOPMENT|DEVELOPMENT]] § Vibe zones + 双桥/镜像双向 `↔` + `workspace-context` 枢纽警示。
- **硬规则已写进仓库根 [[../../AGENTS|AGENTS.md]] § Vibe coding (agents)**（always-applied 入口）；本文件与 DEVELOPMENT 为地图/长文，勿再抄第三套 always-apply。

## Context

### 三层文档

| 层 | 路径 | 用途 |
| --- | --- | --- |
| 硬规则 | `AGENTS.md` § Vibe coding | AI 始终加载的 7 条纪律 |
| 区表 + 镜像清单 | `space/app/DEVELOPMENT.md` § Vibe zones | 开发入口地图 |
| 心智树 / 历史 | 本文件 | 冷启动长文 |

### 区摘要

| # | 角色 | 主要路径 |
| --- | --- | --- |
| 1 | 规格 | `AGENTS.md`、`important-notes/`、`handoff/` |
| 2 | 契约 | `src/lib/types.ts`、`bridge/pm-api.ts` |
| 3 | 核心 | `electron/core/*`（`@pm-core/*`） |
| 4 | 桌面 | `electron/main.ts`、`preload.cts`、pty |
| 5 | Web 桥 | `server/`、`http-pm.ts` |
| 6 | 设计系统 | `ui/`、`global-styles/`、`lab/` |
| 7 | Markdown | `markdown-editor/`、`lib/markdown/` |
| 8 | 业务/壳 | pages + feature components；壳枢纽 `workspace-context.tsx` |

完整树与会话规则见 DEVELOPMENT § Vibe zones；根 AGENTS 七条为强制纪律。

## Artifacts

| Path | Notes |
| --- | --- |
| `AGENTS.md` § Vibe coding (agents) | **硬规则 SoT（always-applied）** |
| `space/app/DEVELOPMENT.md` § Vibe zones | 分区表 + 镜像清单 |
| `space/handoff/vibe-role-zones.md` | 本交接 |
| `space/app/src/lib/bridge/pm-api.ts` | 前后端合同 |

## Next

1. ~~轻改造 DEVELOPMENT + ↔~~ — done。
2. ~~硬规则写入 AGENTS~~ — **done**。
3. 后续功能会话：开场锁定一区；契约另开。
4. （以后）可选：清 `electron/src/lib` orphan；slugify → `@pm-core`；cascade HTTP/Electron 对齐。

## Do not

- 不要为并行拆 package / monorepo。
- 不要把 8 区长表再抄进 `.cursor/rules`（与 AGENTS 双份会漂）。
- 不要在未改契约的 UI 会话里扩大 `PmApi`。
- 不要把分区讨论写进 `important-notes/`。
- 不要合并 `src/lib` ↔ `electron/core` mirrors，除非会话明确是 Zone 2/3 refactor。
