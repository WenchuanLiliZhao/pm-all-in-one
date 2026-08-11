// ↔ ./chrome.ts — parseTable for idle HTML projection
// ↔ ./pipe.ts — alignOf / parseSeparatorAligns
// ↔ AGENTS.md — GFM table idle projection helpers

import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

export { alignOf, parseSeparatorAligns } from "./pipe.ts";

export type TableCellRef = {
  from: number;
  to: number;
  text: string;
};

export type TableRowKind = "header" | "body";

export type TableRowRef = {
  kind: TableRowKind;
  from: number;
  to: number;
  cells: TableCellRef[];
};

/** Parsed GFM table at a document position (lezer Table node). */
export type TableModel = {
  node: SyntaxNode;
  from: number;
  to: number;
  /** Full separator line (TableDelimiter child of Table). */
  separator: { from: number; to: number; text: string };
  header: TableRowRef;
  body: TableRowRef[];
  colCount: number;
};

/**
 * Lezer omits `TableCell` nodes for empty cells — only pipes remain.
 * Rebuild column slots from consecutive `|` delimiters so empty cells keep
 * a from/to span (and appear in `cells.length`).
 */
function cellsOf(row: SyntaxNode, state: EditorState): TableCellRef[] {
  const pipes: { from: number; to: number }[] = [];
  const cellNodes: SyntaxNode[] = [];
  for (let c = row.firstChild; c; c = c.nextSibling) {
    if (c.name === "TableDelimiter") pipes.push({ from: c.from, to: c.to });
    else if (c.name === "TableCell") cellNodes.push(c);
  }
  if (pipes.length < 2) {
    // Fallback: rare rows with cells but no pipe children
    return cellNodes.map((c) => ({
      from: c.from,
      to: c.to,
      text: state.doc.sliceString(c.from, c.to),
    }));
  }

  const cells: TableCellRef[] = [];
  for (let i = 0; i < pipes.length - 1; i++) {
    const slotFrom = pipes[i]!.to;
    const slotTo = pipes[i + 1]!.from;
    const node = cellNodes.find((n) => n.from >= slotFrom && n.to <= slotTo);
    if (node) {
      cells.push({
        from: node.from,
        to: node.to,
        text: state.doc.sliceString(node.from, node.to),
      });
    } else {
      cells.push({ from: slotFrom, to: slotTo, text: "" });
    }
  }
  return cells;
}

function rowRef(
  kind: TableRowKind,
  node: SyntaxNode,
  state: EditorState,
): TableRowRef {
  return {
    kind,
    from: node.from,
    to: node.to,
    cells: cellsOf(node, state),
  };
}

export function parseTable(
  state: EditorState,
  table: SyntaxNode,
): TableModel | null {
  let headerNode: SyntaxNode | null = null;
  let sepNode: SyntaxNode | null = null;
  const bodyNodes: SyntaxNode[] = [];

  for (let c = table.firstChild; c; c = c.nextSibling) {
    if (c.name === "TableHeader") headerNode = c;
    else if (c.name === "TableDelimiter") sepNode = c;
    else if (c.name === "TableRow") bodyNodes.push(c);
  }

  if (!headerNode || !sepNode) return null;

  const header = rowRef("header", headerNode, state);
  const body = bodyNodes.map((n) => rowRef("body", n, state));
  const sepText = state.doc.sliceString(sepNode.from, sepNode.to);
  // Count separator segments from the pipe line itself (do not use
  // parseSeparatorAligns — that pads/truncates to a requested colCount).
  const sepInner = sepText.replace(/^\|/, "").replace(/\|$/, "");
  const sepCols = Math.max(sepInner.split("|").length, 1);
  const colCount = Math.max(
    header.cells.length,
    sepCols,
    ...body.map((r) => r.cells.length),
    1,
  );

  return {
    node: table,
    from: table.from,
    to: table.to,
    separator: {
      from: sepNode.from,
      to: sepNode.to,
      text: sepText,
    },
    header,
    body,
    colCount,
  };
}

