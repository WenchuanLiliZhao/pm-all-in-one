// ↔ elements/image/live.ts — figcaption / attachment card titles
// ↔ elements/image/preview.tsx — Reading View captions
// ↔ elements/math/parse.ts + render.ts — $…$ / $$…$$ same scanner + KaTeX as Live
// ↔ elements/table/inline-html.ts — table cells keep tree-based twin (optional unify later)
// ↔ ./markdown-escape.ts — Escape backslash dropped in projection
// ↔ AGENTS.md — caption / title fragment seam (inline Markdown + math)
// ↔ src/lib/markdown/plot-fence-plugin/mount.ts — plot title / caption consumer

import { markdownLanguage } from "@codemirror/lang-markdown";
import type { SyntaxNode, Tree } from "@lezer/common";
import { unescapeMarkdownEscape } from "./markdown-escape.ts";
import {
  findMathSpans,
  type ByteRange,
  type MathSpan,
} from "./elements/math/parse.ts";
import { renderMath } from "./elements/math/render.ts";

/** Marks / chrome — omitted from inactive HTML projection. */
const SKIP = new Set([
  "EmphasisMark",
  "CodeMark",
  "LinkMark",
  "StrikethroughMark",
]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, "&#39;");
}

/** Private-use tokens so math can be restored after the Markdown pass. */
function mathToken(index: number): string {
  return `\uE000${index}\uE000`;
}

const MATH_TOKEN_RE = /\uE000(\d+)\uE000/g;

function codeRangesFromTree(tree: Tree): ByteRange[] {
  const ranges: ByteRange[] = [];
  tree.iterate({
    enter: (node) => {
      if (
        node.name === "InlineCode" ||
        node.name === "FencedCode" ||
        node.name === "CodeBlock"
      ) {
        ranges.push({ from: node.from, to: node.to });
        return false;
      }
    },
  });
  return ranges;
}

function mathToHtml(span: MathSpan): string {
  const result = renderMath(span.tex, span.display);
  if (result.ok) return result.html;
  return `<span class="katex-error">${escapeHtml(result.error)}</span>`;
}

/**
 * Render a short inline Markdown **string** to HTML (strong / em / strike /
 * code / links / `$…$` math). Used for image alt / attachment labels and
 * plot title / caption — CommonMark does not parse markup inside `![…]` or
 * YAML scalars, so callers must re-parse. Math uses the same `$` / `$$`
 * scanner and KaTeX as Live (`elements/math`), not a second dialect.
 * Nested images are omitted.
 */
export function renderInlineMarkdownFragment(text: string): string {
  const src = text.trim();
  if (!src) return "";
  const tree = markdownLanguage.parser.parse(src);
  const spans = findMathSpans(src, codeRangesFromTree(tree));
  if (spans.length === 0) {
    return renderNode(src, tree.topNode);
  }
  const mathHtml: string[] = [];
  let withTokens = "";
  let pos = 0;
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]!;
    withTokens += src.slice(pos, span.from);
    withTokens += mathToken(i);
    mathHtml.push(mathToHtml(span));
    pos = span.to;
  }
  withTokens += src.slice(pos);
  const html = renderNode(
    withTokens,
    markdownLanguage.parser.parse(withTokens).topNode,
  );
  return html.replace(MATH_TOKEN_RE, (_, n) => mathHtml[Number(n)] ?? "");
}

function slice(doc: string, from: number, to: number): string {
  return doc.slice(from, to);
}

function renderChildren(doc: string, node: SyntaxNode): string {
  let out = "";
  let pos = node.from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from > pos) {
      out += escapeHtml(slice(doc, pos, child.from));
    }
    out += renderNode(doc, child);
    pos = child.to;
  }
  if (pos < node.to) {
    out += escapeHtml(slice(doc, pos, node.to));
  }
  return out;
}

function renderNode(doc: string, node: SyntaxNode): string {
  const name = node.name;

  if (SKIP.has(name)) return "";

  if (name === "Escape") {
    return escapeHtml(unescapeMarkdownEscape(slice(doc, node.from, node.to)));
  }

  if (name === "HardBreak") return "<br>";

  if (name === "StrongEmphasis") {
    return `<strong>${renderChildren(doc, node)}</strong>`;
  }
  if (name === "Emphasis") {
    return `<em>${renderChildren(doc, node)}</em>`;
  }
  if (name === "Strikethrough") {
    return `<del>${renderChildren(doc, node)}</del>`;
  }
  if (name === "InlineCode") {
    return `<code>${renderChildren(doc, node)}</code>`;
  }

  if (name === "Link") {
    let href = "";
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === "URL") {
        href = slice(doc, child.from, child.to);
        break;
      }
    }
    const label = renderLinkLabel(doc, node);
    if (!href) return label;
    return `<a href="${escapeAttr(href)}">${label || escapeHtml(href)}</a>`;
  }

  // Nested image in a caption — show label text only, never embed.
  if (name === "Image") {
    const label = renderLinkLabel(doc, node);
    return label || "";
  }

  if (name === "URL") {
    const text = slice(doc, node.from, node.to);
    return `<a href="${escapeAttr(text)}">${escapeHtml(text)}</a>`;
  }

  if (node.firstChild) return renderChildren(doc, node);
  return escapeHtml(slice(doc, node.from, node.to));
}

function renderLinkLabel(doc: string, node: SyntaxNode): string {
  let out = "";
  let pos = node.from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "LinkMark" || child.name === "URL") {
      if (child.from > pos) {
        const gap = slice(doc, pos, child.from);
        if (!/^[[\]()!]*$/.test(gap)) out += escapeHtml(gap);
      }
      pos = child.to;
      continue;
    }
    if (child.from > pos) {
      out += escapeHtml(slice(doc, pos, child.from));
    }
    out += renderNode(doc, child);
    pos = child.to;
  }
  return out;
}
