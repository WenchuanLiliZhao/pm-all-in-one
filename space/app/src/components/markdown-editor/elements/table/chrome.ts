// ↔ ./index.ts — createTableLiveExtensions → createTableChromeExtensions
// ↔ ./inline-html.ts — idle HTML cell projection
// ↔ ./model.ts — parseTable / align for idle HTML
// ↔ AGENTS.md — idle projection; selection into table clears decoration
//
// Sections: host pin/HTML → TableHostWidget → block decorations → enter keymap
// → createTableChromeExtensions.

import { syntaxTree } from "@codemirror/language";
import {
  EditorSelection,
  Prec,
  StateField,
  type EditorState as CMState,
  type Extension,
} from "@codemirror/state";
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
import { renderInlineHtml } from "./inline-html";
import {
  alignOf,
  parseSeparatorAligns,
  parseTable,
  type TableModel,
  type TableRowRef,
} from "./model";

type DecSpec = { from: number; to: number; deco: Decoration };

function hostWidthPx(view: EditorView): number {
  const scroller = view.scrollDOM;
  const cs = getComputedStyle(scroller);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  // Pin to the scroller's content box (clientWidth includes padding) so the
  // host never inherits a box previously stretched by wide lines.
  return Math.max(80, Math.floor(scroller.clientWidth - padL - padR));
}

function pinHostWidth(host: HTMLElement, view: EditorView) {
  const w = hostWidthPx(view);
  host.style.width = `${w}px`;
  host.style.maxWidth = `${w}px`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tableCellNodeAt(
  state: CMState,
  from: number,
  to: number,
): SyntaxNode | null {
  let found: SyntaxNode | null = null;
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (node.name === "TableCell" && node.from >= from && node.to <= to) {
        found = node.node;
        return false;
      }
    },
  });
  return found;
}

function rowCellsHtml(
  state: CMState,
  row: TableRowRef,
  tag: "th" | "td",
  colCount: number,
  aligns: ("left" | "center" | "right")[],
  rowIndex: number,
): string {
  // Use model cells (pipe-slot mapped). Lezer skips empty TableCell nodes, so
  // walking only TableCell children would collapse `| | s |` into one column.
  return Array.from({ length: colCount }, (_, ci) => {
    const cell = row.cells[ci];
    let html = "";
    if (cell && cell.text.trim().length > 0) {
      const node = tableCellNodeAt(state, cell.from, cell.to);
      html = node
        ? renderInlineHtml(state, node).trim()
        : escapeHtml(cell.text.trim());
    }
    // Empty cells must keep a column box — bare <td></td> collapses to ~0 width.
    const body = html.length > 0 ? html : "&nbsp;";
    return `<${tag} data-row="${rowIndex}" data-col="${ci}" style="text-align:${aligns[ci] ?? "left"}">${body}</${tag}>`;
  }).join("");
}

function tableWidgetHtml(state: CMState, model: TableModel): string {
  const aligns = parseSeparatorAligns(model.separator.text, model.colCount).map(
    alignOf,
  );
  const head = rowCellsHtml(state, model.header, "th", model.colCount, aligns, 0);
  const bodyRows = model.body.map(
    (row, i) =>
      `<tr>${rowCellsHtml(state, row, "td", model.colCount, aligns, i + 1)}</tr>`,
  );
  return `<table><thead><tr>${head}</tr></thead><tbody>${bodyRows.join("")}</tbody></table>`;
}

/** Resolve click target → parent caret; fall back to table start. */
function cellAnchorFromClick(
  state: CMState,
  tableFrom: number,
  tableTo: number,
  target: EventTarget | null,
): number {
  const el = (target as HTMLElement | null)?.closest?.(
    "th, td",
  ) as HTMLElement | null;
  const row =
    el?.dataset.row != null ? Number(el.dataset.row) : Number.NaN;
  const col =
    el?.dataset.col != null ? Number(el.dataset.col) : Number.NaN;
  if (!Number.isFinite(row) || !Number.isFinite(col)) return tableFrom;

  let tableNode: SyntaxNode | null = null;
  syntaxTree(state).iterate({
    from: tableFrom,
    to: Math.min(tableTo, state.doc.length),
    enter: (node) => {
      if (node.name === "Table" && node.from === tableFrom) {
        tableNode = node.node;
        return false;
      }
    },
  });
  if (!tableNode) return tableFrom;
  const model = parseTable(state, tableNode);
  if (!model) return tableFrom;
  if (row === 0) {
    return model.header.cells[col]?.from ?? tableFrom;
  }
  const bodyRow = model.body[row - 1];
  return bodyRow?.cells[col]?.from ?? tableFrom;
}

