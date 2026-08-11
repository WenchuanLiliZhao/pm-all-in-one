---
aliases:
  - repo links
  - 代码库绑定
  - repo binding
updated: 2026-08-10
description: >-
  项目 ↔ 代码库绑定：提交侧只写「是哪个库」(key)，「在我这儿的哪儿」只进
  .pm/local.json（gitignored）。Interim：AI 可读路径可写 .pm/local.md。
  git remote 是可选提示，不是身份。代码要不要住进项目库交给用户偏好；已否决
  反向 .pm-link。契约改动，未实现。
topic: repo-links
---

# Handoff: 项目 ↔ 代码库绑定

## Outcome

- **拍板：身份 + 本地解析表。** 提交侧（`project.ts`）只写「**是哪个库**」；「**在我这台机器的哪儿**」只进 `.pm/local.json`，gitignored。
- **`key` 是身份**，人可读字符串，工作区内唯一。不引入不透明 id —— 理由见 § 为什么 `key` 不用 nanoid。
- **git remote 是提示，不是身份。** 解析链路完全用不到它；它只买自动认领、误绑提醒、同事发现三件事。
- **只放一边。** 否决代码库侧 `.pm-link` 反向指针。
- **代码住不住进项目库（含 submodule），是用户偏好，不是产品立场。** 提供途径，不鼓励也不禁止：不做默认、不进模板，也不立法禁止。唯一的硬提醒是别放进 `issue-hierarchy/` —— 见 § 代码放在项目库里。
- **未实现。** 契约改动（`types` + `PmApi` + 磁盘法），按根 `AGENTS.md` § Vibe coding 第 2 条，必须与功能 UI 分会话。
- **Interim（软约定，已落地）：** 在 `project.repos` / Open folder 解析落地前，本机可用自然语言把代码目录记在 **`.pm/local.md`**（gitignore；有内容再创建，不 seed 空文件）。供 AI / 人手阅读。**不**进 app 解析链路，**不**替代最终 SoT（提交侧 `key` + `.pm/local.json` `repos`）。**禁止**把绝对路径写进 `members/` 或任何会进 git 的文件。模板 `.gitignore` + `agent.md` rev 已写明；无 UI。

## 原理

一句话：**提交「是哪个库」，本地记「在哪儿」。**

就像书里的脚注写「见《设计模式》第 3 章」，而不是写「见我书架第二层左起第四本」。引用指向书的**身份**，谁读都一样，所以能印进书里；书在**谁家的哪个架子上**是各人自己的事，各人自己记。

对应到磁盘上就是两层，界线就是 git：

| 层 | 位置 | 内容 | 进 git？ |
| --- | --- | --- | --- |
| 身份 | `project.ts` 的 `repos` | 「这个项目关联一个叫 `pm-all-in-one` 的库」 | ✅ 对所有人一样 |
| 位置 | `.pm/local.json` | 「`pm-all-in-one` 在我这儿是 `/Users/…`」 | ❌ 人人不同 |

**解析全程是本地到本地**：拿 `key` 查本地表得到路径，结束。git 一次都没被用到。查不到就弹目录选择器，选完写回本地表 —— 这是每个人各自付一次的一次性成本，而且是自愈的。

`remote` 站在这条链路**之外**，只做三件锦上添花的事：

| 用途 | 没有它会怎样 |
| --- | --- |
| 自动认领（扫代码根比对 origin） | 手动选一次目录 |
| 误绑提醒（选错文件夹时警告） | 选错了自己发现 |
| 同事发现（新人知道该 clone 哪个库） | 开口问一声 |

三件都可以退化为人工，所以它可空、可后补、可永远不填。**「本地库某天加了 remote」因此是个非事件** —— 不触发迁移，不产生孤儿条目，不需要补登记机制。这一条删掉了本设计里最大的一块复杂度。

## Context

### 问题

同事各自机器上代码库的本地路径不同。任何写进 git 的绝对路径都只对一个人有效。

### 代码放在项目库里（含 submodule）

有人就是喜欢「打开一个目录就是全部」—— 项目管理数据和代码并排。这是**真实存在的管理偏好**，产品不该替他否掉。

