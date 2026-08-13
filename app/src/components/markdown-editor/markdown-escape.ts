// ↔ ./inline-fragment.ts — image caption HTML
// ↔ ./elements/table/inline-html.ts — idle table cell HTML
// ↔ ./extensions/live-preview.ts — hide Escape backslash in Live idle
// ↔ ./markdown-escape.test.ts

/** Visible text of a lezer `Escape` node (`\|` → `|`, `\*` → `*`). */
export function unescapeMarkdownEscape(raw: string): string {
  return raw.startsWith("\\") ? raw.slice(1) : raw;
}
