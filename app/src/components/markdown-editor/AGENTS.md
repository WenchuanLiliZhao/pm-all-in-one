---
aliases:
  - markdown-editor
updated: 2026-08-18
description: >-
  App-local Markdown editor module—CodeMirror 6 (Source/Live) +
  react-markdown Reading View; sticky filename nav; GFM tables/lists/codeblocks;
  per-element encapsulation; pluggable transforms; no product ids in core.
---

# `src/components/markdown-editor/`

<!-- ↔ index.ts — public API surface this doc describes -->
<!-- ↔ types.ts — MarkdownPlugin; § Reading View fence plugins -->
<!-- ↔ preview-rehype.ts — Reading View raw HTML + sanitize -->
<!-- ↔ elements/index.ts — per-element registry (preview + live) -->
<!-- ↔ src/lib/markdown/ — product MarkdownPlugin adapters (issue/wiki) -->
<!-- ↔ src/lab/pages/markdown-editor.tsx — DEV review harness -->

App-local Markdown edit module. SoT remains raw Markdown. Product adapters (`@issue-…` / `@wiki-…`) live in `src/lib/markdown/`, not here.

**What it is:** CodeMirror 6 editor (Source + same-pane Live decorations) + `MarkdownPreview` Reading View (standalone or Preview mode), with a pluggable transform/components surface. Core stays product-agnostic — no project/issue ids, no host-specific completions.

**What it is not:** issue-link semantics, wiki resolution, IPC, or any product adapter.

## Module boundary (required)

**Every new feature must be judged before implementation.** Ask, in order:

1. **Belong in this module?** — Generic Markdown editing / preview behavior (CM engine, auto-pair, live decorations, Reading View shell, plugin *types* / hooks). Put it here.
2. **A plugin for this module?** — Domain or product behavior that plugs into `MarkdownPlugin` / mention autocomplete without baking product ids into core (e.g. `@issue-…` preview chips, wiki links). Implement as a plugin under `src/lib/markdown/` (or lab mock), not in this module.
3. **Neither?** — App chrome, storage, IPC, project/issue CRUD. Keep it elsewhere.

Do not default new work into this module. If it fails (1) and (2), it stays out.

**If the work is a Live projection of a Markdown construct, ask both of the following in the same pass** — before implementation, not during review. A construct earns a Live projection only when **both** hold:

1. **The source fully determines the artifact.** Render it once and you have shown everything the source says.
2. **The source is not readable as-is.** A reader cannot get the meaning from the text faster than from the projection.

Either alone is not enough. Passing (1) but not (2) spends a renderer to beat plain text. Passing (2) but not (1) is worse: the projection is a lie by omission — one frame of something whose content is the variation, while the reader believes they have seen the whole thing.

**Not rendering is the reversible default.** Adding a projection later costs only the projection. Removing one after authors depend on it costs a migration. When the rule is ambiguous, the answer is no, revisited on evidence.

**Re-check (this rule vs what already ships).** If the rule would refuse a shipped construct, the rule is wrong — revise it before using it to refuse anything new.

| Construct | Both? | Why / verdict |
| --- | --- | --- |
| mermaid | yes | `A-->B` edge list hides topology. Keep. |
| table | yes | Pipe rows hide column alignment. Keep. |
| list / link / blockquote / hr / image | yes | Marker hiding and widgets; fully determined; noisy as source. Keep. |
| math (`$…$` / `$$…$$`) | yes | Keep — `elements/math/`. |
| product figure fences (`plot` and kin) | no (fails both) | Refused — ordinary codeblock chrome only; no figure runtime in this module. Reversible: revisit on author feedback, and only as a Reading View plugin — never by adding a runtime to Live. |

**Import rule:** this module must not import `@/lib/bridge`, `@pm-core/*`, workspace stores, or other host product modules. Consumers import `@/components/markdown-editor` directly (not via `@/components` barrel) when they also export from that barrel — avoid cycles.

## Layout

