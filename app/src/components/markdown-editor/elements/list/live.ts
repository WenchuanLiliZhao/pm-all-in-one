// ↔ ./index.ts — createListLiveExtensions re-exported for element registry
// ↔ ./preview.tsx — Reading View twin (ul/ol/li)
// ↔ ../../extensions/live-preview.ts — orchestrator does not own ListMark
// ↔ AGENTS.md — Live lists checklist (hide ListMark; hang soft-wrap; task checkboxes; caret reveals)

import { syntaxTree } from "@codemirror/language";
import {
  EditorState,
  Transaction,
  type ChangeSpec,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

const hide = Decoration.replace({});

type DecSpec = { from: number; to: number; deco: Decoration };

function selectionOverlaps(
  from: number,
  to: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= to && selTo >= from;
}

function listItemHasTask(item: SyntaxNode): boolean {
  for (let c = item.firstChild; c; c = c.nextSibling) {
    if (c.name === "Task" || c.name === "TaskMarker") return true;
    // Task is sometimes nested one level deeper depending on leaf packing.
    for (let gc = c.firstChild; gc; gc = gc.nextSibling) {
      if (gc.name === "Task" || gc.name === "TaskMarker") return true;
    }
  }
  return false;
}

function enclosingListItem(node: SyntaxNode): SyntaxNode | null {
  for (let p: SyntaxNode | null = node; p; p = p.parent) {
    if (p.name === "ListItem") return p;
  }
  return null;
}

/** 1-based index of `item` among OrderedList / BulletList siblings. */
function listItemIndex(item: SyntaxNode): number {
  const list = item.parent;
  if (!list) return 1;
  let i = 0;
  for (let c = list.firstChild; c; c = c.nextSibling) {
    if (c.name !== "ListItem") continue;
    i += 1;
    if (c.from === item.from) return i;
  }
  return 1;
}

/**
 * Live ordinal from sibling position (1-based), not raw SoT digits.
 * Safety net when SoT lags (e.g. typed spaces instead of indent command):
 * after Enter→renumber then nest, SoT may be `2.` nested + `3.` outer while
 * Live should read `1.` / `2.`. Delimiter `.` / `)` comes from the ListMark.
 */
function orderedMarkerLabel(item: SyntaxNode, markText: string): string {
  const delim = /[.)]/.exec(markText)?.[0] ?? ".";
  const list = item.parent;
  if (!list || list.name !== "OrderedList") return markText;
  return `${listItemIndex(item)}${delim}`;
}

/**
 * Rewrite OrderedList marks that overlap `ranges` to 1..n sibling order.
 * Used after indent/dedent so CM Enter's renumber doesn't leave a nested `2.`
 * and an outer `3.` when the new item was indented under the previous item.
 */
function renumberOrderedListsTouching(
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
): ChangeSpec[] {
  if (!ranges.length) return [];
  const changes: ChangeSpec[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "OrderedList") return;
      const overlaps = ranges.some(
        (r) => r.from <= node.to && r.to >= node.from,
      );
      if (!overlaps) return;
      let i = 0;
      for (let c = node.node.firstChild; c; c = c.nextSibling) {
        if (c.name !== "ListItem") continue;
        i += 1;
        const head = state.doc.sliceString(
          c.from,
          Math.min(c.from + 14, c.to),
        );
        const m = /^(\s*)(\d+)(?=[.)])/.exec(head);
        if (!m) continue;
        const from = c.from + m[1].length;
        const to = from + m[2].length;
        const next = String(i);
        if (m[2] !== next) changes.push({ from, to, insert: next });
      }
    },
  });
  return changes;
}

/**
 * After indent/dedent, fix ordered marks in lists that the change touched.
 * (transactionExtender cannot add doc changes — must use transactionFilter.)
 */
const orderedListIndentRenumber = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  const ev = tr.annotation(Transaction.userEvent);
  if (ev !== "input.indent" && ev !== "delete.dedent") return tr;
  const ranges: { from: number; to: number }[] = [];
  tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    // Indent only inserts leading spaces; expand to the whole line so a newly
    // nested OrderedList (marker after the spaces) still counts as touched.
    const start = tr.newDoc.lineAt(fromB).from;
    const endAt = Math.max(fromB, toB > fromB ? toB - 1 : toB);
    const end = tr.newDoc.lineAt(endAt).to;
    ranges.push({ from: start, to: end });
  });
  const changes = renumberOrderedListsTouching(tr.state, ranges);
  if (!changes.length) return tr;
  // sequential: renumber coords are against the post-indent doc (tr.state).
  return [tr, { changes, sequential: true }];
});