能这么放任，是因为**本设计对代码住在哪儿完全无所谓**：`key` 是身份，`.pm/local.json` 记路径，那个路径指向工作区**外面**还是**里面**，解析链路一个字都不用改。嵌套不是第二套机制，只是本地表里的一个值。

代价由选这条路的人自己承担，不由默认承担：

| 代价 | 说明 |
| --- | --- |
| 所有权倒置 | 代码若已有自己的家（如 `pm-all-in-one` 住在 vault `all-in-one` 里），再当某项目库的 submodule 就有了第二个家 |
| 一对多失效 | 同一代码库被多个项目库引用时只能重复 checkout |
| 权限 | 同事无该私有 repo 权限时，`clone` 整个失败，连项目管理数据都读不到 |
| 指针噪音 | 代码库每次提交都在项目库产生 submodule pointer diff 或常驻 dirty |

这四条在**代码本来就是该项目库附属产物**的场景（项目专用脚本 sidecar、一人一机的个人库）基本不成立 —— 那正是这个偏好合理的地方。

产品只守两条：

1. **不做默认。** 不进 `DEFAULT_WORKSPACE_*` 模板，不替人建目录、不约定目录名；机制仍然只有 `key` + 本地表（OQ 9：也不按约定位置自动探测）。
2. **别让 app 咬它。** 唯一真会出事的位置是 `issue-hierarchy/<projectId>/` 内部 —— 那里的非 id 目录会被 `scanStrays()`（`electron/core/doctor.ts`）报成 **adoptable stray**，一点「Adopt」就把代码库目录**改名成 nanoid** 并写进 `props.ts` / `README.md`。已定：加护栏，见 § Doctor › 护栏。工作区根下（目录名随用户喜好）完全在 doctor 视野之外，天然安全。

所以对用户只需说一句：**放哪儿都行，别放进 `issue-hierarchy/`。**

### 为什么只放一边（不做代码库侧指针）

代码库侧的 `.pm-link` 解决的是**反方向**：agent 在 repo 里跑，想知道自己属于哪个项目。它解决不了「从项目找到代码库」，因为得先扫盘才能找到那个指针。

而且反向指针有**对称的路径问题**：它要指向一个 workspace，而 workspace 在每台机器上路径同样不同 → 只能存 id → 又需要一张「workspaceId → 本地路径」的表。同一个问题换方向再来一遍。更麻烦的是 `workspace.ts` **现在没有 id**（法条禁止写 `id` 字段），做 `.pm-link` 得先发明 workspace 身份。

反方向大概率**不需要新增提交状态**就能得到：本地表已有「key → 绝对路径」，app 也有已知工作区列表 → 拿 cwd 去匹配各工作区本地表的路径前缀即可。

`.pm-link` 唯一独有的价值是**发现**（同事 clone 了代码库但从没打开过 PM 库）。这个价值代码库自己 README 一行字就能给。**结论：不做。**

## Design

### 提交侧：`project.ts` 新增系统字段 `repos`

```ts
export const props = {
  title: "pm all in one",
  repos: [
    {
      key: "pm-all-in-one",
      // 以下皆为可选提示
      remote: "github.com/<owner>/vault-13",
      subpath: "space/workspace/domains/ai-solution-research/crafting-table/pm-all-in-one",
    },
  ],
} as const;
```

| 字段 | 地位 | 作用 |
| --- | --- | --- |
| `key` | **身份**，必填 | 工作区内唯一；`.pm/local.json` 的主键，UI 的显示名 |
| `remote` | 提示，可空 | 归一化 origin；自动认领 + 误绑提醒 + 同事发现 |
| `subpath` | 提示，可空 | repo root 起算的相对路径。`pm-all-in-one` 不是独立 repo 而是 vault 里一个目录，自动认领时必须靠它下钻 |

`repos` 是**系统字段**，与 `status` / `priority` 同级保留：它有 UI 行为（终端 cwd、Open folder）和 doctor 校验，不能走 `custom-props.ts`。不影响 `created` / `updated` 的不可编辑性。

### 为什么 `key` 不用 nanoid

系统里 issue / wiki-node 用不透明 id，是因为那里**引用断裂是静默且永久的** —— `@issue-…` 指向一个被改名的目录，你不会收到任何提示。