| Path | Role |
| --- | --- |
| `index.ts` | Public exports (`MarkdownEditor`, `MarkdownPreview`, types, `linkChipStyles`) |
| `types.ts` | `MarkdownPlugin` + `MarkdownFencePlugin` + editor/preview/mention prop contracts |
| `merge-plugins.ts` | Reading View: transform / components / URL-scheme / fence-registry merge |
| `markdown-editor.tsx` | Editor shell (sticky filename nav + Source / Live / Preview; default Preview) |
| `markdown-cm-view.tsx` | CodeMirror host (GFM via `markdownLanguage`; Source vs Live) |
| `markdown-preview.tsx` | Reading View (`react-markdown` + `remark-gfm` + `remark-math` + `rehype-raw` / `rehype-sanitize`) — also mounted by `MarkdownEditor` in Preview |
| `preview-rehype.ts` | Reading View remark/rehype stack (raw HTML parse + sanitize + highlight + katex) |
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

Verify in Lab **Live** (screenshot or `getComputedStyle` on `.cm-line.cm-md-…`); do not trust standalone Preview alone.

Shipped: `elements/table/` — Preview (remark-gfm HTML) + Live **idle projection** (`chrome.ts`); active caret falls back to parent CM pipe text.

Shipped: `elements/codeblock/` — Preview (`pre`/`code` + rehype-highlight; mermaid fence → SVG; plugin fence registry before mermaid) + Live **`live.ts`** (collapse fences, lang badge, nested highlight; idle mermaid SVG).

Shipped: `elements/list/` — Preview (`ul`/`ol`/`li`) + Live **`live.ts`** (hide `ListMark`; bullet/ordinal widgets; GFM task checkboxes with SoT toggle).

Shipped: `elements/link/` — Preview (`a`) + Live **`live.ts`** (hide `[]()` / `<>`; style label / bare URL).

Shipped: `elements/blockquote/` — Preview (`blockquote`) + Live **`live.ts`** (hide `QuoteMark`; left-border line chrome).

Shipped: `elements/hr/` — Preview (`hr`) + Live **`live.ts`** (soft rule widget when inactive).

Shipped: `elements/image/` — Preview (`img`) + Live **`live.ts`** (image widget / broken stub when inactive).

Shipped: `elements/math/` — Preview (`remark-math` + `rehype-katex`) + Live **`live.ts`** (idle KaTeX widget; caret in delimiters reveals source).

### Live coverage (Markdown-derived)

| Construct | Live status | Where |
| --- | --- | --- |
| Paragraph | covered (identity) | — |
| ATX heading | covered | orchestrator |
| Strong / Emphasis / Strikethrough | covered | orchestrator |
| Inline code | covered | orchestrator |
| Escape (`\|`, `\*`) | covered | orchestrator + table HTML |
| Fenced code | covered | `elements/codeblock/` |
| Mermaid fence | covered | `elements/codeblock/` (idle SVG; active = source) |
| Table (GFM) | covered | `elements/table/` |
| Bullet / ordered list | covered | `elements/list/` |
| Task list (GFM) | covered | `elements/list/` |
| Link / Autolink / bare URL | covered | `elements/link/` |
| Blockquote | covered | `elements/blockquote/` |
| Horizontal rule | covered | `elements/hr/` |
| Image | covered | `elements/image/` |
| Math (`$…$` / `$$…$$`) | covered | `elements/math/` (idle KaTeX; active = source) |
| Setext / Indented code / HardBreak / link refs | uncovered or partial | deferred |

Unlisted fences stay on ordinary Live codeblock chrome; that is a Live-projection decision, not a gap. Reading View may claim them via `MarkdownPlugin.fences` (see § Reading View fence plugins); do not add a Live figure runtime.

Raw embedded HTML has **no Live projection** (source stays visible). Reading View parses it with `rehype-raw` then `rehype-sanitize` (GitHub-like schema + plugin URL schemes). Tags such as `<a>` use the same element components as Markdown constructs. HTML comments are dropped (not shown as text). `script` and event handlers are stripped.

## Public API

| Export | Role |
| --- | --- |
| `MarkdownEditor` | Bordered CM editor + Reading View; sticky filename nav; Source / Live / Preview (default Preview) |
| `MarkdownEditorHandle` / `editorRef` | Imperative `focus({ at })` for title→body handoff (bypasses accidental-focus gate; Preview → Live) |
| `MarkdownPreview` | Preview-only renderer (Reading View) — Lab / standalone; also mounted inside `MarkdownEditor` in Preview |
| `MarkdownPlugin` | Reading View: `transformSource` + `components` + optional `allowedUrlSchemes` + optional `fences` lang registry (see § Reading View fence plugins). |
| `MarkdownFencePlugin` | One claimed fence lang + Reading View component + optional `interactive` |
| `MentionAutocompleteCandidate` / `MentionAutocompleteProps` | Generic `@` autocomplete shell (product fills `insertText`); optional `onActivate` for Live ⌘/Ctrl-click |
| `replaceOutsideCode` | Regex replace that skips fenced + inline code (for mention adapters) |
| `linkChipStyles` | Optional CSS module class names for generic link chips (`ok` / `broken`) |
| `previewAnchorClassName` | Accent class for plugin fallback `<a>` (matches Live / Preview links) |

