---
aliases:
  - members
  - assignee
  - createdBy
  - 身份与归属
updated: 2026-08-04
description: >-
  第五种 node：members/<nanoid>/{props.ts,README.md,avatar.*}。issue 加 assignee；
  issue / project / wiki-node 加系统字段 createdBy。无 role、无登录门；本机「我是谁」
  进 .pm/local.json。事实进 git，策略不上本地版。
topic: members-and-assignee
---

# Handoff: Members, assignee, createdBy

## Outcome

- **拍板：第五种 node = member。** 磁盘 `members/<nanoid(21)>/{props.ts,README.md,avatar.<ext>}`，与 wiki-node 同构。无 `roster.ts` / 无 archive 子目录。
- **`membership: "involved" | "left"`** 是当前状态，不是区间历史。不可删 member，只能改 membership。
- **`assignee`** 只在 issue 上，可空，可改，指向 member id。
- **`createdBy`** 是系统字段：app 在 create 时写入，patch 拒绝，进保留字表；落在 issue / project / wiki-node。`workspace.ts` 不加。
- **无 role、无写入门禁。** 本地无认证；真安全边界仍是 git 凭据。
- **无登录门。** 「我是谁」可跳过，存 `.pm/local.json` 的 `me`（gitignored）。
- **「当前 member」必须可注入**，禁止 `electron/core` 模块级单例。
- **契约改动**（types + PmApi + 磁盘法）按根 `AGENTS.md` § Vibe coding 第 2 条，与功能 UI 分会话。

## 原理

一句话：**名册与归属是事实；权限是策略。本地版只记事实。**

| 层 | 进 git？ | 例子 |
| --- | --- | --- |
| 事实 | ✅ | 这个人在不在（membership）；这活儿归谁（assignee）；谁创建（createdBy） |
| 策略 | ❌ 本地版不做 | 谁能改什么；admin / viewer；登录门 |

以后上真 auth：IdP 成为权威，`members/` 降格为投影；`assignee` / `createdBy` 引用层**零迁移**。若现在写 role，上 auth 那天就是重写。

### 为什么 id 用 nanoid 而不是可读 slug

1. 复用既有 plumbing：`allocateEntityId` / `listIdChildDirs` / `isValidEntityId` / `NodeRef` / doctor。可读 slug 等于另开一套。
2. 显示名比代码库 `key` 更常改（改名、preferred name）。nanoid 让改名只动 `title`；slug 改名会孤儿化所有 `assignee` / `createdBy`。
3. 与 wiki-node / issue 同一引用模型：`@member-<id>`，路径靠 join。

代价：`props.ts` 里人名字段是不可读 token。接受；UI / doctor / chip 负责渲染。

### 为什么只有 `involved | left`

- **可选**（picker）与**可解析**（历史引用）必须是两个集合。删目录会制造悬空引用；`left` 让引用仍可解析，picker 只列 `involved`。
- `left` 的真正价值是 doctor：`todo` / `in-progress` 指派给已离开的人 → `assignee-left-member`。没有这条，字段是装饰。
- **非目标：** 参与区间历史（`joinedDate` / `leftDate` / 多段）。历史看该目录的 git log，不在文件里重建时间线。

### 为什么不做登录门 / 不做 createdBy 的「验证」

Electron 无法验证「我是 Alice」。下拉框选谁就是谁。UI 措辞是「你是谁（用于署名）」，不是 Login。任何基于它的写入门禁都是假边界，且会堵死服务器版 per-request session。

### 为什么 createdBy 是系统字段（而不是砍掉）

历史法条曾写「不加 createdBy」（git author 已记）。本次产品拍板：要系统字段，便于 assignee 同形的 UI / 名册链接。代价：与 git author 可能不一致（替人创建、agent 创建留空）；必须 patch 拒绝、保留字、agent 法条写清「不要手改」。

CLI / agent 裸建时 `createdBy` 可空（无 `.pm/local.json` 的 `me`）。Schema 允许 null。