repo link 的断裂性质完全不同：改了 `key`，别人本地表的条目变成孤儿 → 下次点开时 UI 显示灰态「定位…」→ 选一次目录就修好了。**响亮、局部、一键自愈。** 为这种量级的失败引入 id 分配器，同时把 `.pm/local.json` 变成一堆没法读的 token，不划算。

所以：`key` 可改名，代价是**其他机器各自重选一次**；改名时 app 顺手迁移本机条目。这一点写进 UI 提示即可，不必立法禁止。

### remote 归一化

仅在用 remote 做自动认领 / 比对时需要，否则 ssh 与 https 写法会被当成两个库：

1. 去 scheme（`git@` / `https://` / `ssh://`）
2. `:` → `/`（`git@github.com:o/r` → `github.com/o/r`）
3. 去尾部 `.git` 和尾部 `/`
4. host 小写；path 保留大小写

### 本地侧：`.pm/local.json`（gitignored）

```json
{
  "repos": {
    "pm-all-in-one": "/Users/wenchuanzhao/Documents/GitHub/vault-13/space/…/pm-all-in-one"
  }
}
```

必须加进 `DEFAULT_WORKSPACE_GITIGNORE`（`electron/core/default-workspace.ts`，现有内容是 `.pm/index.json` / `.pm/tree.md` / `.DS_Store`）。既有工作区需要迁移式补写 —— 见 Open questions。

### 解析与体验

这张表**不需要手填**：

1. 点「在这里开终端」/「Open folder」时按 `key` 查 `.pm/local.json`。
2. 未命中 → 弹目录选择器，选完写回本地表。若 `remote` 非空，校验所选目录的 origin 是否匹配；不匹配给警告但**允许继续**（fork / mirror / 本地未发布都是合法场景）。
3. 可选加速：配置若干搜索根（如 `~/Documents/GitHub`、`~/code`），后台 `git remote get-url origin` 匹配后自动认领。`remote` 为空的 link 跳过这步，直接等人选。
4. 未解析时 UI 显示灰态「定位…」，**不报错、不阻塞**其余功能。

解析成功后接现有 `PtyManager.setCwd()`（`electron/core/pty.ts`）打开终端。

### Doctor

新增 warning kind（`DoctorWarningKind`，`src/lib/types.ts`）：

| kind | 触发 |
| --- | --- |
| `repo-link-unresolved` | `project.ts` 声明了 `key`，本地表没有 |
| `repo-link-path-missing` | 本地表有路径，但目录不存在 |

两条都是 warning，不是 stray：项目库本身没坏，缺的只是本机的一次定位。

#### 护栏：代码被放进 `issue-hierarchy/`

第三条 kind，对应 § 代码放在项目库里 里那个唯一会出事的位置：

| kind | 触发 |
| --- | --- |
| `repo-inside-hierarchy` | stray 目录自身有 `.git`（**存在即可**，submodule / worktree 下它是文件不是目录） |

护栏的实质不是这条 warning，而是 `scanStrays()`（`electron/core/doctor.ts`）把这类 stray 标成 **`adoptable: false`**：adopt 会把目录**改名成 nanoid** 并写进 `props.ts` / `README.md`，对一个代码库是破坏性的，必须先堵住入口。`adoptStray()` 现有的 `!entry.adoptable` 分支会自动接住手动调用（含 CLI）。

文案不说「不许放」，只说明**这个位置**会被当成 issue 目录，建议挪到工作区根下（目录名随用户喜好）。

**没有 remote 相关的 doctor 条目。** remote 为空是合法状态，remote 与本地 origin 不符也是合法状态（fork / mirror）；提示只在**绑定的那一刻**给，不做常驻体检。

### 类型 / API 影响面

| 位置 | 改动 |
| --- | --- |
| `src/lib/types.ts` | `Project` 加 `repos: RepoLink[]`；`ProjectPatch` 加 `repos?`；新增 `RepoLink`；`DoctorWarningKind` 加三项 |
| `electron/core/doctor.ts` | `DoctorWarningKind` 加三项；`scanStrays()` 对含 `.git` 的 stray 置 `adoptable: false` |
| `electron/core/detail-diff.ts` | `ProjectEditableSlice` 是否纳入 `repos`（OCC 冲突检测） |
| `src/lib/bridge/pm-api.ts` | 新增 `resolveRepoLink(projectId, key)` / `setRepoLocalPath(projectId, key, path)` / `pickRepoFolder()` |
| `electron/core/` + `preload.cts` | 实现；`pickRepoFolder` 走 `dialog.showOpenDialog` |
| `server/` + `src/lib/bridge/http-pm.ts` | **必须镜像或 stub**。web 无本地目录选择器 → `pickRepoFolder` 在 web 上 reject；UI 按 `platform === "web"` gate（与 Terminals / Open folder 同一处理） |

