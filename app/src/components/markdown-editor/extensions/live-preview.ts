// ↔ ../markdown-cm-view.tsx — mounts createLivePreviewExtensions when live
// ↔ ../types.ts — MentionAutocompleteProps.onActivate → onMentionActivate
// ↔ ../elements/index.ts — createElementLiveExtensions (table/codeblock/list/…)
// ↔ ./live-ownership.ts — element-owned mark / construct skip registry
// ↔ ../elements/codeblock/live.ts — owns FencedCode CodeMarks (skip via ownership)
// ↔ ../elements/list/live.ts — owns ListMark (bullet/ordered/task widgets)
// ↔ ../elements/link/live.ts — owns Link / Autolink / bare URL
// ↔ ../transform-outside-code.ts — Reading View counterpart (skip @ in code)
// ↔ AGENTS.md — Live ≠ split-pane; SoT stays raw Markdown; @ in code stays literal
// ↔ src/lib/markdown/use-pm-mentions.ts — product onActivate → navigate

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
import { createElementLiveExtensions } from "../elements";
import type { LocalMediaOptions } from "../local-media";
import { localMediaFacet } from "../local-media";
import {
  isConstructOwnedByElement,
  isMarkOwnedByElement,
} from "./live-ownership";

const hideMark = Decoration.replace({});
const heading = (level: number) =>
  Decoration.mark({ class: `cm-md-heading cm-md-h${level}` });
const strong = Decoration.mark({ class: "cm-md-strong" });
const emphasis = Decoration.mark({ class: "cm-md-emphasis" });
const strikethrough = Decoration.mark({ class: "cm-md-strikethrough" });
const inlineCode = Decoration.mark({ class: "cm-md-inline-code" });
const mentionChip = Decoration.mark({ class: "cm-md-mention" });

type DecSpec = { from: number; to: number; deco: Decoration };

function selectionOverlaps(
  from: number,
  to: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= to && selTo >= from;
}

const MENTION_RE = /@[A-Za-z][\w:-]*/g;

