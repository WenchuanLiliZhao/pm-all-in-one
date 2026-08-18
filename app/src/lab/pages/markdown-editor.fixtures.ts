export type FixtureId =
  | "mixed"
  | "headings"
  | "lists"
  | "blockquote"
  | "code"
  | "mermaid"
  | "plot"
  | "math"
  | "links"
  | "html"
  | "hr"
  | "images"
  | "table"
  | "tableLong"
  | "tableAlign"
  | "wiki";

export const FIXTURES: Record<
  FixtureId,
  { label: string; source: string; note?: string }
> = {
  mixed: {
    label: "Mixed",
    source: `# Markdown playground

Paragraph with **bold**, *italic*, and \`inline code\`.

## Lists

- Alpha
- Bravo
  - Nested

1. First
2. Second

> Blockquote line

\`\`\`ts
export const hello = "world";
\`\`\`

[External](https://example.com) · wiki ok @wiki-ok · broken @wiki-missing

---

| Col A | Col B |
| --- | --- |
| one | two |
`,
    note: "Tables use GFM (remark-gfm + CM markdownLanguage).",
  },
  headings: {
    label: "Headings",
    source: `# H1 heading
## H2 heading
### H3 heading
#### H4 heading

Body under headings.
`,
  },
  lists: {
    label: "Lists",
    source: `- Unordered one
- Unordered two with **bold** and \`code\`
  - Nested item
  - Nested sibling
- Trailing sibling

1. Ordered one
2. Ordered two
10. Wide ordinal (two digits)

- Mixed nest under bullet:
  1. Nested ordered A
  2. Nested ordered B

- [ ] Task open
- [x] Task done
`,
    note: "Live: inactive ListItem hides `-`/`1.` (bullet/ordinal widgets); tasks show checkboxes (click toggles SoT). Caret in item reveals raw marks.",
  },
  blockquote: {
    label: "Blockquote",
    source: `> A quoted thought.
>
> Second paragraph in the quote.

> Nested quote:
>> Inner line
>
> - Quote list item
`,
    note: "Live: hide `>` when inactive; left-border line chrome.",
  },
  code: {
    label: "Code",
    source: `Inline \`const x = 1\` and fences:

\`\`\`js
function greet(name) {
  // comment
  return \`hi \${name}\`;
}
\`\`\`

\`\`\`python
def greet(name: str) -> str:
    return f"hi {name}"
\`\`\`

\`\`\`json
{ "ok": true, "n": 2 }
\`\`\`
`,
    note: "Live: block chrome + nested CM highlight via codeLanguages. Preview: rehype-highlight.",
  },
  mermaid: {
    label: "Mermaid",
    source: `Valid flowchart:

\`\`\`mermaid
flowchart TD
  project["Project container"]
  epic[epic]
  task[task]
  subtask[subtask]
  project --> epic
  epic --> task
  task --> subtask
\`\`\`

Invalid fence (error box, not empty):

\`\`\`mermaid
this is not a mermaid diagram
\`\`\`
`,
    note: "Live idle: SVG on the opening fence (body collapsed); caret in fence reveals source. Preview: same SVG. Parse errors use danger tokens.",
  },
  plot: {
    label: "Plot",
    source: `Left Riemann sum of $4 - x^2/2$ on $[0, 2.5]$ — the figure spec is the lesson, not a still.

\`\`\`plot riemann
title: Approximating the integral of 4 − x²/2
f: "4 - x^2/2"
domain: [0, 3]
a: 0
b: 2.5
n: 6
rule: left
maxN: 60
height: tall
caption: Switch the rule and drag n. Live stays source; Preview draws the curve and the bars.
\`\`\`

Secant / tangent (2D):

\`\`\`plot function
title: Secant slope as $h → 0$ for $f(x) = x²$
f: "x^2"
domain: [-1, 3]
tangent:
  at: 1.2
  draggable: true
secant:
  h: 1.2
  max: 1.8
caption: Red is the tangent at $a$; green is the secant through $a$ and $a+h$. Animate $h → 0$.
\`\`\`

Surface (3D, default mild perspective) and a stronger cameraDepth:

\`\`\`plot surface3d
title: Scalar fields as surfaces (default cameraDepth 4)
surfaces:
  - f: "x^2 + y^2"
    label: "Bowl x²+y²"
    zrange: [0, 18]
  - f: "x^2 - y^2"
    label: "Saddle x²−y²"
    zrange: [-9, 9]
domain: [-3, 3]
gradient: true
height: tall
\`\`\`

\`\`\`plot surface3d
title: Same bowl, cameraDepth 2.2
surfaces:
  - f: "x^2 + y^2"
    label: "Bowl x²+y²"
    zrange: [0, 18]
domain: [-3, 3]
gradient: true
cameraDepth: 2.2
height: tall
\`\`\`

\`\`\`plot vectorfield
title: Source field (x, y)
fields:
  - F: "x, y"
    label: "Source (x, y)"
domain: [-3, 3]
density: 15
height: tall
\`\`\`
`,
    note: "Live idle and active: ordinary codeblock chrome only (lang badge, collapsed fences, YAML as source). Must not become a figure. Preview with the plot plugin: riemann curve + bars, plus 2D function and 3D/field figures; title/caption $…$ render as KaTeX. The no-plugin baseline editor still boxes plot as an unknown lang.",
  },
  math: {
    label: "Math",
    source: `Inline: the area is $\\int_{0}^{2.5}\\left(4 - \\tfrac{x^2}{2}\\right)dx$.

Display:

$$
E = mc^2
$$

Literal dollars in a fence:

\`\`\`
cost is $5 and $x^2$ stays text
\`\`\`

Escaped: the price is \\$5.

Malformed (bounded error, not an empty hole): $\\notARealCommand{x}$
`,
    note: "Live idle: KaTeX widget. Caret in $…$ floats a peek under the input; $$ peeks as a block under the source. Fence $ stays literal. Parse errors use danger tokens. Preview: remark-math + rehype-katex.",
  },
  links: {
    label: "Links",
    source: `[Example](https://example.com)

[Bold **label**](https://example.com/path)

Autolink: <https://example.com>
`,
    note: "Live idle: label only (hide []() / <>); caret in link reveals source.",
  },
  html: {
    label: "HTML",
    source: `Raw anchor: <a href="https://example.com">HTML a tag</a>

Comment in a paragraph: visible before <!-- this comment must not appear --> and after.

Standalone comment (must leave no hole):

<!-- hidden block comment -->

Line break: here<br>and here. Superscript: E = mc<sup>2</sup>.
`,
    note: "Preview: HTML tags render (same <a> styles as Markdown links); comments are dropped. Live shows source — no HTML projection.",
  },
  hr: {
    label: "HR",
    source: `Above the rule

---

Between

***

Below the rule
`,
    note: "Live idle: soft rule widget; caret on line reveals --- / ***.",
  },
  images: {
    label: "Images",
    source: `Figure with inline caption:

![**Demo** with \`code\`](https://placehold.co/120x48/png)

Broken URL (falls back to card):

![Missing](https://example.invalid/no-such-image.png)

Attachment card via image syntax:

![Spec PDF](assets/spec.pdf)

Attachment card via link:

[Meeting notes](assets/notes.pdf)

Type \`![](assets/\` or \`[](assets/\` in a real node body to autocomplete filenames (same menu as @).
`,
    note: "Live idle: figure+figcaption (inline MD); non-images → attachment card; caret reveals source. Preview: same figure/card; assets/ resolved when localMedia is passed.",
  },
  table: {
    label: "Table",
    source: `| Name | Value |
| --- | --- |
| **alpha** | *one* |
| ~~beta~~ | \`2\` |
| [docs](https://example.com) | plain |
`,
    note: "Idle host: bold/italic/strike/code/links. Click → visual table edit (Escape / click outside to exit).",
  },
  tableLong: {
    label: "Table (long)",
    source: `| 等级 | 行为 | 例子 |
| --- | --- | --- |
| 可恢复结构编辑 | 轻确认或无确认 + Toast Undo | Wiki Contents 移除（已有范本） |
| 配置删除 | 至少 \`confirmDangerous\`；in-use 字段需 typed ack | View；Custom prop Remove |
| 硬删目录 | Issue/Project：代价文案 + \`confirmDangerous\`；Wiki：typed ack (\`I know what I am doing\`) | Issue / Project / Wiki 页 |
`,
    note: "Scroll host: idle + visual-edit table-local overflow-x; body text must not shift horizontally.",
  },
  tableAlign: {
    label: "Table (align)",
    source: `| Left | Center | Right |
| :--- | :---: | ---: |
| short | 中 | 99 |
| a much longer ASCII cell | mix中英 |  |
| 空右列 | centered | rightmost |
`,
    note: "Mixed CJK/ASCII + :--- / :---: / ---:; empty cell must not collapse; Live text-align follows separator.",
  },
  wiki: {
    label: "Wiki chips",
    source: `Known: @wiki-ok

Missing: @wiki-missing

Wrap: leading text then @wiki-long and trailing text — Preview chips must wrap with the paragraph, not overflow.

Inline code stays literal: \`@wiki-ok\`

\`\`\`
Fenced stays literal: @wiki-ok
\`\`\`

Plain link still works: [docs](https://example.com)
`,
    note: "Preview chips are inline <a> (not buttons) so long titles wrap like Live marks.",
  },
};

export const DEFAULT_FIXTURE: FixtureId = "mixed";