## Artifacts

| Path | Notes |
| --- | --- |
| `space/handoff/repo-links.md` | 本篇 |
| `space/app/electron/core/default-workspace.ts` | 待加 `.pm/local.json` 到 gitignore 模板 |
| `space/app/electron/core/pty.ts` | 已有 `setCwd()`，解析结果的下游 |
| `space/app/src/lib/types.ts` | `Project` / `ProjectPatch` / `DoctorWarningKind` |
| `space/app/electron/core/doctor.ts` | `scanStrays()` / `adoptStray()` —— 待加含 `.git` 的 adopt 护栏 |

## Open questions

1. ~~解析表属于工作区还是机器？~~ **已定**：`.pm/local.json`（per-workspace，主键 `key`）是 SoT。机器级缓存（跨工作区共享定位结果）仍待定，纯属省一次目录选择；若要做，只能按 `key` 或按已解析路径建索引，**不能按 `remote`** —— remote 可空且可后补。
2. ~~remote 是不是身份？~~ **已定**：不是，是提示。见 § 原理。
3. ~~`key` 用不用 nanoid？~~ **已定**：不用。见 § 为什么 `key` 不用 nanoid。
4. `repos` 只挂 project，还是 workspace 也要一个默认库？倾向只挂 project。
5. 一个 project 挂多个 repo 时，终端 / Open folder 的默认目标怎么定（第一个？显式 `primary`？）
6. 既有工作区（如 dogfood `new-world`）的 gitignore 迁移：启动时静默补写，还是 doctor 报一条让人手动加？
7. `.pm/agent.md` 要不要写入这条法（手工编辑 `repos` 的边界）—— 该文件是模板生成的，改它等于改产品。
8. ~~submodule 要不要禁？~~ **已定**：不禁也不推，是用户偏好。见 § 代码放在项目库里。
9. ~~嵌在工作区内时要不要自动探约定位置？~~ **已定**：不探。一律弹目录选择器，只付一次点击，换机制单一 —— 不引入 `<workspace>/repos/<key>` 这类约定路径。
10. ~~「别放进 `issue-hierarchy/`」落在哪？~~ **已定**：doctor 加护栏，不只写文档。见 § Doctor › 护栏。

## Next

1. 拍板 Open questions 4–6。
2. 契约会话（Zone 2/3）：`types` + `PmApi` + `electron/core` + `server` 镜像，一次做完，不带 UI。doctor 护栏（`repo-inside-hierarchy` + `adoptable: false`）可并入本会话 —— 它只动 `doctor.ts` 与 `DoctorWarningKind`，不需要 UI。
3. 功能会话：project settings 里的 repos 编辑 + 灰态「定位…」+ 终端 cwd 接线。
4. 反向指针 `.pm-link` **已否决**。若将来真要 repo → project，先试「cwd 前缀匹配已知工作区本地表」的推导法，不要新增提交状态。

## Do not

- 不要把绝对路径写进 `project.ts` / `workspace.ts` / 任何被提交的文件。
- 不要把 `remote` 当身份用（不要拿它做本地表主键、不要要求它非空、不要为它做补登记机制）。
- 不要把 `repos` 做成 custom prop。
- 不要把「代码住进项目库」做成默认或模板；也不要反过来立法禁止它。
- 不要引入 `<workspace>/repos/<key>` 之类的约定路径去自动探测（OQ 9 已定：不探）。
- 不要让含 `.git` 的 stray 保持 `adoptable: true` —— adopt 会把代码库目录改名成 nanoid。
- 不要在未加 gitignore 前就写 `.pm/local.json`。
- 不要只做 Electron 侧而不在 `server/` + `http-pm.ts` 镜像或 stub（根 `AGENTS.md` § Electron vs web）。
- 不要顺手实现 `.pm-link`；也不要因为这条绑定就去改 `space/important-notes/`。
