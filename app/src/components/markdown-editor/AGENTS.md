---
aliases:
  - markdown-editor
updated: 2026-08-06
description: >-
  App-local Markdown live/source/preview module—CodeMirror 6 +
  react-markdown Reading View; GFM tables/lists/codeblocks; per-element
  encapsulation; pluggable transforms; no product ids in core.
---

# `src/components/markdown-editor/`

<!-- ↔ index.ts — public API surface this doc describes -->
<!-- ↔ elements/index.ts — per-element registry (preview + live) -->
<!-- ↔ src/lib/markdown/ — product MarkdownPlugin adapters (issue/wiki) -->
<!-- ↔ src/lab/pages/markdown-editor.tsx — DEV review harness -->

App-local Markdown edit / preview module. SoT remains raw Markdown. Product adapters (`@issue-…` / `@wiki-…`) live in `src/lib/markdown/`, not here.

**What it is:** CodeMirror 6 editor chrome (live / source / preview) + react-markdown Reading View, with a pluggable transform/components surface. Core stays product-agnostic — no project/issue ids, no host-specific completions. View-mode preference for borderless hosts may use browser `localStorage` (see below); that is editor UI state, not product storage.

**What it is not:** issue-link semantics, wiki resolution, IPC, or any product adapter.

## Module boundary (required)

**Every new feature must be judged before implementation.** Ask, in order:

1. **Belong in this module?** — Generic Markdown editing / preview behavior (modes, CM engine, auto-pair, live decorations, Reading View shell, plugin *types* / hooks). Put it here.
2. **A plugin for this module?** — Domain or product behavior that plugs into `MarkdownPlugin` / mention autocomplete without baking product ids into core (e.g. `@issue-…` preview chips, wiki links). Implement as a plugin under `src/lib/markdown/` (or lab mock), not in this module.
3. **Neither?** — App chrome, storage, IPC, project/issue CRUD. Keep it elsewhere.

Do not default new work into this module. If it fails (1) and (2), it stays out.

**Import rule:** this module must not import `@/lib/bridge`, `@pm-core/*`, workspace stores, or other host product modules. Consumers import `@/components/markdown-editor` directly (not via `@/components` barrel) when they also export from that barrel — avoid cycles.

**`localStorage` exception:** borderless Live/Source preference may read/write `localStorage` key `pm.markdown-editor.borderless-mode` (`"live"` | `"source"`) from `markdown-editor.tsx` only. That is editor-own view state (escape hatch), not product/workspace state — do **not** move it to `.pm/local.json` / `PmApi` without a dedicated Zone 2/3 session. Reads/writes must be `try/catch`; illegal or missing values fall back to `"live"`.

## Layout

| Path | Role |
| --- | --- |
| `index.ts` | Public exports (`MarkdownEditor`, `MarkdownPreview`, types, `linkChipStyles`) |
| `types.ts` | `MarkdownPlugin` + editor/preview/mention prop contracts |
| `merge-plugins.ts` | Reading View: transform / components / URL-scheme merge |
| `markdown-editor.tsx` | Mode chrome (live / source / preview) |
| `markdown-cm-view.tsx` | CodeMirror host (GFM via `markdownLanguage`) |
| `markdown-preview.tsx` | Reading View (`react-markdown` + `remark-gfm`) |
| `extensions/` | CM engine plugins (live-preview orchestrator, auto-pair) |
| `autocomplete/` | Generic `@` mention shell |
| `elements/<name>/` | **Per Markdown element** — preview components/styles + live decorations |
| `styles.module.scss` | Shell chrome + base Reading View typography (non-element tags) + `linkChip*` for plugins |

### Element encapsulation

One folder per Markdown construct under `elements/`. **Do not** split the tree into top-level `live/` vs `preview/` — the element is the ownership unit.

**Every element ships:**

| File | Role |
| --- | --- |
| `preview.module.scss` + `preview.tsx` | Reading View `components` map + CSS module classes |
| Live entry | `live.ts` (same-pane decorations/theme) **or** `chrome.ts` (idle HTML host; active = no decoration) — pick one pattern (see below) |
| `index.ts` | Re-exports + `create*LiveExtensions` |

**When `live.ts` vs `chrome.ts`:**