/**
 * Idle-only block host: pinned-width overflow-x + HTML projection.
 * Selection into the table range clears the decoration (parent CM shows pipe).
 */
class TableHostWidget extends WidgetType {
  constructor(
    readonly tableFrom: number,
    readonly tableTo: number,
    readonly html: string,
  ) {
    super();
  }

  eq(other: TableHostWidget) {
    return (
      this.tableFrom === other.tableFrom &&
      this.tableTo === other.tableTo &&
      this.html === other.html
    );
  }

  toDOM(view: EditorView) {
    const host = document.createElement("div");
    host.className = "cm-md-table-host";
    host.dataset.tableFrom = String(this.tableFrom);
    host.title = "Click to edit table";

    const inner = document.createElement("div");
    inner.className = "cm-md-table-host-inner";
    host.appendChild(inner);
    pinHostWidth(host, view);
    inner.innerHTML = this.html;

    host.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const anchor = cellAnchorFromClick(
        view.state,
        this.tableFrom,
        this.tableTo,
        event.target,
      );
      view.dispatch({
        selection: EditorSelection.cursor(anchor),
        scrollIntoView: true,
      });
      view.focus();
    });

    return host;
  }

  updateDOM(dom: HTMLElement, view: EditorView) {
    pinHostWidth(dom, view);
    dom.dataset.tableFrom = String(this.tableFrom);
    const inner = dom.querySelector(".cm-md-table-host-inner");
    if (!(inner instanceof HTMLElement)) return false;
    inner.innerHTML = this.html;
    return true;
  }

  ignoreEvent() {
    return true;
  }
}

/**
 * True when the caret/selection is inside the table **or** on the line
 * immediately above / below it — those adjacent lines also reveal pipe source
 * so ↑/↓ into the table is not fighting a still-mounted block widget.
 */
function selectionActivatesTable(
  state: CMState,
  tableFrom: number,
  tableTo: number,
): boolean {
  const sel = state.selection.main;
  if (sel.from <= tableTo && sel.to >= tableFrom) return true;
  if (posOnAdjacentLine(state, sel.head, tableFrom, tableTo)) return true;
  if (!sel.empty && posOnAdjacentLine(state, sel.anchor, tableFrom, tableTo)) {
    return true;
  }
  return false;
}

function posOnAdjacentLine(
  state: CMState,
  pos: number,
  tableFrom: number,
  tableTo: number,
): boolean {
  const line = state.doc.lineAt(pos);
  // Line immediately above: next line starts at tableFrom
  if (tableFrom > 0 && line.to + 1 === tableFrom) return true;
  // Line immediately below: previous line ends at tableTo (or tableTo is exclusive EOL)
  if (tableTo === line.from - 1 || tableTo === line.from) return true;
  return false;
}

/**
 * Block widgets must come from a StateField —
 * CM throws "Block decorations may not be specified via plugins".
 * Idle tables → HTML host; selection in table or on adjacent line → no decoration.
 */
function buildBlockWidgets(state: CMState): DecorationSet {
  const specs: DecSpec[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "Table") return;
      // Active: inside table or on the neighboring line → skip (parent shows pipe).
      if (selectionActivatesTable(state, node.from, node.to)) return false;
      const model = parseTable(state, node.node);
      if (!model) return false;
      specs.push({
        from: node.from,
        to: node.to,
        deco: Decoration.replace({
          widget: new TableHostWidget(
            node.from,
            node.to,
            tableWidgetHtml(state, model),
          ),
          block: true,
        }),
      });
      return false;
    },
  });

  specs.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    specs.map((s) => s.deco.range(s.from, s.to)),
    true,
  );
}

const tableBlockField = StateField.define<DecorationSet>({
  create(state) {
    return buildBlockWidgets(state);
  },
  update(_deco, tr) {
    if (
      tr.docChanged ||
      syntaxTree(tr.state) !== syntaxTree(tr.startState) ||
      tr.selection
    ) {
      return buildBlockWidgets(tr.state);
    }
    return _deco;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Re-pin host widths when the parent editor geometry changes. */
const tableHostMeasure = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (!update.geometryChanged && !update.viewportChanged) return;
      const w = hostWidthPx(update.view);
      update.view.dom
        .querySelectorAll<HTMLElement>(".cm-md-table-host")
        .forEach((el) => {
          el.style.width = `${w}px`;
          el.style.maxWidth = `${w}px`;
        });
    }
  },
);

