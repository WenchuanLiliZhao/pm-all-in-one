// ↔ ./index.ts — createLinkLiveExtensions re-exported for element registry
// ↔ ./preview.tsx — Reading View twin (a)
// ↔ ../../extensions/live-ownership.ts — LinkMark/URL under Link|Autolink owned here
// ↔ ../../extensions/live-preview.ts — skips Link/Autolink/URL constructs
// ↔ AGENTS.md — Live links checklist (hide [](); caret reveals)

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
const linkStyle = Decoration.mark({ class: "cm-md-link" });

type DecSpec = { from: number; to: number; deco: Decoration };

function selectionOverlaps(
  from: number,
  to: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= to && selTo >= from;
}

function hideLinkChrome(
  specs: DecSpec[],
  link: SyntaxNode,
  doc: { sliceString: (from: number, to: number) => string },
  keepUrl: boolean,
) {
  let pos = link.from;
  for (let child = link.firstChild; child; child = child.nextSibling) {
    if (child.from > pos) {
      const gap = doc.sliceString(pos, child.from);
      // Drop delimiter glue between label and URL (`](`) and similar.
      if (/^[[\]()!]*$/.test(gap)) {
        specs.push({ from: pos, to: child.from, deco: hide });
      } else {
        specs.push({ from: pos, to: child.from, deco: linkStyle });
      }
    }
    if (child.name === "LinkMark") {
      specs.push({ from: child.from, to: child.to, deco: hide });
    } else if (child.name === "URL") {
      if (keepUrl) {
        specs.push({ from: child.from, to: child.to, deco: linkStyle });
      } else {
        specs.push({ from: child.from, to: child.to, deco: hide });
      }
    } else {
      // Label content (may nest strong/em — leave for orchestrator marks).
      specs.push({ from: child.from, to: child.to, deco: linkStyle });
    }
    pos = child.to;
  }
  if (pos < link.to) {
    const gap = doc.sliceString(pos, link.to);
    if (/^[[\]()!]*$/.test(gap)) {
      specs.push({ from: pos, to: link.to, deco: hide });
    } else {
      specs.push({ from: pos, to: link.to, deco: linkStyle });
    }
  }
}

function buildLinkDecorations(view: EditorView): DecorationSet {
  const specs: DecSpec[] = [];
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
        if (node.name === "Link" || node.name === "Autolink") {
          const active = selectionOverlaps(node.from, node.to, selFrom, selTo);
          if (active) return;
          // Autolink has no separate label — keep the URL visible, hide `<>`.
          hideLinkChrome(specs, node.node, doc, node.name === "Autolink");
          return false;
        }

        // Bare URL (not already handled as Link/Autolink/Image child).
        if (node.name === "URL") {
          const parent = node.node.parent;
          if (
            parent &&
            (parent.name === "Link" ||
              parent.name === "Autolink" ||
              parent.name === "Image")
          ) {
            return;
          }
          const active = selectionOverlaps(node.from, node.to, selFrom, selTo);
          if (!active) {
            specs.push({ from: node.from, to: node.to, deco: linkStyle });
          }
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

const linkTheme = EditorView.baseTheme({
  ".cm-md-link": { color: "var(--color-use--accent-text)" },
});

/** Live link chrome: hide []() / <> when inactive; style label / bare URL. */
export function createLinkLiveExtensions(): Extension[] {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildLinkDecorations(view);
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.selectionSet ||
            update.focusChanged ||
            syntaxTree(update.state) !== syntaxTree(update.startState)
          ) {
            this.decorations = buildLinkDecorations(update.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
    linkTheme,
  ];
}