| Pattern | Use when | Examples |
| --- | --- | --- |
| `live.ts` (ViewPlugin) | Markers hide / line chrome / inline widgets; parent doc stays editable | codeblock, list, link, blockquote, hr, image |
| `chrome.ts` (StateField `block: true`) | Whole construct replaced by a read-only idle projection; **active = no decoration** (parent CM shows source) | **table** only today |

Do **not** use `chrome.ts` for lists — nesting (list⊃table / list⊃fence) fights a block host.

**Do not add new `chrome.ts`-pattern elements.** New elements must use `live.ts`.

**Table-only** (`elements/table/` — idle HTML projection; selection enters → parent CM pipe text):

| File | Role |
| --- | --- |
| `chrome.ts` | Idle HTML projection block host; selection into table range clears the decoration |
| `pipe.ts` / `model.ts` | Pure pipe helpers + CM-bound parse (`parseTable` / cell lookup for click→caret) |
| `inline-html.ts` | Idle widget inline Markdown → HTML |

Register new elements in `elements/index.ts` (`elementPreviewComponents` + `createElementLiveExtensions`). Plugins still override via `MarkdownPlugin.components`.

**Orchestrator vs elements:** `extensions/live-preview.ts` owns simple same-pane inlines / ATX (hide `HeaderMark` / `EmphasisMark` / `CodeMark` / `StrikethroughMark` + style). Structural / host constructs live under `elements/<name>/`. Mark ownership is centralized in `extensions/live-ownership.ts` (`isMarkOwnedByElement` / `isConstructOwnedByElement`) — the orchestrator skips owned marks/constructs so element packages do not double-decorate. Block decorations (`block: true`) must use a `StateField` (table only).

### Pitfall: Live line padding wiped by shell theme

`markdown-cm-view.tsx` sets (via **`EditorView.theme`**, high priority):

```ts
".cm-line": { padding: "0" }
```

Element packages often style line chrome with **`EditorView.baseTheme`** (lower priority). A single-class selector such as `.cm-md-blockquote-line { paddingLeft: "0.85em" }` loses to the shell rule — **border/background may still show**, but padding/margin on the line look “written but dead.”

**Rule:** any padding (or other longhands that fight `.cm-line { padding: 0 }`) on a `Decoration.line` class must use a **two-class** selector:

```ts
// ✅ beats shell `.cm-line { padding: 0 }`
".cm-line.cm-md-blockquote-line": { paddingLeft: "0.85em", borderLeft: "…" }
".cm-line.cm-md-codeblock-line": { paddingLeft: "14px", paddingRight: "14px", … }

// ❌ looks correct in source; padding never wins in Live
".cm-md-blockquote-line": { paddingLeft: "0.85em" }
```

Widget styles (list bullets, HR `<hr>`, image stub, mention chips) are **not** on `.cm-line` — this wipe does not apply to them.

Verify in Lab **Live** mode (screenshot or `getComputedStyle` on `.cm-line.cm-md-…`); do not trust Source/Preview alone.

Shipped: `elements/table/` — Preview (remark-gfm HTML) + Live **idle projection** (`chrome.ts`); active caret falls back to parent CM pipe text.

Shipped: `elements/codeblock/` — Preview (`pre`/`code` + rehype-highlight) + Live **`live.ts`** (collapse fences, lang badge, nested highlight).

Shipped: `elements/list/` — Preview (`ul`/`ol`/`li`) + Live **`live.ts`** (hide `ListMark`; bullet/ordinal widgets; GFM task checkboxes with SoT toggle).

Shipped: `elements/link/` — Preview (`a`) + Live **`live.ts`** (hide `[]()` / `<>`; style label / bare URL).

Shipped: `elements/blockquote/` — Preview (`blockquote`) + Live **`live.ts`** (hide `QuoteMark`; left-border line chrome).

Shipped: `elements/hr/` — Preview (`hr`) + Live **`live.ts`** (soft rule widget when inactive).

Shipped: `elements/image/` — Preview (`img`) + Live **`live.ts`** (image widget / broken stub when inactive).

### Live coverage (Markdown-derived)