/** Idle bullet box + gap — keep in sync with `.cm-md-list-mark-bullet`. */
const BULLET_HANG_EM = 1.65;

/**
 * Soft-wrap hang CSS length for a ListItem.
 * Must match the idle marker chrome width (not raw SoT `ch` alone) so the
 * first-line text lines up with wrapped lines — and so text-indent does not
 * pull a wide/`ch`-stretched glyph into the clip edge.
 */
function listItemHangCss(state: EditorState, item: SyntaxNode): string | null {
  const line = state.doc.lineAt(item.from);
  let mark: SyntaxNode | null = null;
  for (let c = item.firstChild; c; c = c.nextSibling) {
    if (c.name === "ListMark") {
      mark = c;
      break;
    }
  }
  if (!mark) return null;

  const leadingCh = mark.from - line.from;
  let markEnd = mark.to;
  const lineTo = line.to;
  while (markEnd < lineTo) {
    const ch = state.doc.sliceString(markEnd, markEnd + 1);
    if (ch === " " || ch === "\t") markEnd += 1;
    else break;
  }
  const markCh = markEnd - mark.from;

  const after = state.doc.sliceString(markEnd, Math.min(markEnd + 3, lineTo));
  const isTask = listItemHasTask(item) || /^\[[ xX]\]/.test(after);
  if (isTask) {
    // ListMark hidden; checkbox chrome ≈ 1.25em (see .cm-md-task-checkbox).
    return `calc(${leadingCh + markCh}ch + 1.25em)`;
  }

  if (item.parent?.name === "OrderedList") {
    // Ordinal widget tracks SoT mark columns + trailing gap in theme.
    return `calc(${leadingCh}ch + ${markCh}ch)`;
  }

  // Bullet widget is fixed-em chrome (see BULLET_HANG_EM / theme).
  return `calc(${leadingCh}ch + ${BULLET_HANG_EM}em)`;
}

/** Idle marker: bullet disc or ordinal text. SoT stays the raw ListMark. */
class ListMarkerWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly ordered: boolean,
  ) {
    super();
  }

  eq(other: ListMarkerWidget) {
    return other.label === this.label && other.ordered === this.ordered;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = this.ordered
      ? "cm-md-list-mark cm-md-list-mark-ordered"
      : "cm-md-list-mark cm-md-list-mark-bullet";
    span.setAttribute("aria-hidden", "true");
    if (this.ordered) {
      span.textContent = this.label;
    } else {
      // Explicit DOM disc — more reliable than glyphs/`::before` in CM widgets.
      const dot = document.createElement("span");
      dot.className = "cm-md-list-bullet-dot";
      span.appendChild(dot);
    }
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

/** GFM task checkbox — click toggles `[ ]` / `[x]` in SoT. */
class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }

  eq(other: TaskCheckboxWidget) {
    return (
      other.checked === this.checked &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  toDOM(view: EditorView) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "cm-md-task-checkbox";
    input.checked = this.checked;
    input.setAttribute("aria-label", this.checked ? "Done" : "Todo");
    input.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    input.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = this.checked ? "[ ]" : "[x]";
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: next },
      });
    });
    return input;
  }

  ignoreEvent() {
    return true;
  }
}