**Modes:** `MarkdownEditorMode` is `"live" | "source" | "preview"`. Uncontrolled after mount via `defaultMode` (default `"preview"`). No `localStorage` preference. Source = CM without live decorations (monospace). Live = CM with live decorations (inherit body font). Preview = `MarkdownPreview` (CM stays mounted, hidden). Mode switch is a **flush** `ButtonGroup` in the header (no nested stroke — chrome owns the outer edge; segments use inset dividers). Active segment is `fill-inverse`; idle is `ghost`. `filename` (default `"README.md"`) is the left sticky-nav label. Hosts in `DocEditShell` set `--markdown-editor-sticky-top` so the nav docks under page Save chrome. Pane fill is transparent in every mode (header stays `--color-use--bg-prime-hex` so sticky occlusion matches the page).

Plugins that emit custom href schemes in Reading View (e.g. `issue:`, `wiki:`) must set `allowedUrlSchemes` on `MarkdownPlugin`.

## Reading View fence plugins

Interactive product fences (parameter-sweep figure DSLs such as `plot`) fail the Live projection gate above. If they render, **Reading View is the only legal host.** That is why the Live path was refused, not a deferral of the same widget.

**Why Reading View.** There is no caret competing with widget gestures. A slider or canvas drag inside Live makes mouse-down ambiguous between dragging the control and placing the cursor — the same collision that keeps table active-state as plain pipe text. Do not add a Live widget to dodge this.

**Seam.** `MarkdownPlugin` is Reading View only (`transformSource` + `components` + `allowedUrlSchemes` + `fences`). `MarkdownPreview` (Preview mode and standalone) merges plugins. Live decorations do not consult plugins. A fence plugin must not grow a twin under `elements/` and must not import a figure runtime into this module.

**Do not steal `pre` / `a` / `img`.** `MarkdownPlugin.components` wins on key collision, but core re-applies those factories after merge: `pre` keeps mermaid / boxed code; `a` keeps `assets/` attachment cards (mention-scheme hrefs still go to the plugin); `img` resolves `assets/` the same way Live does. Claiming a fence language is a **lang registry** entry, not a `pre` override.

A plugin declares, per claimed fence language (first token of the info string — same rule as workspace fence validators):

| Field | Meaning |
| --- | --- |
| `lang` | Fence language it owns (`plot` matches info `plot riemann`) |
| `component` | Reading View renderer for that fence's body |
| `interactive` | If true, the component may own a canvas and an imperative lifecycle (listeners, animation, resize). False = pure render, like today's mermaid SVG. |

Core `pre` looks up `lang` in the plugin registry **before** mermaid / boxed code. Unclaimed langs stay ordinary chrome. Two plugins claiming the same `lang` is a load-time error. Claimed langs are also added to `rehype-highlight` `plainText`.

**Lifecycle** (required when `interactive` is true):

1. **Mount** — create the renderer from the fence body. The body is the SoT; do not keep a parallel model that can drift from source.
2. **Resize** — observe the host box; do not assume a fixed CSS size.
3. **Teardown** — on source change **and** on unmount, drop listeners, animation frames, and canvas resources. The first navigation away from the page must not leak. A missing teardown rejects the plugin.

**What this module does not supply.** The plugin brings its own renderer. This module supplies the seam, never a bundled figure runtime. Product adapters live under `src/lib/markdown/` (the `plot` plugin is one).

**Admissible?** Accept a proposed fence plugin only if all hold:

1. Reading View only — no Live decoration, no CM widget, no `elements/<name>/live.ts`.
2. Claims named langs via the registry; does not override `pre` / `code` for every fence.
3. Ships its own renderer; adds no plot/figure dependency to this module or app `package.json`.
4. If interactive: mount / resize / teardown as above.
5. Live still shows those fences as ordinary codeblock chrome (Lab **Plot** fixture still passes in Live).

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
| `--color-use--border-prime` | Shell border (alpha, lightest) |
| `--color-use--border-prime-hex` | Soft rules (hr) |
| `--color-use--border-emphasis-hex` | Table / tooltip borders |
| `--color-use--border-focus` | Focused selection |
| `--color-use--hover-overlay-hover` | Active line / selected completion |
| `--color-use--hover-overlay-mouse-down` | Selection (blurred) |
| `--color-use--accent-text` | Links, mention/chip fg |
| `--color-use--accent-bg` | Mention / ok chip bg |
| `--color-use--danger-bg` / `--color-use--danger-fg` | Broken chip; mermaid / math parse errors |

## Lab (review harness)

DEV-only: `#/lab/markdown-editor` (`src/lab/pages/markdown-editor.tsx`). Mock wiki plugin + fixtures only — never real issue / wiki indexes.

**Review checklist**