| Construct | Live status | Where |
| --- | --- | --- |
| Paragraph | covered (identity) | — |
| ATX heading | covered | orchestrator |
| Strong / Emphasis / Strikethrough | covered | orchestrator |
| Inline code | covered | orchestrator |
| Fenced code | covered | `elements/codeblock/` |
| Table (GFM) | covered | `elements/table/` |
| Bullet / ordered list | covered | `elements/list/` |
| Task list (GFM) | covered | `elements/list/` |
| Link / Autolink / bare URL | covered | `elements/link/` |
| Blockquote | covered | `elements/blockquote/` |
| Horizontal rule | covered | `elements/hr/` |
| Image | covered | `elements/image/` |
| Setext / Indented code / HardBreak / link refs | uncovered or partial | deferred |

Raw embedded HTML is out of scope.

## Public API

| Export | Role |
| --- | --- |
| `MarkdownEditor` | Live / Source / Preview chrome + controlled CM \| Reading View; `variant="borderless"` hides mode header, defaults Live, toggles Live↔Source via Mod-Shift-M / hover ghost (`localStorage` preference; no Preview) |
| `MarkdownEditorHandle` / `editorRef` | Imperative `focus({ at })` for title→body handoff (bypasses accidental-focus gate) |
| `MarkdownPreview` | Preview-only renderer (Reading View) |
| `MarkdownPlugin` | `transformSource` + `components` + optional `allowedUrlSchemes` (Reading View) |
| `MentionAutocompleteCandidate` / `MentionAutocompleteProps` | Generic `@` autocomplete shell (product fills `insertText`) |
| `replaceOutsideCode` | Regex replace that skips fenced + inline code (for mention adapters) |
| `linkChipStyles` | Optional CSS module class names for generic link chips (`ok` / `broken`) |

**Modes:** `live` (default — same-pane decorations), `source` (raw CM), `preview` (Reading View). Live preview ≠ split-pane. `variant="borderless"` hides the mode header; defaults to Live; `Mod-Shift-M` or the hover-revealed ghost control toggles Live↔Source; preference is stored in `localStorage` (`pm.markdown-editor.borderless-mode`); `preview` is not part of the borderless cycle.

Plugins that emit custom href schemes in Reading View (e.g. `issue:`, `wiki:`) must set `allowedUrlSchemes` on `MarkdownPlugin`.

## Host token contract

Chrome colors use app SoT `--color-use--*` only (see `src/global-styles/`). This module depends on:

| Token | Use |
| --- | --- |
| `--color-use--text-prime` | Body text, caret |
| `--color-use--text-secondary` | Muted labels, blockquotes, list marker widgets |
| `--color-use--text-negative` | Placeholder |
| `--color-use--bg-prime-hex` | Editor shell / tooltip bg |
| `--color-use--bg-secondary-hex` | Preview shell |
| `--color-use--bg-darken` | Inline / fenced code bg |
| `--color-use--border-prime-hex` | Soft rules (hr) |
| `--color-use--border-emphasis-hex` | Shell / table / tooltip borders |
| `--color-use--border-focus` | Focused selection |
| `--color-use--hover-overlay-hover` | Active line / selected completion |
| `--color-use--hover-overlay-mouse-down` | Selection (blurred) |
| `--color-use--accent-text` | Links, mention/chip fg |
| `--color-use--accent-bg` | Mention / ok chip bg |
| `--color-use--danger-bg` / `--color-use--danger-fg` | Broken chip |

## Lab (review harness)

DEV-only: `#/lab/markdown-editor` (`src/lab/pages/markdown-editor.tsx`). Mock wiki plugin + fixtures only — never real issue / wiki indexes.

**Review checklist**

