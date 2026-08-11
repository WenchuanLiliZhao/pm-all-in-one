// ↔ ./index.ts — createCodeblockLiveExtensions re-exported for element registry
// ↔ ./preview.tsx — Reading View twin (boxed pre/code + highlight)
// ↔ ../../extensions/live-preview.ts — skips FencedCode CodeMarks via live-ownership
// ↔ ../../extensions/live-ownership.ts — CodeMark under FencedCode owned here
// ↔ AGENTS.md — Live codeblock checklist (collapse fences, lang badge, edge exit)

import { syntaxTree } from "@codemirror/language";
import { EditorSelection, Prec, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

// ViewPlugin decorations must not replace line breaks — hide marks only.
const hide = Decoration.replace({});
const codeLine = Decoration.line({ class: "cm-md-codeblock-line" });
const codeFirst = Decoration.line({
  class: "cm-md-codeblock-line cm-md-codeblock-first",
});
const codeLast = Decoration.line({
  class: "cm-md-codeblock-line cm-md-codeblock-last",
});
const codeSolo = Decoration.line({
  class:
    "cm-md-codeblock-line cm-md-codeblock-first cm-md-codeblock-last",
});
const codeHeader = Decoration.line({
  class: "cm-md-codeblock-line cm-md-codeblock-header",
});
const fenceCollapsed = Decoration.line({
  class: "cm-md-codeblock-fence-collapsed",
});

type DecSpec = { from: number; to: number; deco: Decoration };

function selectionOverlaps(
  from: number,
  to: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= to && selTo >= from;
}

/** Closed fence = opening + closing CodeMark (Lezer still emits FencedCode while open). */
function isClosedFencedCode(node: {
  node: { firstChild: { name: string; nextSibling: unknown } | null };
}): boolean {
  let marks = 0;
  for (
    let c: { name: string; nextSibling: unknown } | null = node.node.firstChild;
    c;
    c = c.nextSibling as typeof c
  ) {
    if (c.name === "CodeMark") marks += 1;
  }
  return marks >= 2;
}

/** Traditional header strip: language name (or “code”) on the right. */
class LangHeaderWidget extends WidgetType {
  constructor(readonly lang: string) {
    super();
  }

  eq(other: LangHeaderWidget) {
    return other.lang === this.lang;
  }

  toDOM() {
    // Inline span — a block `div` forces cm-widgetBuffer onto its own line.
    const row = document.createElement("span");
    row.className = "cm-md-codeblock-header-row";
    const label = document.createElement("span");
    label.className = "cm-md-codeblock-lang";
    label.textContent = this.lang || "code";
    row.appendChild(label);
    return row;
  }

  ignoreEvent() {
    return false;
  }
}

function buildCodeblockDecorations(view: EditorView): DecorationSet {
  const specs: DecSpec[] = [];
  const focused = view.hasFocus;
  const sel = view.state.selection.main;
  const selFrom = focused ? sel.from : -1;
  const selTo = focused ? sel.to : -1;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== "FencedCode") return;
        // Incomplete fence (no closing ```) — leave raw, no chrome.
        if (!isClosedFencedCode(node)) return;

        const active = selectionOverlaps(node.from, node.to, selFrom, selTo);
        let codeText: { from: number; to: number } | null = null;
        let lang = "";
        for (let c = node.node.firstChild; c; c = c.nextSibling) {
          if (c.name === "CodeText") codeText = { from: c.from, to: c.to };
          if (c.name === "CodeInfo") {
            lang = view.state.doc.sliceString(c.from, c.to).trim();
          }
        }

        const fenceStart = view.state.doc.lineAt(node.from);
        const fenceEnd = view.state.doc.lineAt(Math.max(node.from, node.to - 1));
        const bodyFrom = codeText?.from ?? node.from;
        const bodyTo = codeText?.to ?? node.to;
        const bodyStart = view.state.doc.lineAt(bodyFrom);
        const bodyEnd = view.state.doc.lineAt(Math.max(bodyFrom, bodyTo - 1));
        const hasHeader = fenceStart.number < bodyStart.number;
        const hasFooter = fenceEnd.number > bodyEnd.number;

        const pushLine = (lineFrom: number, deco: Decoration) => {
          specs.push({ from: lineFrom, to: lineFrom, deco });
        };

        if (active) {
          for (let n = fenceStart.number; n <= fenceEnd.number; n++) {
            const line = view.state.doc.line(n);
            const isFirst = n === fenceStart.number;
            const isLast = n === fenceEnd.number;
            pushLine(
              line.from,
              isFirst && isLast
                ? codeSolo
                : isFirst
                  ? codeFirst
                  : isLast
                    ? codeLast
                    : codeLine,
            );
          }
          return;
        }

        // Header strip: replace the whole opening-fence line (no newline) so
        // marks + cm-widgetBuffer don't leave an extra empty line of height.
        if (hasHeader) {
          pushLine(fenceStart.from, codeHeader);
          specs.push({
            from: fenceStart.from,
            to: fenceStart.to,
            deco: Decoration.replace({
              widget: new LangHeaderWidget(lang),
            }),
          });
        }

        // Body.
        for (let n = bodyStart.number; n <= bodyEnd.number; n++) {
          const line = view.state.doc.line(n);
          // Header owns the top edge; body always closes the bottom (footer collapses).
          const isFirst = n === bodyStart.number && !hasHeader;
          const isLast = n === bodyEnd.number;
          pushLine(
            line.from,
            isFirst && isLast
              ? codeSolo
              : isFirst
                ? codeFirst
                : isLast
                  ? codeLast
                  : codeLine,
          );
        }

        // Closing fence: hide marks and collapse the line.
        if (hasFooter) {
          for (let c = node.node.firstChild; c; c = c.nextSibling) {
            if (
              (c.name === "CodeMark" || c.name === "CodeInfo") &&
              c.from >= fenceEnd.from &&
              c.to <= fenceEnd.to
            ) {
              specs.push({ from: c.from, to: c.to, deco: hide });
            }
          }
          pushLine(fenceEnd.from, fenceCollapsed);
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

const codeblockTheme = EditorView.baseTheme({
  // Must beat markdown-cm-view `.cm-line { padding: 0 }` (EditorView.theme).
  // Traditional boxed fence: continuous fill, side borders, inner padding.
  ".cm-line.cm-md-codeblock-line": {
    backgroundColor: "var(--color-use--bg-darken)",
    borderLeft: "1px solid var(--color-use--border-emphasis-hex)",
    borderRight: "1px solid var(--color-use--border-emphasis-hex)",
    paddingLeft: "14px",
    paddingRight: "14px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.92em",
    boxSizing: "border-box",
  },
  ".cm-line.cm-md-codeblock-first": {
    borderTop: "1px solid var(--color-use--border-emphasis-hex)",
    borderTopLeftRadius: "6px",
    borderTopRightRadius: "6px",
    paddingTop: "10px",
  },
  ".cm-line.cm-md-codeblock-last": {
    borderBottom: "1px solid var(--color-use--border-emphasis-hex)",
    borderBottomLeftRadius: "6px",
    borderBottomRightRadius: "6px",
    paddingBottom: "10px",
  },
  ".cm-line.cm-md-codeblock-header": {
    borderTop: "1px solid var(--color-use--border-emphasis-hex)",
    borderTopLeftRadius: "6px",
    borderTopRightRadius: "6px",
    borderBottom: "1px solid var(--color-use--border-prime-hex)",
    paddingTop: "6px",
    paddingBottom: "6px",
    backgroundColor: "var(--color-use--bg-secondary-hex)",
  },
  ".cm-md-codeblock-header-row": {
    display: "inline-flex",
    justifyContent: "flex-end",
    alignItems: "center",
    width: "100%",
    minHeight: "1.2em",
    verticalAlign: "middle",
    pointerEvents: "none",
  },
  ".cm-md-codeblock-lang": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.75em",
    lineHeight: "1.2",
    letterSpacing: "0.02em",
    textTransform: "lowercase",
    color: "var(--color-use--text-secondary)",
    userSelect: "none",
  },
  // Zero-width caret buffers around widgets must not consume a line of height.
  ".cm-md-codeblock-header .cm-widgetBuffer": {
    display: "inline",
    width: "0",
    height: "0",
    lineHeight: "0",
    fontSize: "0",
    overflow: "hidden",
  },
  ".cm-line.cm-md-codeblock-fence-collapsed": {
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

type FenceBounds = {
  from: number;
  to: number;
  /** First line that should count as the block edge for ↑ (skips lang header). */
  firstNavLine: number;
  /** Last line that should count as the block edge for ↓ (skips collapsed footer). */
  lastNavLine: number;
  /** Closing fence line number — used to jump *below* the whole block. */
  fenceEndLine: number;
};

function closedFencedCodeBounds(
  state: EditorView["state"],
  pos: number,
  active: boolean,
): FenceBounds | null {
  const tree = syntaxTree(state);
  let found: SyntaxNode | null = null;
  for (
    let node: SyntaxNode | null = tree.resolveInner(pos, -1);
    node;
    node = node.parent
  ) {
    if (node.name === "FencedCode") {
      found = node;
      break;
    }
  }
  if (!found || !isClosedFencedCode({ node: found })) return null;

  let codeText: { from: number; to: number } | null = null;
  for (let c = found.firstChild; c; c = c.nextSibling) {
    if (c.name === "CodeText") codeText = { from: c.from, to: c.to };
  }
  const fenceStart = state.doc.lineAt(found.from);
  const fenceEnd = state.doc.lineAt(Math.max(found.from, found.to - 1));
  const bodyFrom = codeText?.from ?? found.from;
  const bodyTo = codeText?.to ?? found.to;
  const bodyStart = state.doc.lineAt(bodyFrom);
  const bodyEnd = state.doc.lineAt(Math.max(bodyFrom, bodyTo - 1));
  const hasHeader = fenceStart.number < bodyStart.number;
  const hasFooter = fenceEnd.number > bodyEnd.number;
  // Idle: lang header + zero-height footer are chrome, not content — one more
  // ↑/↓ from the body edge should leave the block.
  const firstNavLine =
    !active && hasHeader ? bodyStart.number : fenceStart.number;
  const lastNavLine =
    !active && hasFooter ? bodyEnd.number : fenceEnd.number;

  return {
    from: found.from,
    to: found.to,
    firstNavLine,
    lastNavLine,
    fenceEndLine: fenceEnd.number,
  };
}

function moveParentCaret(view: EditorView, pos: number, assoc: -1 | 1 = -1): boolean {
  view.dispatch({
    selection: EditorSelection.cursor(pos, assoc),
    scrollIntoView: true,
  });
  return true;
}

/** `FencedCode.to` is end of the closing ``` line — next content starts on the following line. */
function caretBelowFence(view: EditorView, edge: FenceBounds): boolean {
  const doc = view.state.doc;
  if (edge.fenceEndLine >= doc.lines) return false;
  return moveParentCaret(view, doc.line(edge.fenceEndLine + 1).from, -1);
}

/**
 * Same-doc fence chrome still traps ↑/↓ at the first/last line (and ↓ onto a
 * zero-height collapsed footer). Exit past the whole FencedCode on the edge.
 */
function createCodeblockBoundaryExitKeymap(): Extension {
  const nodeActiveAt = (view: EditorView, head: number): boolean => {
    const probe = closedFencedCodeBounds(view.state, head, true);
    if (!probe) return false;
    const sel = view.state.selection.main;
    return (
      view.hasFocus &&
      selectionOverlaps(probe.from, probe.to, sel.from, sel.to)
    );
  };

  return Prec.high(
    keymap.of([
      {
        key: "ArrowUp",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) return false;
          const edge = closedFencedCodeBounds(
            view.state,
            sel.head,
            nodeActiveAt(view, sel.head),
          );
          if (!edge) return false;
          if (view.state.doc.lineAt(sel.head).number !== edge.firstNavLine) {
            return false;
          }
          if (edge.from <= 0) return false;
          const prev = view.state.doc.lineAt(edge.from - 1);
          return moveParentCaret(view, prev.to, 1);
        },
      },
      {
        key: "ArrowDown",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) return false;
          const edge = closedFencedCodeBounds(
            view.state,
            sel.head,
            nodeActiveAt(view, sel.head),
          );
          if (!edge) return false;
          if (view.state.doc.lineAt(sel.head).number !== edge.lastNavLine) {
            return false;
          }
          return caretBelowFence(view, edge);
        },
      },
      {
        key: "ArrowLeft",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) return false;
          const active = nodeActiveAt(view, sel.head);
          const edge = closedFencedCodeBounds(view.state, sel.head, active);
          if (!edge) return false;
          const line = view.state.doc.lineAt(sel.head);
          // Doc start of the fence, or start of the ↑-edge line while idle.
          const atEdge =
            sel.head === edge.from ||
            (line.number === edge.firstNavLine && sel.head === line.from);
          if (!atEdge) return false;
          if (edge.from <= 0) return false;
          return moveParentCaret(view, edge.from - 1, 1);
        },
      },
      {
        key: "ArrowRight",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) return false;
          const active = nodeActiveAt(view, sel.head);
          const edge = closedFencedCodeBounds(view.state, sel.head, active);
          if (!edge) return false;
          const line = view.state.doc.lineAt(sel.head);
          const atEdge =
            sel.head === edge.to ||
            (line.number === edge.lastNavLine && sel.head === line.to);
          if (!atEdge) return false;
          return caretBelowFence(view, edge);
        },
      },
    ]),
  );
}

/** Live fenced-code chrome: traditional boxed layout + lang header. */
export function createCodeblockLiveExtensions(): Extension[] {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildCodeblockDecorations(view);
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.selectionSet ||
            update.focusChanged ||
            syntaxTree(update.state) !== syntaxTree(update.startState)
          ) {
            this.decorations = buildCodeblockDecorations(update.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
    createCodeblockBoundaryExitKeymap(),
    codeblockTheme,
  ];
}