const tableChromeTheme = EditorView.baseTheme({
  ".cm-md-table-host": {
    display: "block",
    // Padding (not margin) so flush adjacent lines map cleanly for ↑/↓ enter.
    padding: "0.65em 0",
    margin: "0",
    overflowX: "auto",
    overscrollBehaviorX: "contain",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  ".cm-md-table-host-inner": {
    display: "block",
    width: "max-content",
    minWidth: "100%",
    padding: "2px 0",
  },
  ".cm-md-table-host table": {
    borderCollapse: "collapse",
    fontSize: "13px",
    width: "max-content",
    maxWidth: "none",
    color: "var(--color-use--text-prime)",
  },
  ".cm-md-table-host th, .cm-md-table-host td": {
    border: "1px solid var(--color-use--border-emphasis-hex)",
    padding: "6px 10px",
    textAlign: "left",
    verticalAlign: "top",
    fontSize: "13px",
    lineHeight: "1.5",
    emptyCells: "show",
    minWidth: "1.75em",
  },
  ".cm-md-table-host th": {
    fontWeight: "650",
    backgroundColor: "var(--color-use--bg-darken)",
  },
  ".cm-md-table-host strong": { fontWeight: "700" },
  ".cm-md-table-host em": { fontStyle: "italic" },
  ".cm-md-table-host del": {
    textDecoration: "line-through",
    color: "var(--color-use--text-secondary)",
  },
  ".cm-md-table-host code": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.92em",
    backgroundColor: "var(--color-use--bg-darken)",
    borderRadius: "3px",
    padding: "1px 4px",
  },
  ".cm-md-table-host a": { color: "var(--color-use--accent-text)" },
});

type TableRange = { from: number; to: number };

function listTableRanges(state: CMState): TableRange[] {
  const out: TableRange[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "Table") return;
      if (!parseTable(state, node.node)) return false;
      out.push({ from: node.from, to: node.to });
      return false;
    },
  });
  return out;
}

/** Next line after `head`'s line starts a GFM table. */
function tableJustBelow(state: CMState, head: number): TableRange | null {
  const line = state.doc.lineAt(head);
  if (line.to >= state.doc.length) return null;
  const nextFrom = line.to + 1;
  for (const t of listTableRanges(state)) {
    if (t.from === nextFrom) return t;
  }
  return null;
}

/** Previous line before `head`'s line ends a GFM table. */
function tableJustAbove(state: CMState, head: number): TableRange | null {
  const line = state.doc.lineAt(head);
  if (line.from <= 0) return null;
  const prevTo = line.from - 1;
  for (const t of listTableRanges(state)) {
    // `to` may be EOL of last row (prevTo) or exclusive past its trailing newline (line.from).
    if (t.to === prevTo || t.to === line.from) return t;
  }
  return null;
}

/**
 * Place caret inside the table so the idle block decoration clears.
 * Default CM ↑/↓ skips block widgets entirely — without this, adjacent lines
 * hop from below the table to above (and vice versa) and never enter.
 */
function enterTable(
  view: EditorView,
  table: TableRange,
  where: "start" | "end",
): boolean {
  const pos =
    where === "start"
      ? table.from
      : Math.max(table.from, table.to - 1);
  view.dispatch({
    selection: EditorSelection.cursor(pos),
    scrollIntoView: true,
  });
  return true;
}

/**
 * Intercept arrows on the line immediately before/after an idle table host
 * and land the caret inside the table range (expands to pipe text).
 */
function createTableEnterKeymap(): Extension {
  return Prec.high(
    keymap.of([
      {
        key: "ArrowDown",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) return false;
          const t = tableJustBelow(view.state, sel.head);
          if (!t) return false;
          return enterTable(view, t, "start");
        },
      },
      {
        key: "ArrowUp",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) return false;
          const t = tableJustAbove(view.state, sel.head);
          if (!t) return false;
          return enterTable(view, t, "end");
        },
      },
      {
        key: "ArrowRight",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) return false;
          const line = view.state.doc.lineAt(sel.head);
          if (sel.head !== line.to) return false;
          const t = tableJustBelow(view.state, sel.head);
          if (!t) return false;
          return enterTable(view, t, "start");
        },
      },
      {
        key: "ArrowLeft",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) return false;
          const line = view.state.doc.lineAt(sel.head);
          if (sel.head !== line.from) return false;
          const t = tableJustAbove(view.state, sel.head);
          if (!t) return false;
          return enterTable(view, t, "end");
        },
      },
    ]),
  );
}

/** Parent Live chrome: idle HTML hosts; arrows enter table → pipe edit. */
export function createTableChromeExtensions(): Extension[] {
  return [
    tableBlockField,
    tableHostMeasure,
    createTableEnterKeymap(),
    tableChromeTheme,
  ];
}
