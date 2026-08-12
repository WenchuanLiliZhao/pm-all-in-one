// ↔ ./index.ts — createImageLiveExtensions
// ↔ ./preview.tsx — Reading View twin
// ↔ ../../local-media.ts — figure / card / facet
// ↔ ../../inline-fragment.ts — caption HTML (shared seam)
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
import {
  createAttachmentCardEl,
  createFigureEl,
  isEmbeddableImageUrl,
  localMediaFacet,
  mediaThemeSpec,
} from "../../local-media";

type DecSpec = { from: number; to: number; deco: Decoration };

function selectionOverlaps(
  from: number,
  to: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= to && selTo >= from;
}

class MediaWidget extends WidgetType {
  constructor(
    readonly sotSrc: string,
    readonly resolvedSrc: string,
    readonly caption: string,
    readonly mode: "figure" | "card",
  ) {
    super();
  }

  eq(other: MediaWidget) {
    return (
      other.sotSrc === this.sotSrc &&
      other.resolvedSrc === this.resolvedSrc &&
      other.caption === this.caption &&
      other.mode === this.mode
    );
  }

  toDOM() {
    if (this.mode === "card") {
      return createAttachmentCardEl(this.sotSrc, this.caption);
    }
    return createFigureEl(this.resolvedSrc, this.sotSrc, this.caption);
  }

  ignoreEvent() {
    return false;
  }
}

function imageAltAndSrc(
  view: EditorView,
  node: {
    node: {
      firstChild: {
        name: string;
        from: number;
        to: number;
        nextSibling: unknown;
      } | null;
    };
    from: number;
    to: number;
  },
): { alt: string; src: string } {
  let src = "";
  let alt = "";
  let pos = node.from;
  for (
    let c: {
      name: string;
      from: number;
      to: number;
      nextSibling: unknown;
    } | null = node.node.firstChild;
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
  alt = alt.replace(/^!/, "").trim();
  return { alt, src };
}

function buildImageDecorations(view: EditorView): DecorationSet {
  const specs: DecSpec[] = [];
  const focused = view.hasFocus;
  const sel = view.state.selection.main;
  const selFrom = focused ? sel.from : -1;
  const selTo = focused ? sel.to : -1;
  const media = view.state.facet(localMediaFacet);

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== "Image") return;
        const active = selectionOverlaps(node.from, node.to, selFrom, selTo);
        if (active) return;
        const { alt, src } = imageAltAndSrc(view, node);
        if (!src) return;
        const resolved = media.resolveMediaUrl?.(src) ?? src;
        const finalMode: "figure" | "card" = isEmbeddableImageUrl(src)
          ? "figure"
          : "card";
        specs.push({
          from: node.from,
          to: node.to,
          deco: Decoration.replace({
            widget: new MediaWidget(src, resolved, alt, finalMode),
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

/** Live image: idle figure or attachment card; caret reveals ![alt](url). */
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
    EditorView.baseTheme(mediaThemeSpec()),
  ];
}