- `MarkdownEditor` baseline: bordered shell, sticky filename nav (`README.md`), Source / Live / Preview (opens Preview), placeholder, controlled value
- `MarkdownEditor` **programmatic focus**: Focus start from Preview switches to Live and lands caret (programmatic focus gate bypass); title↔body handoff still works (save is host Save / Cmd+S only)
- Auto-pair: `[]` / `*` / `**` / `()` — **not** backticks
- Live: markers hide off-cursor; headings/emphasis styled; escaped punctuation (`\|`, `\*`) hides the backslash when idle (escaped char uses body color, not `tags.escape` orange); caret in the escape or immediately left/right reveals `\` + orange; `@…` mentions show resolved title when inactive; mentions inside `` `inline` `` / fenced code stay literal (no chip); ⌘/Ctrl-click a mention (chip or raw, outside code) calls `mentionAutocomplete.onActivate` with the SoT token (product navigates)
- Preview (standalone `MarkdownPreview`): same — `@…` inside code is not rewritten to chips (`replaceOutsideCode`)
- Live **lists**: inactive `ListItem` hides `-` / `*` / `+` / `1.` `ListMark` and shows bullet `•` or **sibling-index** ordinal widget (not raw SoT digits — so Enter→renumber then indent does not leave a nested `2` / outer `3`); indent/dedent (`Mod-]` / `Mod-[`) also rewrites touched OrderedList marks to `1..n`; GFM `- [ ]` / `- [x]` show checkboxes (click toggles SoT); caret anywhere in the item reveals raw marks; nested bullets / ordered under bullet stay indented
- Live **links**: inactive `Link` / `Autolink` hide `[]()` / `<>` and URL chrome; label (or URL for autolink) styled with accent; caret in construct reveals source
- Live **blockquote**: hide `>` when inactive; left-border muted line chrome
- Live **hr**: inactive `---` / `***` → soft rule widget; caret on line reveals source
- Live **images**: inactive `![alt](url)` → `<figure>` (+ figcaption from alt via `renderInlineMarkdownFragment`, including `$…$`) or attachment card for non-images; caret reveals source
- Preview **images / attachments**: same figure + card; `assets/…` src/href resolved via `localMedia` (same hook Live uses); a lone `![…](…)` is unwrapped out of `<p>` so the figure is a block, not nested in a paragraph
- Live **code blocks**: fenced blocks get block chrome; fences collapse off-cursor (lang badge); body uses nested language highlighting (`codeLanguages`). At the first/last nav edge, ↑/← and ↓/→ leave the whole fence (idle skips lang header + collapsed footer)
- Live **mermaid**: idle closed `mermaid` fence → SVG on the opening line (body + footer collapsed); caret in the fence reveals source + ordinary code chrome; parse errors use `--color-use--danger-*` (not an empty hole)
- Live **math**: idle `$…$` / `$$…$$` → KaTeX (`htmlAndMathml`); a pair counts only when the tex is non-empty after trim (lone `$$` / empty `$$$$` must not swallow formulas below); caret in the delimiters reveals source with `$` / `$$` in `--color-use--text-secondary` (same chrome role as `*` / `#`) **and** a KaTeX peek (inline: floats under the `$…$` input; display: block under the source); `$` inside inline code or fences stays literal; escaped `\$` does not open a span; malformed TeX uses `--color-use--danger-*` (not an empty hole); dark theme follows `--color-use--text-prime`
- Preview: fenced code highlighted via rehype-highlight (token colors from `--color-use--*`); mermaid fences render the same SVG (highlight skipped); claimed fence langs (e.g. `plot`) skip highlight and render via the plugin registry; math via `remark-math` + `rehype-katex`; raw HTML tags (e.g. `<a>`) render as elements; `<!-- comments -->` are not visible
- Live **tables** (idle projection + parent-CM pipe editing):
  - Idle: every GFM table is a **pinned-width horizontal scroll host** — only the table scrolls horizontally; editor body text does not shift
  - Idle: cell inline Markdown (`**` / `*` / `~~` / `` `code` `` / links / `\|` escapes) renders as styled HTML
  - Idle: `:---` / `:---:` / `---:` alignments apply; empty cells keep their column slot
  - Caret enters the table range **or** sits on the line immediately above/below → decoration clears; raw pipe lines show
  - Caret leaves the table and its neighboring lines → projection returns; no extra key required
  - ↑/↓ from the adjacent line into the table → already expanded to pipe text; **does not skip** the table
  - Click an idle projected cell → caret lands on that cell's pipe position (lookup failure may fall back to table start — acceptable)
  - Active editing uses **ordinary CM keybindings**: no table-specific shortcuts, no gutter menu, no drag reorder of rows/columns
  - Preview: GFM tables render as bordered HTML tables inside a table-local horizontal scroll host
- Fixture **Lists** — nested bullets, wide ordinals (`10.`), ordered-under-bullet, task items; Live idle shows widgets/checkboxes not raw `-`/`1.`/`[ ]`
- Fixture **Links** — `[label](url)`, bold-in-label, autolink; Live idle label-only
- Fixture **HTML** — Preview: `<a>` is a real link (accent); `<!-- … -->` is invisible; `<br>` / `<sup>` render. Live: source as-is (no projection)
- Fixture **Blockquote** — multi-paragraph + nested `>>` + quote⊃list
- Fixture **HR** — `---` and `***`
- Fixture **Images** — data-URI demo + broken URL stub
- Fixture **Code** — js / python / json fences styled + highlighted in Live and Preview
- Fixture **Mermaid** — valid flowchart renders as SVG in Live idle + Preview; invalid fence shows an error box; caret in the fence reveals source
- Fixture **Plot** — `plot riemann` (real calc-kit YAML keys) stay ordinary codeblock chrome in Live idle **and** active; no figure widget. Fail Live if a projection appears. Preview **with** the product plot plugin: interactive figure; YAML `title` / `caption` `$…$` use the same inline fragment + KaTeX as markdown. The no-plugin baseline editor still boxes `plot` as an unknown lang.
- Fixture **Math** — inline + display render in Live idle and standalone Preview; caret in delimiters reveals source **and** a peek preview; `$` inside a fence stays literal; malformed TeX shows a bounded error
- Fixture **Table** — cells with `**` / `*` / `~~` / `` `code` `` / links styled in idle Live host; click/caret enters pipe edit in parent CM
- Fixture **Table (long)** — long Chinese cells must not shatter columns; overflow scrolls **inside the host** while idle; body text above/below must not shift horizontally; active state is ordinary wrapped pipe text (acceptable)
- Fixture **Table (align)** — `:---` / `:---:` / `---:` + mixed CJK/ASCII + empty cell; empty cell keeps its column box; idle projection shares the separator's `text-align`
- Mock `@wiki-…` plugin + mention autocomplete
- `MarkdownPreview` standalone + empty → “Empty”
- Fixture buttons; dark theme follows `--color-use--*`

## Out of scope (for now)

Toolbars, Monaco, **split-pane dual edit/preview**, MDX, npm publish. Live projection of raw HTML (source stays visible).

**Table visual editing** (contenteditable / nested CM / gutter menus / drag reorder) — removed 2026-08; archive on branch `wip/table-visual-edit`. Also out: active-state column-align decorations; table create-autocomplete.

**Interactive product fences** — lang registry shipped (§ Reading View fence plugins). No figure runtime in this module; the product `plot` plugin lives under `src/lib/markdown/`.

**Deferred Live polish** (not blocking): Setext headings, indented code blocks, HardBreak widgets, link reference definitions.

**Allowed** for live-preview / auto-pair / `@` mention shell: CodeMirror 6 (single engine). Prefer one engine for all three; do not dual-stack textarea + CM.

Future extract to a domain repo: only when a second host, publish artifact, or stable plugin API appears — propose via `/propose-repo`, not a return to an in-repo packages tree.