- `MarkdownEditor` baseline: live / source / preview, label, placeholder, controlled value
- `MarkdownEditor` **borderless**: no mode header; Live↔Source via Mod-Shift-M and hover-revealed ghost control; preference persists in `localStorage`; Focus start button lands caret (programmatic focus gate bypass); in **Source**, autosave / blur flush / title↔body handoff still work
- Auto-pair: `[]` / `*` / `**` / `()` — **not** backticks
- Live: markers hide off-cursor; headings/emphasis styled; `@…` mentions show resolved title when inactive; mentions inside `` `inline` `` / fenced code stay literal (no chip)
- Preview: same — `@…` inside code is not rewritten to chips (`replaceOutsideCode`)
- Live **lists**: inactive `ListItem` hides `-` / `*` / `+` / `1.` `ListMark` and shows bullet `•` or **sibling-index** ordinal widget (not raw SoT digits — so Enter→renumber then indent does not leave a nested `2` / outer `3`); indent/dedent (`Mod-]` / `Mod-[`) also rewrites touched OrderedList marks to `1..n`; GFM `- [ ]` / `- [x]` show checkboxes (click toggles SoT); caret anywhere in the item reveals raw marks; nested bullets / ordered under bullet stay indented
- Live **links**: inactive `Link` / `Autolink` hide `[]()` / `<>` and URL chrome; label (or URL for autolink) styled with accent; caret in construct reveals source
- Live **blockquote**: hide `>` when inactive; left-border muted line chrome
- Live **hr**: inactive `---` / `***` → soft rule widget; caret on line reveals source
- Live **images**: inactive `![alt](url)` → `<img>` widget or broken stub; caret reveals source
- Live **code blocks**: fenced blocks get block chrome; fences collapse off-cursor (lang badge); body uses nested language highlighting (`codeLanguages`). At the first/last nav edge, ↑/← and ↓/→ leave the whole fence (idle skips lang header + collapsed footer)
- Preview: fenced code highlighted via rehype-highlight (token colors from `--color-use--*`)
- Live **tables** (idle projection + parent-CM pipe editing):
  - Idle: every GFM table is a **pinned-width horizontal scroll host** — only the table scrolls horizontally; editor body text does not shift
  - Idle: cell inline Markdown (`**` / `*` / `~~` / `` `code` `` / links) renders as styled HTML
  - Idle: `:---` / `:---:` / `---:` alignments apply; empty cells keep their column slot
  - Caret enters the table range **or** sits on the line immediately above/below → decoration clears; raw pipe lines show
  - Caret leaves the table and its neighboring lines → projection returns; no extra key required
  - ↑/↓ from the adjacent line into the table → already expanded to pipe text; **does not skip** the table
  - Click an idle projected cell → caret lands on that cell's pipe position (lookup failure may fall back to table start — acceptable)
  - Active editing uses **ordinary CM keybindings**: no table-specific shortcuts, no gutter menu, no drag reorder of rows/columns
  - Preview: GFM tables render as bordered HTML tables inside a table-local horizontal scroll host
- Fixture **Lists** — nested bullets, wide ordinals (`10.`), ordered-under-bullet, task items; Live idle shows widgets/checkboxes not raw `-`/`1.`/`[ ]`
- Fixture **Links** — `[label](url)`, bold-in-label, autolink; Live idle label-only
- Fixture **Blockquote** — multi-paragraph + nested `>>` + quote⊃list
- Fixture **HR** — `---` and `***`
- Fixture **Images** — data-URI demo + broken URL stub
- Fixture **Code** — js / python / json fences styled + highlighted in Live and Preview
- Fixture **Table** — cells with `**` / `*` / `~~` / `` `code` `` / links styled in idle Live host; click/caret enters pipe edit in parent CM
- Fixture **Table (long)** — long Chinese cells must not shatter columns; overflow scrolls **inside the host** while idle; body text above/below must not shift horizontally; active state is ordinary wrapped pipe text (acceptable)
- Fixture **Table (align)** — `:---` / `:---:` / `---:` + mixed CJK/ASCII + empty cell; empty cell keeps its column box; idle projection shares the separator's `text-align`
- Mock `@wiki-…` plugin + mention autocomplete
- `MarkdownPreview` standalone + empty → “Empty”
- Fixture buttons; dark theme follows `--color-use--*`

## Out of scope (for now)

Toolbars, Monaco, **split-pane dual edit/preview**, MDX, npm publish, raw embedded HTML sanitization / rendering.

**Table visual editing** (contenteditable / nested CM / gutter menus / drag reorder) — removed 2026-08; archive on branch `wip/table-visual-edit`. Also out: active-state column-align decorations; table create-autocomplete.

**Deferred Live polish** (not blocking): Setext headings, indented code blocks, HardBreak widgets, link reference definitions.

**Allowed** for live-preview / auto-pair / `@` mention shell: CodeMirror 6 (single engine). Prefer one engine for all three; do not dual-stack textarea + CM.

Future extract to a domain repo: only when a second host, publish artifact, or stable plugin API appears — propose via `/propose-repo`, not a return to an in-repo packages tree.
