// ↔ ./index.ts — createBlockquoteLiveExtensions
// ↔ ./preview.tsx — Reading View twin
// ↔ AGENTS.md — Live blockquote checklist

import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

const hide = Decoration.replace({});
const quoteLine = Decoration.line({ class: "cm-md-blockquote-line" });

type DecSpec = { from: number; to: number; deco: Decoration };

function selectionOverlaps(
  from: number,
  to: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= to && selTo >= from;
}

function enclosingBlockquote(node: SyntaxNode): SyntaxNode | null {
  for (let p: SyntaxNode | null = node; p; p = p.parent) {
    if (p.name === "Blockquote") return p;
  }
  return null;
}

function buildBlockquoteDecorations(view: EditorView): DecorationSet {
  const specs: DecSpec[] = [];
  const focused = view.hasFocus;
  const sel = view.state.selection.main;
  const selFrom = focused ? sel.from : -1;
  const selTo = focused ? sel.to : -1;
  const lined = new Set<number>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === "Blockquote") {
          const start = view.state.doc.lineAt(node.from).number;
          const end = view.state.doc.lineAt(
            Math.max(node.from, node.to - 1),
          ).number;
          for (let n = start; n <= end; n++) {
            if (lined.has(n)) continue;
            lined.add(n);
            const line = view.state.doc.line(n);
            specs.push({ from: line.from, to: line.from, deco: quoteLine });
          }
          return;
        }

        if (node.name === "QuoteMark") {
          const quote = enclosingBlockquote(node.node);
          const active = quote
            ? selectionOverlaps(quote.from, quote.to, selFrom, selTo)
            : selectionOverlaps(node.from, node.to, selFrom, selTo);
          if (active) return;
          let hideTo = node.to;
          const lineTo = view.state.doc.lineAt(node.from).to;
          while (hideTo < lineTo) {
            const ch = view.state.doc.sliceString(hideTo, hideTo + 1);
            if (ch === " " || ch === "\t") hideTo += 1;
            else break;
          }
          specs.push({ from: node.from, to: hideTo, deco: hide });
        }
      },
    });
  }

  specs.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    specs.map((s) => s.deco.range(s.from, s.to)),
    true,
  );
}

const blockquoteTheme = EditorView.baseTheme({
  // Must beat markdown-cm-view `.cm-line { padding: 0 }` (EditorView.theme).
  ".cm-line.cm-md-blockquote-line": {
    borderLeft: "3px solid var(--color-use--border-emphasis-hex)",
    paddingLeft: "0.85em",
    color: "var(--color-use--text-secondary)",
    boxSizing: "border-box",
  },
});

/** Live blockquote: hide `>` when inactive; left-border line chrome. */
export function createBlockquoteLiveExtensions(): Extension[] {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildBlockquoteDecorations(view);
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.selectionSet ||
            update.focusChanged ||
            syntaxTree(update.state) !== syntaxTree(update.startState)
          ) {
            this.decorations = buildBlockquoteDecorations(update.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
    blockquoteTheme,
  ];
}
