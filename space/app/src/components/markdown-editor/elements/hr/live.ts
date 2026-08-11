// ↔ ./index.ts — createHrLiveExtensions
// ↔ ./preview.tsx — Reading View twin
// ↔ AGENTS.md — Live hr checklist

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

type DecSpec = { from: number; to: number; deco: Decoration };

function selectionOverlaps(
  from: number,
  to: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= to && selTo >= from;
}

class HrWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const hr = document.createElement("hr");
    hr.className = "cm-md-hr";
    hr.setAttribute("aria-hidden", "true");
    return hr;
  }

  ignoreEvent() {
    return false;
  }
}

function buildHrDecorations(view: EditorView): DecorationSet {
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
        if (node.name !== "HorizontalRule") return;
        const active = selectionOverlaps(node.from, node.to, selFrom, selTo);
        if (active) return;
        // Replace rule text only (no newlines — ViewPlugin-safe).
        specs.push({
          from: node.from,
          to: node.to,
          deco: Decoration.replace({ widget: new HrWidget() }),
        });
      },
    });
  }

  specs.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    specs.map((s) => s.deco.range(s.from, s.to)),
    true,
  );
}

const hrTheme = EditorView.baseTheme({
  ".cm-md-hr": {
    display: "block",
    border: "none",
    borderTop: "1px solid var(--color-use--border-prime-hex)",
    margin: "0.65em 0",
    width: "100%",
  },
});

/** Live HR: soft rule widget when inactive; caret reveals --- / ***. */
export function createHrLiveExtensions(): Extension[] {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildHrDecorations(view);
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.selectionSet ||
            update.focusChanged ||
            syntaxTree(update.state) !== syntaxTree(update.startState)
          ) {
            this.decorations = buildHrDecorations(update.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
    hrTheme,
  ];
}
