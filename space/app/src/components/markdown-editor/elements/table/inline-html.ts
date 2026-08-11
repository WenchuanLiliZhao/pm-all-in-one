// ↔ ./chrome.ts — idle TableHostWidget cells call renderInlineHtml
// ↔ AGENTS.md — idle Live host must style ** / * / ~~ / `code` / links

import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

/** Marks / chrome nodes — omitted from inactive HTML projection. */
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
 * Render inline Markdown under a lezer node to HTML for the inactive table
 * widget (hide delimiter marks; keep strong / em / code / strike / links).
 */
export function renderInlineHtml(state: EditorState, node: SyntaxNode): string {
  return renderNode(state, node);
}

function renderChildren(state: EditorState, node: SyntaxNode): string {
  let out = "";
  let pos = node.from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from > pos) {
      out += escapeHtml(state.doc.sliceString(pos, child.from));
    }
    out += renderNode(state, child);
    pos = child.to;
  }
  if (pos < node.to) {
    out += escapeHtml(state.doc.sliceString(pos, node.to));
  }
  return out;
}

function renderNode(state: EditorState, node: SyntaxNode): string {
  const name = node.name;

  if (SKIP.has(name)) return "";

  if (name === "HardBreak") return "<br>";

  if (name === "StrongEmphasis") {
    return `<strong>${renderChildren(state, node)}</strong>`;
  }
  if (name === "Emphasis") {
    return `<em>${renderChildren(state, node)}</em>`;
  }
  if (name === "Strikethrough") {
    return `<del>${renderChildren(state, node)}</del>`;
  }
  if (name === "InlineCode") {
    return `<code>${renderChildren(state, node)}</code>`;
  }

  if (name === "Link" || name === "Image") {
    let href = "";
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === "URL") {
        href = state.doc.sliceString(child.from, child.to);
        break;
      }
    }
    const label = renderLinkLabel(state, node);
    if (name === "Image") {
      return label
        ? `<span class="cm-md-table-image">${label}</span>`
        : `<span class="cm-md-table-image">${escapeHtml(href || "image")}</span>`;
    }
    if (!href) return label;
    return `<a href="${escapeAttr(href)}">${label || escapeHtml(href)}</a>`;
  }

  // URL inside a Link is consumed as href; bare URL / Autolink still show.
  if (name === "URL") {
    const text = state.doc.sliceString(node.from, node.to);
    return `<a href="${escapeAttr(text)}">${escapeHtml(text)}</a>`;
  }

  if (node.firstChild) return renderChildren(state, node);
  return escapeHtml(state.doc.sliceString(node.from, node.to));
}

/** Link/Image label: skip marks + URL child. */
function renderLinkLabel(state: EditorState, node: SyntaxNode): string {
  let out = "";
  let pos = node.from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "LinkMark" || child.name === "URL") {
      if (child.from > pos) {
        // Drop delimiter glyphs that sit in gaps (e.g. `](`); keep real text.
        const gap = state.doc.sliceString(pos, child.from);
        if (!/^[[\]()!]*$/.test(gap)) out += escapeHtml(gap);
      }
      pos = child.to;
      continue;
    }
    if (child.from > pos) {
      out += escapeHtml(state.doc.sliceString(pos, child.from));
    }
    out += renderNode(state, child);
    pos = child.to;
  }
  return out;
}
