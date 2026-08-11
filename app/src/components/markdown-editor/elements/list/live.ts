// ↔ ./index.ts — createListLiveExtensions re-exported for element registry
// ↔ ./preview.tsx — Reading View twin (ul/ol/li)
// ↔ ../../extensions/live-preview.ts — orchestrator does not own ListMark
// ↔ AGENTS.md — Live lists checklist (hide ListMark; task checkboxes; caret reveals)

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

/** Idle marker: bullet glyph or ordinal text. SoT stays the raw ListMark. */
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
    span.textContent = this.label;
    span.setAttribute("aria-hidden", "true");
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
  const focused = view.hasFocus;
  const sel = view.state.selection.main;
  const selFrom = focused ? sel.from : -1;
  const selTo = focused ? sel.to : -1;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
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
            : "•";

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

  specs.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    specs.map((s) => s.deco.range(s.from, s.to)),
    true,
  );
}

const listTheme = EditorView.baseTheme({
  ".cm-md-list-mark": {
    display: "inline-block",
    color: "var(--color-use--text-secondary)",
    userSelect: "none",
  },
  ".cm-md-list-mark-bullet": {
    minWidth: "1.2em",
    textAlign: "center",
    marginRight: "0.35em",
  },
  ".cm-md-list-mark-ordered": {
    minWidth: "1.4em",
    textAlign: "right",
    marginRight: "0.45em",
    fontVariantNumeric: "tabular-nums",
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
