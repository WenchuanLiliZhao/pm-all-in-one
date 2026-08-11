---
aliases:
  - electron vs server
  - local-pm Electron 与服务器分界
updated: 2026-07-29
description: >-
  Electron = 本地磁盘 + git remote 协作；服务器 = 同一工作区合同 + 真认证。
  1.0 无 writer handle；说明什么可复用、什么必须替换。
topic: electron-vs-server
---

# Electron vs 服务器版本

以后凡是问「服务器是不是另一套？」「现在的地基能不能直接托管？」——先读这篇。

存储合同见 [[../handoff/flat-issue-store|flat-issue-store]]。  
（旧 Writer setup / handle 笔记已退役：[[../handoff/collaboration-identity|collaboration-identity]]。）

## 一句话

**同一套产品数据与 API 合同；两套「如何托管」和「谁被授权改」。**

不是两个无关产品，也不是「Electron 开个网页就变成服务器」。

## 对照表

| 维度 | Electron（当前主路径） | 服务器（远期） |
| --- | --- | --- |
| 真相在哪 | 本机工作区目录里的文件 | 通常仍是同一形状的工作区树，但住在服务器可达的存储上 |
| 多人怎么同步 | **git push / pull**（GitHub 等只是 remote） | **HTTP API + 授权**；不一定每人 clone 一份 |
| 谁能改共享内容 | 有 remote 写权限的人（SSH / credential） | 通过登录与权限模型授权的人 |
| 「当前用户」 | **无 app 级 writer 身份**；git commit author 是历史痕迹 | **真认证**（session / OAuth 等）→ 按访问者授权 |
| 进门动作 | 打开本地工作区目录；create 由 app/CLI 分配 nanoid | **Login / OAuth**（可验证主体） |
| UI / core | `PmApi` + `electron/core/` | 同一 `PmApi` 形状 + 同一 core；换鉴权中间件与托管层 |
| 今日状态 | 可信日常路径（`npm run dev`） | `dev:web` 是未充分验证的骨架；**多访问者 / 真 auth 未做** |

## Electron：本地 + git 协作（怎么走）

适用：个人或小团队，每人 clone 同一 repo，用 Electron 打开本地目录。

1. Clone / pull 工作区。
2. 用 app 或 CLI **create** project / issue / wiki-node —— 本地画出 opaque `nanoid(21)`；不需要 Writer setup。
3. Commit + push；冲突按普通 git 目录合并处理（新 id 目录通常不撞车）。
4. 真安全边界是 **git 凭据 / remote 写权限**，不是 app 里的身份面板。

Identity / assignee（「该谁做」、名册）是 **post-1.0**，不进 id。

## 服务器：在现有地基上「叠」还是「换」

### 可直接复用（叠）

- 工作区文件合同：`issue-hierarchy/`、`props.ts`、opaque nanoid id、`@issue-…` / `@wiki-…` 引用
- `electron/core/` 读写逻辑与 `PmApi` 方法形状（create / list / patch 等）
- React UI（通过 HTTP bridge）

### 必须替换（不能假装叠一层）

**多访问者托管需要真认证与按请求的授权。**

对 Electron，「一台机器打开一个本地目录 + git」是正确模型。  
对多访问者服务器，必须：

1. 加真认证（session / OAuth 等）
2. 把「当前访问者」挂到 **每个请求**，而不是进程级 / 机器级 userData 伪身份
3. 不要在模块顶层缓存「当前用户」

### 不要混用的心智

| 错误说法 | 正确说法 |
| --- | --- |
| Electron 已有登录 | Electron **没有** app 登录；1.0 协作靠 git |
| 两边一样安全 | Electron 靠 git 权限；服务器靠 authz |
| 上服务器只要加 Login 页 | 还必须换托管与按访问者授权的实现 |
| `dev:web` 已是托管产品 | 骨架而已，未按多租户验证 |

## 给以后的决策清单

有人提议「统一成登录」时，先问：

1. 目标是 **流程长得像**，还是 **信任模型一样**？前者可改 UI；后者必须上服务器 auth。
2. 是否接受 Electron 继续 **靠 git 凭据、无 app 密码**？若否，你要的已不是当前产品形态。
3. 改动是否把「当前用户」写进模块单例 / 全局？若是，会堵死后门的 session 映射。

## 相关代码入口

| 主题 | 位置 |
| --- | --- |
| Id 分配 | `space/app/electron/core/ids.ts` / `dir-id.ts` |
| 布局拒绝 legacy | `space/app/electron/core/store.ts`（`assertSupportedLayout`） |
| HTTP 骨架 | `space/app/server/main.ts`、`src/lib/bridge/http-pm.ts` |

## Do not

- 不要复活 Writer setup / handle / 名册 / per-handle 计数器作为 1.0 身份方案。
- 不要假设服务器可以继续用 userData 当「当前用户」。
- 不要为了「心智统一」牺牲 CLI/agent 裸读能力，除非产品明确改口。