/** Live chip showing a resolved title while SoT stays the raw @token. */
class MentionLabelWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly token: string,
    readonly activatable: boolean,
  ) {
    super();
  }

  eq(other: MentionLabelWidget) {
    return (
      other.label === this.label &&
      other.token === this.token &&
      other.activatable === this.activatable
    );
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = this.activatable
      ? "cm-md-mention cm-md-mention-activatable"
      : "cm-md-mention";
    span.textContent = this.label;
    span.title = this.activatable
      ? `${this.token} · ⌘/Ctrl-click to open`
      : this.token;
    span.dataset.mentionToken = this.token;
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

export type LivePreviewOptions = {
  /** When set, inactive @tokens render as this label (e.g. object title). */
  resolveMentionLabel?: (token: string) => string | undefined;
  /**
   * Cmd/Ctrl+click an `@…` mention (outside code) → full SoT token.
   * Omit to disable Live mention activation.
   */
  onMentionActivate?: (token: string) => void;
  /** Resolve / activate local `assets/…` media (product wires file:// + openPath). */
  localMedia?: LocalMediaOptions;
  /**
   * When false, skip per-element live hosts (e.g. nested table editor must not
   * re-enter `createElementLiveExtensions` or it would nest forever).
   * Default true.
   */
  elements?: boolean;
};

function codeRangesIn(view: EditorView): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
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

function inCodeRanges(
  ranges: { from: number; to: number }[],
  from: number,
  to: number,
): boolean {
  return ranges.some((r) => r.from <= from && r.to >= to);
}

/** Full `@…` token covering `pos`, or null when inside code / no hit. */
function mentionTokenAt(view: EditorView, pos: number): string | null {
  const doc = view.state.doc.toString();
  const codeRanges = codeRangesIn(view);
  for (const m of doc.matchAll(MENTION_RE)) {
    const from = m.index ?? 0;
    const to = from + m[0].length;
    if (pos < from || pos > to) continue;
    if (inCodeRanges(codeRanges, from, to)) return null;
    return m[0];
  }
  return null;
}

function isModKeyEvent(event: KeyboardEvent | MouseEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

function isModClick(event: MouseEvent): boolean {
  return isModKeyEvent(event) && event.button === 0;
}

const MOD_HELD_CLASS = "cm-mod-held";

/** Toggle editor-root class while ⌘/Ctrl is held (for hover underline affordance). */
function bindModHeldClass(view: EditorView): () => void {
  const sync = (held: boolean) => {
    view.dom.classList.toggle(MOD_HELD_CLASS, held);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Meta" || event.key === "Control" || isModKeyEvent(event)) {
      sync(true);
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    // Meta/Control keyup reports metaKey/ctrlKey as false for the released key.
    if (event.key === "Meta" || event.key === "Control") {
      sync(event.metaKey || event.ctrlKey);
      return;
    }
    if (!isModKeyEvent(event)) sync(false);
  };
  const onBlur = () => sync(false);
  const onMouseMove = (event: MouseEvent) => {
    sync(isModKeyEvent(event));
  };
  // Capture phase — Cmd may be handled before the focused contentDOM sees it.
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", onBlur);
  view.dom.addEventListener("mousemove", onMouseMove);
  view.dom.addEventListener("mouseenter", onMouseMove);
  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("blur", onBlur);
    view.dom.removeEventListener("mousemove", onMouseMove);
    view.dom.removeEventListener("mouseenter", onMouseMove);
    view.dom.classList.remove(MOD_HELD_CLASS);
  };
}

function buildDecorations(
  view: EditorView,
  resolveMentionLabel?: (token: string) => string | undefined,
  mentionActivatable = false,
): DecorationSet {
  const specs: DecSpec[] = [];
  // CM always has a selection (defaults to 0). Only reveal raw marks while
  // focused — otherwise refresh / blur would expose the first construct.
  const focused = view.hasFocus;
  const sel = view.state.selection.main;
  const selFrom = focused ? sel.from : -1;
  const selTo = focused ? sel.to : -1;
  const doc = view.state.doc.toString();
  const codeRanges = codeRangesIn(view);

  const mentionHits: { from: number; to: number; text: string }[] = [];
  for (const m of doc.matchAll(MENTION_RE)) {
    const from = m.index ?? 0;
    const to = from + m[0].length;
    if (inCodeRanges(codeRanges, from, to)) continue;
    mentionHits.push({ from, to, text: m[0] });
  }

  for (const hit of mentionHits) {
    if (selectionOverlaps(hit.from, hit.to, selFrom, selTo)) continue;
    const label = resolveMentionLabel?.(hit.text);
    if (label) {
      // Hide raw @token; show title. Source of truth stays unchanged.
      specs.push({
        from: hit.from,
        to: hit.to,
        deco: Decoration.replace({
          widget: new MentionLabelWidget(
            label,
            hit.text,
            mentionActivatable,
          ),
        }),
      });
    } else {
      const deco = mentionActivatable
        ? Decoration.mark({
            class: "cm-md-mention cm-md-mention-activatable",
            attributes: { "data-mention-token": hit.text },
          })
        : mentionChip;
      specs.push({ from: hit.from, to: hit.to, deco });
    }
  }

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;
        const active = selectionOverlaps(node.from, node.to, selFrom, selTo);

        if (
          name === "HeaderMark" ||
          name === "EmphasisMark" ||
          name === "CodeMark" ||
          name === "StrikethroughMark" ||
          name === "LinkMark"
        ) {
          const parent = node.node.parent;
          if (isMarkOwnedByElement(name, parent)) return;
          const parentActive = parent
            ? selectionOverlaps(parent.from, parent.to, selFrom, selTo)
            : false;
          // Reveal all marks of a construct when the caret is anywhere in the
          // parent (e.g. both `**` of `**s**`), not only the overlapped mark.
          const reveal = active || parentActive;
          if (!reveal) {
            let hideTo = node.to;
            // ATX requires a space after `#`; hide it so the title sits flush.
            if (name === "HeaderMark") {
              const lineTo = view.state.doc.lineAt(node.from).to;
              while (hideTo < lineTo) {
                const ch = view.state.doc.sliceString(hideTo, hideTo + 1);
                if (ch === " " || ch === "\t") hideTo += 1;
                else break;
              }
            }
            specs.push({ from: node.from, to: hideTo, deco: hideMark });
          }
          return;
        }

        if (name.startsWith("ATXHeading")) {
          const level = Number(name.replace("ATXHeading", "")) || 1;
          if (!active) {
            specs.push({
              from: node.from,
              to: node.to,
              deco: heading(Math.min(level, 6)),
            });
          }
          return;
        }

        if (name === "StrongEmphasis") {
          if (!active) {
            specs.push({ from: node.from, to: node.to, deco: strong });
          }
          return;
        }

        if (name === "Emphasis") {
          if (!active) {
            specs.push({ from: node.from, to: node.to, deco: emphasis });
          }
          return;
        }

        if (name === "Strikethrough") {
          if (!active) {
            specs.push({ from: node.from, to: node.to, deco: strikethrough });
          }
          return;
        }

        if (name === "InlineCode") {
          if (!active) {
            specs.push({ from: node.from, to: node.to, deco: inlineCode });
          }
          return;
        }

        // Link / Autolink / Image / URL — owned by elements/link or elements/image.
        if (isConstructOwnedByElement(name)) return;
      },
    });
  }

  specs.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    specs.map((s) => s.deco.range(s.from, s.to)),
    true,
  );
}

