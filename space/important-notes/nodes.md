---
aliases:
  - nodes
  - node pattern
  - 节点定义
updated: 2026-07-29
description: >-
  工作区里每一种文档/计划节点的共享磁盘形态，以及 workspace / project /
  issue / wiki-node 各自的差异。给开发 pm-all-in-one 的人看。
topic: nodes
---

# Nodes（文档 / 计划节点）

凡是「一段可编辑正文 + 一份结构化元数据、落在磁盘上可被 `@` 引用」的东西，在本产品里都叫 **node**。  
UI 可能叫 page / issue / project；磁盘与类型层统一按下面的 pattern 想。

机制细节分别在 [[../handoff/flat-issue-store|flat-issue-store]]、[[../handoff/wiki-system|wiki-system]]；内容归属在 [[../handoff/project-vs-wiki|project-vs-wiki]]。本篇只钉 **什么是 node、长什么样、各型差在哪**。

## 共享 pattern（先看这棵树）

所有 node 都是「**一个目录（或工作区根）= 一个节点**」，目录里至少有 **meta 文件** + **`README.md` 正文**：

```text
<node>                                      # 身份落点（见下）
├── <meta>.ts                               # 结构化 props（export const props = …）
├── README.md                               # 正文（Markdown；不重复 title 做 # 标题）
└── …                                       # 可选：该型专属旁路文件
```

落到工作区上的全景：

```text
<workspace-root>/                           # ← workspace node（特例：根即节点）
├── workspace.ts                            # meta：title, createdDate
├── README.md                               # Home 正文
├── wiki/
│   ├── sidebar.ts                          # 不是 node —— Contents 导航 SoT
│   └── <wikiNodeId>/                       # ← wiki-node
│       ├── props.ts
│       └── README.md
└── issue-hierarchy/
    └── <projectId>/                        # ← project node
        ├── project.ts                      # meta（命名例外：不是 props.ts）
        ├── README.md                       # project description
        ├── custom-props.ts                 # 不是 node —— 本 project 的自定义字段声明
        ├── schema.d.ts                     # 不是 node —— 由 custom-props 生成
        └── <issueId>/                      # ← issue node（epic | task | subtask）
            ├── props.ts
            ├── README.md
            └── <markdown-custom-prop>.md   # 可选；不是独立 node
```

### 共享规则

| 规则 | 说明 |
| --- | --- |
| **Id = 目录名** | Project / issue / wiki-node 的 id 是 opaque `nanoid(21)`；目录名即 id，**永不改名**。Workspace 没有独立 id 目录——根目录本身就是节点。 |
| **Meta + body** | Meta 在 `*.ts` 的 `export const props`；正文永远是同级 `README.md`。 |
| **系统时间戳** | Project / issue / wiki-node：`created` / `updated`（ISO-8601 UTC `…Z`）。`created` 只写一次；`updated` 仅由 app 在真实 props/body 写入时 bump。Patch **不带**这两键。Workspace 用 `createdDate`（`YYYY-MM-DD`），同样不可改。 |
| **Title 在 meta，不在 README 首行** | `README.md` 不要用 `#` 重复 title。 |
| **引用靠路径拼接** | 不需要跑着的 app / 索引：`@issue-<projectId>::<issueId>`、`@wiki-<wikiNodeId>` 直接拼目录。 |
| **Create 本地抽 id** | 无 writer handle、无共享计数器；并发靠 nanoid 熵。 |

**不是 node：** `wiki/sidebar.ts`（Contents）、`.pm/*`（派生 / 视图）、`custom-props.ts` / `schema.d.ts`、issue 上的 markdown 自定义字段文件、sidebar 里的 `group` / `link` 条目。它们是导航、配置或字段，不是「一篇文档 / 计划」。

---

## 各型个别情况

### 1. Workspace

| | |
| --- | --- |
| **中文注释** | 工作区根 / Home |
| **落点** | `<workspace-root>/`（不是某个 nanoid 子目录） |
| **Meta 文件** | `workspace.ts` → `{ title, createdDate }` |
| **Body** | 根 `README.md`（UI：Home） |
| **层级** | 最外层容器；其下挂 `wiki/` 与 `issue-hierarchy/` |
| **引用** | 无 `@workspace-…`；打开工作区即此节点 |

**个别点：**

- 没有 opaque id；身份 = 磁盘上的这个根目录。
- `createdDate` 在创建 时写死，UI / `WorkspacePatch` / 手改都不可动。
- 可 patch：`title`、`description`（即 README）。

### 2. Project