## Context

### 磁盘形状

```text
<workspace-root>/
  members/
    <nanoid21>/
      props.ts        # title, membership, created, updated
      README.md
      avatar.jpeg     # 固定 stem avatar.<ext>，一人一张；可选
      assets/         # 可选，既有 node-assets
  issue-hierarchy/<projectId>/<issueId>/props.ts   # + assignee, createdBy
  issue-hierarchy/<projectId>/project.ts           # + createdBy
  wiki/<wikiNodeId>/props.ts                       # + createdBy
  .pm/local.json                                   # gitignored；{ "me": "<memberId>" }
```

- 扁平：离开的人**不**移进 `members/archive/`。
- 无索引文件：不建 `members/roster.ts`。
- 不进 `.pm/index.json` / `.pm/tree.md`（与 wiki 一样，另 snapshot）。

### Doctor

| kind | 含义 |
| --- | --- |
| `member-broken-ref` | assignee / createdBy 指向不存在的 member |
| `assignee-left-member` | 未完成 issue 指派给 `left` |
| `member-invalid-name` | `members/` 下非 nanoid 目录 |

Stray 扫描只走 `issue-hierarchy/`；`members/` 不会被误判为 adoptable，但也不会被覆盖 —— 必须单独挂 warnings（照 wiki）。

### 与旧 writer-handle 的关系

根 `AGENTS.md` Do not「不要复活 Writer setup / handle / 名册 / per-handle 计数器」骂的是**把 id 分配绑在身份上**的旧模型。本设计 id 已是 nanoid；member 只是引用目标。不是复活 handle。

### 「当前用户」注入形

```ts
// 正确：参数 / 上下文
createIssue(root, input, { actorMemberId: me ?? null })

// 错误：模块顶层
let currentMember: EntityId | null  // 堵死后门 session 映射
```

本地实现：从 `.pm/local.json` 读 `me`，作为参数传入。服务器将来 per-request 换同一形。

## Open questions

1. Avatar 在 renderer 的加载路径（Electron protocol vs data URL vs HTTP）—— UI 会话前用 explore 摸清；若需新 `PmApi` 方法，回到契约会话补，不在 UI 会话扩合同。
2. Member 详情页是否进 workspace 主导航，还是设置子页—— UI 会话定。
3. `createdBy` 在 UI 是否可显示为「由 @member-… 创建」chip；不可编辑。

## Next

1. 契约会话（Zone 2/3/4/5）：types + props-load + `members.ts` + ids + node-assets + custom-props 保留字 + store + local-config + default-workspace + doctor + CLI（含 `member backfill`，**不 bump `updated`**）+ 双桥镜像 + 测试。不带 UI。
2. Dogfood：`new-world` 建 Wenchuan Lili Zhao，回填 assignee / createdBy，doctor 干净。
3. UI 会话（Zone 6/8）：列表 / 详情 / assignee picker / 「你是谁」。
4. Dogfood wiki node「身份与归属」@wiki-7j0Ak3N2wsnQodOSxSzZ9 记当下真相；本 handoff 记论证，不互抄。
5. 稳定后再问用户是否把摘要折进 `space/important-notes/` —— **未经要求勿改该目录**。

## Do not

- 不要加 role / 权限字段，不要基于 member 做任何写入门禁。
- 不要把「当前 member」缓存成模块级或进程级单例。
- 不要建 `members/roster.ts` 或任何单文件名册索引。
- 不要用目录位置表达离开状态（不要 `members/archive/`）。
- 不要在回填 / 迁移时 bump `updated`。
- 不要 delete member；只改 `membership`。
- 不要把 email 设成必填或当身份主键。
- 不要只做 Electron 侧而不在 `server/` + `http-pm.ts` 镜像或 stub。
- 不要在契约会话里写 UI，也不要在 UI 会话里扩 `PmApi`。
- 不要编辑 `space/important-notes/`（除非用户明确要求）。
- 不要复活 writer handle / per-handle 计数器。