function buildListDecorations(view: EditorView): DecorationSet {
  const specs: DecSpec[] = [];
  // Innermost ListItem wins when nested items share a line range.
  const hangByLine = new Map<number, string>();
  const focused = view.hasFocus;
  const sel = view.state.selection.main;
  const selFrom = focused ? sel.from : -1;
  const selTo = focused ? sel.to : -1;
  const doc = view.state.doc;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === "ListItem") {
          const hang = listItemHangCss(view.state, node.node);
          if (hang) {
            const startLine = doc.lineAt(node.from);
            // node.to often sits on the following line break — stay on the item.
            const endLine = doc.lineAt(Math.max(node.from, node.to - 1));
            for (let n = startLine.number; n <= endLine.number; n++) {
              hangByLine.set(doc.line(n).from, hang);
            }
          }
          return;
        }

        if (node.name === "ListMark") {
          const item = node.node.parent;
          if (!item || item.name !== "ListItem") return;

          const active = selectionOverlaps(item.from, item.to, selFrom, selTo);
          if (active) return;

          let hideTo = node.to;
          const lineTo = view.state.doc.lineAt(node.from).to;
          while (hideTo < lineTo) {
            const ch = view.state.doc.sliceString(hideTo, hideTo + 1);
            if (ch === " " || ch === "\t") hideTo += 1;
            else break;
          }

          // Prefer tree Task node; also detect GFM `[ ]` / `[x]` after the mark.
          const after = view.state.doc.sliceString(hideTo, Math.min(hideTo + 3, lineTo));
          const looksLikeTask = /^\[[ xX]\]/.test(after);
          if (listItemHasTask(item) || looksLikeTask) {
            specs.push({ from: node.from, to: hideTo, deco: hide });
            return;
          }

          const list = item.parent;
          const ordered = list?.name === "OrderedList";
          const markText = view.state.doc.sliceString(node.from, node.to);
          const label = ordered
            ? orderedMarkerLabel(item, markText)
            : "";

          specs.push({
            from: node.from,
            to: hideTo,
            deco: Decoration.replace({
              widget: new ListMarkerWidget(label, ordered),
            }),
          });
          return;
        }

        if (node.name === "TaskMarker") {
          const item = enclosingListItem(node.node);
          const active = item
            ? selectionOverlaps(item.from, item.to, selFrom, selTo)
            : selectionOverlaps(node.from, node.to, selFrom, selTo);
          if (active) return;

          const raw = view.state.doc.sliceString(node.from, node.to);
          const checked = /^\[[xX]\]$/.test(raw);
          let hideTo = node.to;
          const lineTo = view.state.doc.lineAt(node.from).to;
          if (hideTo < lineTo) {
            const ch = view.state.doc.sliceString(hideTo, hideTo + 1);
            if (ch === " " || ch === "\t") hideTo += 1;
          }
          specs.push({
            from: node.from,
            to: hideTo,
            deco: Decoration.replace({
              widget: new TaskCheckboxWidget(checked, node.from, node.to),
            }),
          });
        }
      },
    });
  }

  for (const [lineFrom, hang] of hangByLine) {
    // Length only here — padding/text-indent live on `.cm-line.cm-md-list-hang`
    // (two-class) so they beat shell `.cm-line { padding: 0 }`.
    specs.push({
      from: lineFrom,
      to: lineFrom,
      deco: Decoration.line({
        class: "cm-md-list-hang",
        attributes: { style: `--cm-md-list-hang:${hang}` },
      }),
    });
  }

  specs.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    specs.map((s) => s.deco.range(s.from, s.to)),
    true,
  );
}

const listTheme = EditorView.baseTheme({
  // Must beat markdown-cm-view `.cm-line { padding: 0 }` (EditorView.theme).
  // Without padding-left, negative text-indent pulls the ordinal into the
  // scroller's overflow-x gutter — numbers look missing, bullets may still peek.
  ".cm-line.cm-md-list-hang": {
    paddingLeft: "var(--cm-md-list-hang)",
    textIndent: "calc(-1 * var(--cm-md-list-hang))",
    overflow: "visible",
  },
  ".cm-md-list-mark": {
    display: "inline-block",
    boxSizing: "border-box",
    color: "var(--color-use--text-secondary)",
    userSelect: "none",
    verticalAlign: "baseline",
    flexShrink: "0",
  },
  // Fixed em chrome — hang uses the same BULLET_HANG_EM sum.
  ".cm-md-list-mark-bullet": {
    width: "1.25em",
    marginRight: "0.4em",
    height: "1em",
    position: "relative",
    verticalAlign: "-0.15em",
  },
  ".cm-md-list-bullet-dot": {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "0.42em",
    height: "0.42em",
    marginLeft: "-0.21em",
    marginTop: "-0.15em", // optical: sit on x-height, not geometric center
    borderRadius: "50%",
    backgroundColor: "var(--color-use--text-secondary)",
  },
  ".cm-md-list-mark-ordered": {
    marginRight: "0.35em",
    minWidth: "1.6em",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    overflowWrap: "normal",
    wordBreak: "keep-all",
  },
  ".cm-md-task-checkbox": {
    margin: "0 0.45em 0 0",
    verticalAlign: "middle",
    cursor: "pointer",
  },
});

/** Live list chrome: hide ListMark; bullet/ordinal/task widgets. */
export function createListLiveExtensions(): Extension[] {
  return [
    orderedListIndentRenumber,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildListDecorations(view);
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.selectionSet ||
            update.focusChanged ||
            syntaxTree(update.state) !== syntaxTree(update.startState)
          ) {
            this.decorations = buildListDecorations(update.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
    listTheme,
  ];
}
