// ↔ elements/image/live.ts — figcaption / attachment card titles
// ↔ elements/image/preview.tsx — Reading View captions
// ↔ elements/table/inline-html.ts — table cells keep tree-based twin (optional unify later)
// ↔ ./markdown-escape.ts — Escape backslash dropped in projection
// ↔ AGENTS.md — caption fragment seam for future $...$ math

import { markdownLanguage } from "@codemirror/lang-markdown";
import type { SyntaxNode } from "@lezer/common";
import { unescapeMarkdownEscape } from "./markdown-escape.ts";

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

/**
 * Render a short inline Markdown **string** to HTML (strong / em / strike /
 * code / links). Used for image alt / attachment labels — CommonMark does not
 * parse markup inside `![…]`, so callers must re-parse. Future `$...$` math
 * belongs here (not on the body AST). Nested images are omitted.
 */
export function renderInlineMarkdownFragment(text: string): string {
  const src = text.trim();
  if (!src) return "";
  const tree = markdownLanguage.parser.parse(src);
  return renderNode(src, tree.topNode);
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
