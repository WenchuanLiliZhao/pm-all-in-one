// ↔ ./index.ts — createImageLiveExtensions
// ↔ ./preview.tsx — Reading View twin
// ↔ ../../extensions/live-ownership.ts — Image LinkMark/URL owned here
// ↔ AGENTS.md — Live image checklist

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

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-md-image";
    const img = document.createElement("img");
    img.className = "cm-md-image-el";
    img.src = this.src;
    img.alt = this.alt;
    img.loading = "lazy";
    img.addEventListener("error", () => {
      wrap.classList.add("cm-md-image-broken");
      img.remove();
      const stub = document.createElement("span");
      stub.className = "cm-md-image-stub";
      stub.textContent = this.alt || "broken image";
      wrap.appendChild(stub);
    });
    wrap.appendChild(img);
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

function imageAltAndSrc(
  view: EditorView,
  node: { node: { firstChild: { name: string; from: number; to: number; nextSibling: unknown } | null }; from: number; to: number },
): { alt: string; src: string } {
  let src = "";
  let alt = "";
  let pos = node.from;
  for (
    let c: { name: string; from: number; to: number; nextSibling: unknown } | null =
      node.node.firstChild;
    c;
    c = c.nextSibling as typeof c
  ) {
    if (c.name === "URL") {
      src = view.state.doc.sliceString(c.from, c.to);
    } else if (c.name !== "LinkMark") {
      if (c.from > pos) {
        const gap = view.state.doc.sliceString(pos, c.from);
        if (!/^[[\]()!]*$/.test(gap)) alt += gap;
      }
      alt += view.state.doc.sliceString(c.from, c.to);
    } else if (c.from > pos) {
      const gap = view.state.doc.sliceString(pos, c.from);
      if (!/^[[\]()!]*$/.test(gap)) alt += gap;
    }
    pos = c.to;
  }
  // Strip leading `!` glue if present in alt.
  alt = alt.replace(/^!/, "").trim();
  return { alt, src };
}

function buildImageDecorations(view: EditorView): DecorationSet {
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
        if (node.name !== "Image") return;
        const active = selectionOverlaps(node.from, node.to, selFrom, selTo);
        if (active) return;
        const { alt, src } = imageAltAndSrc(view, node);
        specs.push({
          from: node.from,
          to: node.to,
          deco: Decoration.replace({
            widget: new ImageWidget(src, alt || "image"),
          }),
        });
        return false;
      },
    });
  }

  specs.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    specs.map((s) => s.deco.range(s.from, s.to)),
    true,
  );
}

const imageTheme = EditorView.baseTheme({
  ".cm-md-image": {
    display: "inline-block",
    maxWidth: "100%",
    verticalAlign: "middle",
  },
  ".cm-md-image-el": {
    display: "block",
    maxWidth: "100%",
    maxHeight: "240px",
    objectFit: "contain",
    borderRadius: "4px",
  },
  ".cm-md-image-stub": {
    display: "inline-block",
    padding: "4px 8px",
    backgroundColor: "var(--color-use--bg-darken)",
    color: "var(--color-use--text-secondary)",
    borderRadius: "4px",
    fontSize: "0.9em",
  },
});

/** Live image: idle widget / broken stub; caret reveals ![alt](url). */
export function createImageLiveExtensions(): Extension[] {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildImageDecorations(view);
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.selectionSet ||
            update.focusChanged ||
            syntaxTree(update.state) !== syntaxTree(update.startState)
          ) {
            this.decorations = buildImageDecorations(update.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
    imageTheme,
  ];
}