function createLivePreviewPlugin(
  resolveMentionLabel?: (token: string) => string | undefined,
  onMentionActivate?: (token: string) => void,
) {
  const activatable = Boolean(onMentionActivate);
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private unbindModHeld: (() => void) | undefined;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(
          view,
          resolveMentionLabel,
          activatable,
        );
        if (activatable) {
          this.unbindModHeld = bindModHeldClass(view);
        }
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged ||
          syntaxTree(update.state) !== syntaxTree(update.startState)
        ) {
          this.decorations = buildDecorations(
            update.view,
            resolveMentionLabel,
            activatable,
          );
        }
      }

      destroy() {
        this.unbindModHeld?.();
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: onMentionActivate
        ? {
            mousedown(event, view) {
              if (!isModClick(event)) return false;
              const target = event.target;
              let token: string | null = null;
              if (target instanceof HTMLElement) {
                const chip = target.closest("[data-mention-token]");
                if (chip instanceof HTMLElement) {
                  token = chip.dataset.mentionToken ?? null;
                }
              }
              if (!token) {
                const pos = view.posAtCoords({
                  x: event.clientX,
                  y: event.clientY,
                });
                if (pos == null) return false;
                token = mentionTokenAt(view, pos);
              }
              if (!token) return false;
              event.preventDefault();
              onMentionActivate(token);
              return true;
            },
          }
        : undefined,
    },
  );
}

const livePreviewTheme = EditorView.baseTheme({
  ".cm-md-heading": {
    fontWeight: "650",
    lineHeight: "1.25",
  },
  ".cm-md-h1": { fontSize: "1.45em" },
  ".cm-md-h2": { fontSize: "1.25em" },
  ".cm-md-h3": { fontSize: "1.1em" },
  ".cm-md-h4": { fontSize: "1.05em" },
  ".cm-md-h5": { fontSize: "1em" },
  ".cm-md-h6": { fontSize: "0.95em" },
  ".cm-md-strong": { fontWeight: "700" },
  ".cm-md-emphasis": { fontStyle: "italic" },
  ".cm-md-strikethrough": {
    textDecoration: "line-through",
    color: "var(--color-use--text-secondary)",
  },
  ".cm-md-inline-code": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.92em",
    backgroundColor: "var(--color-use--bg-darken)",
    borderRadius: "3px",
  },
  ".cm-md-mention": {
    display: "inline",
    padding: "0 4px",
    margin: "0 1px",
    backgroundColor: "var(--color-use--accent-bg)",
    color: "var(--color-use--accent-text)",
    borderRadius: "3px",
  },
});

/**
 * Higher priority than baseTheme so pointer/underline beat CM's content
 * `cursor: text`. `cm-mod-held` lives on the editor root — use `&`.
 */
const mentionActivateTheme = EditorView.theme({
  "&.cm-mod-held .cm-md-mention-activatable": {
    cursor: "pointer",
  },
  "&.cm-mod-held .cm-md-mention-activatable:hover": {
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
});

/** Obsidian-style same-pane decorations (SoT stays raw Markdown). */
export function createLivePreviewExtensions(
  options: LivePreviewOptions = {},
): Extension[] {
  const exts: Extension[] = [
    createLivePreviewPlugin(
      options.resolveMentionLabel,
      options.onMentionActivate,
    ),
    livePreviewTheme,
  ];
  if (options.localMedia) {
    exts.push(localMediaFacet.of(options.localMedia));
  }
  if (options.onMentionActivate) {
    exts.push(mentionActivateTheme);
  }
  if (options.elements !== false) {
    exts.push(...createElementLiveExtensions());
  }
  return exts;
}
