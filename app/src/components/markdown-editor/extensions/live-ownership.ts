// ↔ ./live-preview.ts — orchestrator skips marks owned by element packages
// ↔ ../elements/codeblock/live.ts — owns CodeMark under FencedCode
// ↔ ../elements/link/live.ts — owns LinkMark / URL under Link|Autolink|Image
// ↔ ../elements/list/live.ts — owns ListMark (and TaskMarker) outside orchestrator
// ↔ ../elements/math/live.ts — scanner-owned $ / $$ (no Lezer Math nodes)
// ↔ AGENTS.md — ownership registry contract

import type { SyntaxNode } from "@lezer/common";

/**
 * True when an element package owns this mark and the orchestrator must not
 * hide/style it. Element packages register ownership by extending the rules
 * below (or by never claiming the mark in the orchestrator at all — e.g. ListMark).
 *
 * Math (`elements/math/`) is scanner-owned: `@lezer/markdown` has no Math
 * nodes, so `$` / `$$` are not marks here. The Live plugin skips code ranges
 * the same way mentions do; the orchestrator has nothing to hide.
 */
export function isMarkOwnedByElement(
  markName: string,
  parent: SyntaxNode | null | undefined,
): boolean {
  if (!parent) return false;

  // elements/codeblock — fenced fences + CodeMark
  if (markName === "CodeMark" && parent.name === "FencedCode") return true;

  // elements/link — delimiter marks + URL chrome inside links/autolinks
  if (
    (markName === "LinkMark" || markName === "URL") &&
    (parent.name === "Link" || parent.name === "Autolink")
  ) {
    return true;
  }

  // elements/image — same LinkMark/URL children under Image
  if (
    (markName === "LinkMark" || markName === "URL") &&
    parent.name === "Image"
  ) {
    return true;
  }

  return false;
}

/** True when a construct node is fully owned by an element package. */
export function isConstructOwnedByElement(nodeName: string): boolean {
  return (
    nodeName === "Link" ||
    nodeName === "Autolink" ||
    nodeName === "Image" ||
    nodeName === "URL" ||
    nodeName === "Table"
  );
}
