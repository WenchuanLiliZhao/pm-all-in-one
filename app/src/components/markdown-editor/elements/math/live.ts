// ↔ ./index.ts — createMathLiveExtensions
// ↔ ./preview.tsx — Reading View twin (remark-math + rehype-katex)
// ↔ ./parse.ts — $ / $$ scanner
// ↔ ./render.ts — katex.renderToString
// ↔ ../../extensions/live-ownership.ts — math is scanner-owned (no Lezer nodes)
// ↔ AGENTS.md — Live math checklist

import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { findMathSpans, type ByteRange } from "./parse";
import { renderMath } from "./render";

type DecSpec = { from: number; to: number; deco: Decoration };

function selectionOverlaps(
  from: number,
  to: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= to && selTo >= from;
}

function codeRangesIn(view: EditorView): ByteRange[] {
  const ranges: ByteRange[] = [];
  syntaxTree(view.state).iterate({
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

const mathCollapsed = Decoration.line({ class: "cm-md-math-collapsed" });
const mathHost = Decoration.line({ class: "cm-md-math-host" });
/** Positions the inline peek; `position: relative` so the float anchors to this line. */
const mathActiveLine = Decoration.line({ class: "cm-md-math-active" });
/** Active `$` / `$$` — same chrome role as EmphasisMark / HeaderMark. */
const mathMark = Decoration.mark({ class: "cm-md-math-mark" });

class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly display: boolean,
    /** Beside source while the caret is in the construct — does not replace. */
    readonly peek: boolean,
  ) {
    super();
  }

  eq(other: MathWidget) {
    return (
      other.tex === this.tex &&
      other.display === this.display &&
      other.peek === this.peek
    );
  }

  toDOM() {
    const host = document.createElement("span");
    const result = renderMath(this.tex, this.display);
    const peek = this.peek ? " cm-md-math-peek" : "";
    if (result.ok) {
      host.className = this.display
        ? `cm-md-math cm-md-math-display${peek}`
        : `cm-md-math cm-md-math-inline${peek}`;
      host.innerHTML = result.html;
    } else {
      host.className = this.display
        ? `cm-md-math cm-md-math-error cm-md-math-display${peek}`
        : `cm-md-math cm-md-math-error cm-md-math-inline${peek}`;
      host.textContent = result.error;
    }
    return host;
  }

  ignoreEvent() {
    return this.peek;
  }
}

function buildMathDecorations(view: EditorView): DecorationSet {
  const specs: DecSpec[] = [];
  const focused = view.hasFocus;
  const sel = view.state.selection.main;
  const selFrom = focused ? sel.from : -1;
  const selTo = focused ? sel.to : -1;
  const doc = view.state.doc;
  const spans = findMathSpans(doc.toString(), codeRangesIn(view));

  for (const span of spans) {
    const active = selectionOverlaps(span.from, span.to, selFrom, selTo);
    const markLen = span.display ? 2 : 1;
    if (active) {
      specs.push({
        from: span.from,
        to: span.from + markLen,
        deco: mathMark,
      });
      specs.push({
        from: span.to - markLen,
        to: span.to,
        deco: mathMark,
      });
      const peek = new MathWidget(span.tex, span.display, true);
      if (span.display) {
        specs.push({
          from: span.to,
          to: span.to,
          deco: Decoration.widget({ widget: peek, side: 1 }),
        });
      } else {
        const line = doc.lineAt(span.from);
        specs.push({ from: line.from, to: line.from, deco: mathActiveLine });
        specs.push({
          from: span.from,
          to: span.from,
          deco: Decoration.widget({ widget: peek, side: -1 }),
        });
      }
      continue;
    }

    const widget = new MathWidget(span.tex, span.display, false);
    const startLine = doc.lineAt(span.from);
    const endLine = doc.lineAt(Math.max(span.from, span.to - 1));

    if (startLine.number === endLine.number) {
      specs.push({
        from: span.from,
        to: span.to,
        deco: Decoration.replace({ widget }),
      });
      continue;
    }

    // Multi-line $$: widget on the opening line; collapse body + closer.
    // Do not replace across newlines (block widgets need a StateField).
    specs.push({
      from: startLine.from,
      to: startLine.from,
      deco: mathHost,
    });
    specs.push({
      from: span.from,
      to: startLine.to,
      deco: Decoration.replace({ widget }),
    });
    for (let n = startLine.number + 1; n <= endLine.number; n++) {
      const line = doc.line(n);
      specs.push({ from: line.from, to: line.from, deco: mathCollapsed });
    }
  }

  specs.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    specs.map((s) => s.deco.range(s.from, s.to)),
    true,
  );
}

const mathTheme = EditorView.baseTheme({
  ".cm-md-math": {
    color: "var(--color-use--text-prime)",
  },
  ".cm-md-math-mark": {
    color: "var(--color-use--text-secondary)",
  },
  ".cm-md-math-peek": {
    padding: "4px 8px",
    backgroundColor: "var(--color-use--bg-prime-hex)",
    border: "1px solid var(--color-use--border-emphasis-hex)",
    borderRadius: "4px",
    boxShadow: "var(--shadow-sm)",
    pointerEvents: "none",
    userSelect: "none",
  },
  // Inline: float under `$…$` without pushing the paragraph (mathblock card, overlay).
  ".cm-line.cm-md-math-active": {
    position: "relative",
    zIndex: "3",
  },
  ".cm-md-math-peek.cm-md-math-inline": {
    position: "absolute",
    top: "calc(100% + 4px)",
    zIndex: "4",
    maxWidth: "min(28em, 100%)",
    overflowX: "auto",
  },
  ".cm-md-math-peek.cm-md-math-display": {
    display: "block",
    marginTop: "0.35em",
    width: "100%",
    boxSizing: "border-box",
  },
  ".cm-md-math-inline": {
    display: "inline",
  },
  ".cm-md-math-display": {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    overflowX: "auto",
  },
  ".cm-md-math-error": {
    display: "inline-block",
    padding: "2px 6px",
    color: "var(--color-use--danger-fg)",
    backgroundColor: "var(--color-use--danger-bg)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.85em",
    whiteSpace: "pre-wrap",
  },
  ".cm-line.cm-md-math-host": {
    fontFamily: "inherit",
  },
  ".cm-md-math-host .cm-widgetBuffer": {
    display: "inline",
    width: "0",
    height: "0",
    lineHeight: "0",
    fontSize: "0",
    overflow: "hidden",
  },
  // Must beat shell `.cm-line { padding: 0 }` if collapse adds padding later.
  ".cm-line.cm-md-math-collapsed": {
    fontSize: "0",
    lineHeight: "0",
    height: "0",
    minHeight: "0",
    padding: "0",
    margin: "0",
    border: "none",
    overflow: "hidden",
  },
});

/** Live math: idle KaTeX replace; caret reveals source + peek preview. */
export function createMathLiveExtensions(): Extension[] {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildMathDecorations(view);
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.selectionSet ||
            update.focusChanged ||
            syntaxTree(update.state) !== syntaxTree(update.startState)
          ) {
            this.decorations = buildMathDecorations(update.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
    mathTheme,
  ];
}
