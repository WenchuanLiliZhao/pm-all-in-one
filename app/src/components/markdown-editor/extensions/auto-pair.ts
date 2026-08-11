// ↔ ../markdown-cm-view.tsx — mounts createAutoPairExtensions when autoPair
// ↔ AGENTS.md — pairs [] / * / ** / (); never backticks

import {
  closeBrackets,
  deleteBracketPair,
} from "@codemirror/autocomplete";
import {
  EditorSelection,
  Prec,
  type Extension,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

/** Longest-first markdown delimiter pairs (stock CM covers ()[] via deleteBracketPair). */
const MD_PAIRS: readonly [open: string, close: string][] = [
  ["**", "**"],
  ["*", "*"],
];

function wrapOrInsert(
  view: EditorView,
  open: string,
  close: string,
): boolean {
  const { state } = view;
  view.dispatch(
    state.changeByRange((range) => {
      if (range.empty) {
        return {
          changes: { from: range.from, insert: open + close },
          range: EditorSelection.cursor(range.from + open.length),
        };
      }
      const selected = state.sliceDoc(range.from, range.to);
      return {
        changes: {
          from: range.from,
          to: range.to,
          insert: open + selected + close,
        },
        range: EditorSelection.range(
          range.from + open.length,
          range.from + open.length + selected.length,
        ),
      };
    }),
  );
  return true;
}

/**
 * Backspace between an empty markdown pair deletes both sides
 * (`**|**`, `*|`*). Falls through to stock `deleteBracketPair`
 * for `()` / `[]` / etc.
 *
 * Backticks are intentionally not auto-paired (fence ``` must type
 * one char at a time; pairing caused ```\\n\\n`````).
 */
function deleteMarkdownDelimiterPair(view: EditorView): boolean {
  if (view.state.readOnly) return false;
  if (view.composing) return false;

  let matchedMarkdown = true;
  const changes = view.state.changeByRange((range) => {
    if (!range.empty) {
      matchedMarkdown = false;
      return { range };
    }
    const { from } = range;
    for (const [open, close] of MD_PAIRS) {
      if (from < open.length) continue;
      if (
        view.state.sliceDoc(from - open.length, from) === open &&
        view.state.sliceDoc(from, from + close.length) === close
      ) {
        return {
          changes: {
            from: from - open.length,
            to: from + close.length,
          },
          range: EditorSelection.cursor(from - open.length),
        };
      }
    }
    matchedMarkdown = false;
    return { range };
  });

  if (!matchedMarkdown) {
    return deleteBracketPair(view);
  }

  view.dispatch({
    ...changes,
    scrollIntoView: true,
    userEvent: "delete.backward",
  });
  return true;
}

/** Minimal markdown auto-pair + pair-delete on a single CM input stack. */
export function createAutoPairExtensions(): Extension[] {
  return [
    closeBrackets(),
    // Beat defaultKeymap's deleteCharBackward so pair-delete actually runs.
    Prec.high(
      keymap.of([
        { key: "Backspace", run: deleteMarkdownDelimiterPair },
        {
          key: "*",
          run: (view) => {
            const { state } = view;
            const range = state.selection.main;
            if (!range.empty) return wrapOrInsert(view, "**", "**");
            const prev1 = state.sliceDoc(
              Math.max(0, range.from - 1),
              range.from,
            );
            const next1 = state.sliceDoc(
              range.from,
              Math.min(state.doc.length, range.from + 1),
            );
            if (prev1 === "*") {
              // First `*` already made `*|`* via wrapOrInsert. Second `*` must
              // become `**|**` by adding one star on each side of the caret —
              // NOT insert `***` (that yields *****).
              if (next1 === "*") {
                view.dispatch({
                  changes: [
                    { from: range.from + 1, insert: "*" },
                    { from: range.from, insert: "*" },
                  ],
                  selection: EditorSelection.cursor(range.from + 1),
                });
              } else {
                // Lone `*|` → `**|**`
                view.dispatch({
                  changes: { from: range.from, insert: "***" },
                  selection: EditorSelection.cursor(range.from + 1),
                });
              }
              return true;
            }
            return wrapOrInsert(view, "*", "*");
          },
        },
      ]),
    ),
  ];
}