| | |
| --- | --- |
| **中文注释** | 项目容器 / 长期责任域（portfolio / area）——**不是**有截止日期的「战役」 |
| **落点** | `issue-hierarchy/<projectId>/` |
| **Meta 文件** | `project.ts`（命名例外；内容仍是 `export const props`） |
| **Body** | `README.md` = **project description**（慢变；不写战役日期 / 完成判据） |
| **层级** | 挂在 workspace 下；其下扁平挂 issue 目录 |
| **引用** | 无独立 `@project-…`；issue 引用里带 `projectId` |

**个别点：**

- Schema 上**没有** `status` / 起止日期 / 归档——生命周期事件不存在于 Project。
- Meta 常见字段：`title`、`created`、`updated`（description 在 README，不在 `project.ts`）。
- 旁路：`custom-props.ts` + 生成的 `schema.d.ts` 声明本 project 下各级 issue 的自定义字段。
- 与 epic / wiki 的内容分界见 [[../handoff/project-vs-wiki|project-vs-wiki]]。

### 3. Issue（epic / task / subtask）

| | |
| --- | --- |
| **中文注释** | 议题；三级固定阶梯（战役 → 乐章 → 乐句） |
| **落点** | `issue-hierarchy/<projectId>/<issueId>/`（**扁平**——父子不靠嵌套目录） |
| **Meta 文件** | `props.ts` |
| **Body** | `README.md` |
| **层级** | `level` + `parentId` 声明树；与目录深度无关 |
| **引用** | `@issue-<projectId>::<issueId>` |

**个别点：**

- `level`：`"epic"` \| `"task"` \| `"subtask"`——固定，不可配置。
- `parentId`：父 issue 的 id，或 `null`（顶层 epic）。**树的权威是 `parentId`；解读数据的权威是 `level`。** 二者矛盾时两边都保留并报 violation，不静默修复（[[../handoff/flat-issue-store|flat-issue-store]]）。
- 系统字段另有：`status`（`draft` \| `todo` \| `in-progress` \| `done` \| `cancel`；创建 默认 `draft`）、`priority`（`very-low` \| `low` \| `medium` \| `high` \| `very-high`；创建 默认 `medium`）、`startDate` / `endDate`、`estimatePoint`。
- **Epic** 正文 = 这场战役（why now / scope / done criteria / 日期）；转 `done` / `cancel` 后冻结成历史。Task / subtask 是战役内分解，不是独立的内容归属层。
- 可选旁路：每个 markdown 型自定义 prop 一个同名 `.md` 文件——仍属该 issue，不是新 node。

### 4. Wiki-node

| | |
| --- | --- |
| **中文注释** | 维基节点（UI 常叫 **page**） |
| **落点** | `wiki/<wikiNodeId>/` |
| **Meta 文件** | `props.ts` → `{ title, created, updated }` |
| **Body** | `README.md` = **现行真相**（有维护义务；过期是缺陷） |
| **层级** | **不在** node 的 `props.ts` 上存 `parentId`；Contents 嵌套只在 `wiki/sidebar.ts` |
| **引用** | `@wiki-<wikiNodeId>` → `wiki/<id>/README.md` |

**个别点：**

- 磁盘库存（All pages）与 Contents（`sidebar.ts` 里的 `ref`）是同一全集的两种视角：每篇 wiki-node **必须**在 Contents 中；`unlisted` 非法（doctor `wiki-unlisted`）。`getWiki` 会把遗留 orphan 挂到 Contents 根。
- `createWikiNode` **总是**写入 Contents（`parentId` 可选，默认根）。
- 按主题组织；不要为每个 project / 进行中的 epic 建概况镜像页。
- Sidebar 里的 `group` / `link` 是导航条目，**不是** wiki-node。

---

## 对照速查

| Node | 目录 / 落点 | Meta 文件 | Body | 树怎么表达 | `@` 引用 |
| --- | --- | --- | --- | --- | --- |
| **workspace** | 工作区根 | `workspace.ts` | `README.md` | — | — |
| **project** | `issue-hierarchy/<id>/` | `project.ts` | `README.md` | 容器；无 issue 式 parent | （嵌在 issue ref 里） |
| **issue** | `…/<projectId>/<issueId>/` | `props.ts` | `README.md` | `parentId` + `level` | `@issue-p::i` |
| **wiki-node** | `wiki/<id>/` | `props.ts` | `README.md` | 仅 `sidebar.ts` | `@wiki-id` |

## Do not

- 不要把 sidebar `group` / `link`、自定义 markdown 字段文件、`.pm/*` 当成 node。
- 不要给 wiki-node 的 `props.ts` 加 `parentId`（嵌套归 Contents）。
- 不要把 issue 存成嵌套目录来表达父子（扁平 + `parentId`）。
- 不要手改 / 在 patch 里带 `created` / `updated` / workspace `createdDate`。
- 不要重命名 nanoid 目录。
- 不要在本篇重复展开内容归属哲学或 IPC 细节——链到对应 handoff。
