export type FixtureId =
  | "mixed"
  | "headings"
  | "lists"
  | "blockquote"
  | "code"
  | "mermaid"
  | "links"
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
  links: {
    label: "Links",
    source: `[Example](https://example.com)

[Bold **label**](https://example.com/path)

Autolink: <https://example.com>
`,
    note: "Live idle: label only (hide []() / <>); caret in link reveals source.",
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
    note: "Live idle: figure+figcaption (inline MD); non-images → attachment card; caret reveals source.",
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

Inline code stays literal: \`@wiki-ok\`

\`\`\`
Fenced stays literal: @wiki-ok
\`\`\`

Plain link still works: [docs](https://example.com)
`,
  },
};

export const DEFAULT_FIXTURE: FixtureId = "mixed";
