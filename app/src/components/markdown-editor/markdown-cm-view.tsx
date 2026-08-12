// ↔ markdown-editor.tsx — mounts this for Live editing
// ↔ extensions/live-preview.ts — same-pane Live decorations + element hosts
// ↔ extensions/auto-pair.ts — delimiter auto-pair keymap
// ↔ autocomplete/mention.ts — generic @ mention completion shell

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
} from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import {
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import {
  autocompletion,
  completionKeymap,
} from "@codemirror/autocomplete";
import { createAutoPairExtensions } from "./extensions/auto-pair";
import { createLivePreviewExtensions } from "./extensions/live-preview";
import {
  mentionCompletions,
  mentionAutocompleteFacet,
} from "./autocomplete/mention";
import {
  assetCompletions,
  assetFilenamesFacet,
} from "./autocomplete/asset";
import {
  assetIngestFacet,
  createAssetIngestExtensions,
} from "./extensions/asset-ingest";
import type { MentionAutocompleteProps } from "./types";
import type { LocalMediaOptions } from "./local-media";

/** Markdown chrome + nested fenced-code token colors (host `--color-use--*`). */
const mdHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "650" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.link, color: "var(--color-use--accent-text)" },
  {
    tag: tags.monospace,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  { tag: tags.keyword, color: "var(--color-use--accent-text)" },
  { tag: tags.atom, color: "var(--color-use--accent)" },
  { tag: tags.bool, color: "var(--color-use--accent)" },
  { tag: tags.url, color: "var(--color-use--accent-text)" },
  { tag: tags.labelName, color: "var(--color-use--accent)" },
  {
    tag: tags.inserted,
    color: "var(--color-use--success-fg)",
  },
  {
    tag: tags.deleted,
    color: "var(--color-use--danger-fg)",
  },
  {
    tag: tags.literal,
    color: "var(--color-use--success-fg)",
  },
  { tag: tags.string, color: "var(--color-use--success-fg)" },
  { tag: tags.number, color: "var(--color-use--success-fg)" },
  {
    tag: [tags.regexp, tags.escape],
    color: "var(--color-use--warn-strong)",
  },
  {
    tag: tags.definition(tags.variableName),
    color: "var(--color-use--warn-fg)",
  },
  {
    tag: tags.local(tags.variableName),
    color: "var(--color-use--text-prime)",
  },
  {
    tag: [tags.typeName, tags.namespace],
    color: "var(--color-use--warn-fg)",
  },
  {
    tag: tags.className,
    color: "var(--color-use--warn-fg)",
  },
  {
    tag: [tags.special(tags.variableName), tags.macroName],
    color: "var(--color-use--accent)",
  },
  {
    tag: tags.definition(tags.propertyName),
    color: "var(--color-use--accent)",
  },
  { tag: tags.comment, color: "var(--color-use--text-secondary)" },
  { tag: tags.meta, color: "var(--color-use--text-secondary)" },
  {
    tag: tags.invalid,
    color: "var(--color-use--danger-fg)",
  },
]);

export type MarkdownCmViewHandle = {
  focus: (opts?: { at?: "start" | "end" }) => void;
  /** Insert text at the current selection (replaces selection). */
  insertAtCursor: (text: string) => void;
};

export type MarkdownCmViewProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** When true, enable live-preview decorations. */
  live: boolean;
  autoPair?: boolean;
  mentionAutocomplete?: MentionAutocompleteProps;
  localMedia?: LocalMediaOptions;
  /** Basenames under this node's assets/ for `assets/` autocomplete. */
  assetFilenames?: string[];
  /** Paste/drop → product ingest → Markdown cites. */
  ingestAssetFiles?: (files: File[]) => Promise<string[]>;
  minHeightPx: number;
  className?: string;
  /** Thinner scroller padding; used by borderless shell. */
  borderless?: boolean;
  /** Imperative focus API (bypasses accidental-focus gate). */
  handleRef?: Ref<MarkdownCmViewHandle | null>;
  /** ArrowUp/Left at doc start → leave editor (title handoff). */
  onNavigateOutAtStart?: () => void;
};

function mentionExtensions(
  mention: MentionAutocompleteProps | undefined,
  assetFilenames: string[] | undefined,
) {
  const sources = [];
  const facets: Extension[] = [];
  if (mention) {
    facets.push(mentionAutocompleteFacet.of(mention));
    sources.push(mentionCompletions);
  }
  // Always register when product passes the list (may be empty → "No assets").
  if (assetFilenames !== undefined) {
    facets.push(assetFilenamesFacet.of(assetFilenames));
    sources.push(assetCompletions);
  }
  if (sources.length === 0) return [];
  return [
    ...facets,
    autocompletion({
      override: sources,
      activateOnTyping: true,
      defaultKeymap: true,
    }),
    keymap.of(completionKeymap),
  ];
}

function liveExtensions(
  live: boolean,
  mention: MentionAutocompleteProps | undefined,
  localMedia: LocalMediaOptions | undefined,
) {
  if (!live) return [];
  const byToken = new Map(
    (mention?.candidates ?? []).map((c) => [c.insertText, c.label] as const),
  );
  return createLivePreviewExtensions({
    resolveMentionLabel: (token) => byToken.get(token),
    onMentionActivate: mention?.onActivate,
    localMedia,
  });
}

/** Chrome + dark-safe CM surfaces (caret, selection, autocomplete tooltip). */
function createChromeTheme(minHeightPx: number, borderless: boolean) {
  const pad = borderless ? "4px 0" : "10px 12px";
  const fontFamily = borderless
    ? "inherit"
    : "ui-monospace, SFMono-Regular, Menlo, monospace";
  return EditorView.theme({
    "&": {
      fontSize: borderless ? "15px" : "13px",
      minHeight: `${minHeightPx}px`,
      color: "var(--color-use--text-prime)",
    },
    ".cm-scroller": {
      fontFamily,
      lineHeight: borderless ? "1.55" : "1.45",
      // View-level inset — not per-line. Lines stay flush inside the content box.
      padding: pad,
      boxSizing: "border-box",
      // Fill editor minHeight so empty chrome isn't a dead click/hover target
      // (height:100% fails when parent only has min-height).
      minHeight: `${minHeightPx}px`,
    },
    ".cm-content": {
      padding: "0",
      caretColor: "var(--color-use--text-prime)",
      minHeight: `${minHeightPx}px`,
      boxSizing: "border-box",
    },
    ".cm-line": {
      padding: "0",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-placeholder": {
      color: "var(--color-use--text-negative)",
    },
    ".cm-selectionBackground": {
      background: "var(--color-use--hover-overlay-mouse-down) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      background: "var(--color-use--border-focus) !important",
    },
    ".cm-activeLine": {
      background: "var(--color-use--hover-overlay-hover)",
    },
    ".cm-tooltip": {
      background: "var(--color-use--bg-prime-hex)",
      border: "1px solid var(--color-use--border-emphasis-hex)",
      color: "var(--color-use--text-prime)",
    },
    ".cm-tooltip-autocomplete": {
      background: "var(--color-use--bg-prime-hex)",
      border: "1px solid var(--color-use--border-emphasis-hex)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      background: "var(--color-use--hover-overlay-hover)",
      color: "var(--color-use--text-prime)",
    },
  });
}

/** Minimal middle replace so external sync preserves caret when possible. */
function diffReplace(
  oldText: string,
  newText: string,
): { from: number; to: number; insert: string } {
  let start = 0;
  const oldLen = oldText.length;
  const newLen = newText.length;
  while (
    start < oldLen &&
    start < newLen &&
    oldText.charCodeAt(start) === newText.charCodeAt(start)
  ) {
    start += 1;
  }
  let oldEnd = oldLen;
  let newEnd = newLen;
  while (
    oldEnd > start &&
    newEnd > start &&
    oldText.charCodeAt(oldEnd - 1) === newText.charCodeAt(newEnd - 1)
  ) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  return { from: start, to: oldEnd, insert: newText.slice(start, newEnd) };
}

function mapPosThroughReplace(
  pos: number,
  from: number,
  to: number,
  insertLen: number,
): number {
  if (pos <= from) {
    return pos;
  }
  if (pos >= to) {
    return pos - (to - from) + insertLen;
  }
  return from + Math.min(pos - from, insertLen);
}

function edgeNavigateKeymap(
  onNavigateOutAtStart: (() => void) | undefined,
): Extension {
  if (!onNavigateOutAtStart) {
    return [];
  }
  return keymap.of([
    {
      key: "ArrowUp",
      run: (view) => {
        if (view.state.selection.main.head !== 0) {
          return false;
        }
        onNavigateOutAtStart();
        return true;
      },
    },
    {
      key: "ArrowLeft",
      run: (view) => {
        if (view.state.selection.main.head !== 0) {
          return false;
        }
        onNavigateOutAtStart();
        return true;
      },
    },
  ]);
}

export function MarkdownCmView({
  value,
  onChange,
  placeholder,
  live,
  autoPair = true,
  mentionAutocomplete,
  localMedia,
  assetFilenames,
  ingestAssetFiles,
  minHeightPx,
  className,
  borderless = false,
  handleRef,
  onNavigateOutAtStart,
}: MarkdownCmViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const syncingFromPropRef = useRef(false);
  const allowProgrammaticFocusRef = useRef(false);
  const onNavigateOutRef = useRef(onNavigateOutAtStart);
  onNavigateOutRef.current = onNavigateOutAtStart;
  const ingestRef = useRef(ingestAssetFiles);
  ingestRef.current = ingestAssetFiles;

  const liveComp = useMemo(() => new Compartment(), []);
  const pairComp = useMemo(() => new Compartment(), []);
  const mentionComp = useMemo(() => new Compartment(), []);
  const ingestComp = useMemo(() => new Compartment(), []);
  const phComp = useMemo(() => new Compartment(), []);
  const themeComp = useMemo(() => new Compartment(), []);
  const edgeComp = useMemo(() => new Compartment(), []);

  useImperativeHandle(
    handleRef,
    () => ({
      focus: (opts) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        const at = opts?.at ?? "start";
        const pos = at === "end" ? view.state.doc.length : 0;
        allowProgrammaticFocusRef.current = true;
        view.dispatch({
          selection: EditorSelection.cursor(pos),
          scrollIntoView: true,
        });
        view.focus();
        // Keep gate open briefly so focusin from focus() is accepted.
        queueMicrotask(() => {
          allowProgrammaticFocusRef.current = false;
        });
      },
      insertAtCursor: (text) => {
        const view = viewRef.current;
        if (!view || !text) return;
        allowProgrammaticFocusRef.current = true;
        view.dispatch(view.state.replaceSelection(text));
        view.focus();
        queueMicrotask(() => {
          allowProgrammaticFocusRef.current = false;
        });
      },
    }),
    [handleRef],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        // GFM base (tables, strikethrough, task lists, autolink) + nested
        // fenced-code languages for live/source highlighting.
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(mdHighlight),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            // Prop sync uses dispatch; must not echo back as a user edit.
            if (syncingFromPropRef.current) {
              return;
            }
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        themeComp.of(createChromeTheme(minHeightPx, borderless)),
        phComp.of(placeholder ? cmPlaceholder(placeholder) : []),
        pairComp.of(autoPair ? createAutoPairExtensions() : []),
        liveComp.of(liveExtensions(live, mentionAutocomplete, localMedia)),
        mentionComp.of(mentionExtensions(mentionAutocomplete, assetFilenames)),
        ingestComp.of(
          ingestAssetFiles
            ? [
                assetIngestFacet.of((files) => {
                  const fn = ingestRef.current;
                  if (!fn) return Promise.resolve([]);
                  return fn(files);
                }),
                ...createAssetIngestExtensions(),
              ]
            : [],
        ),
        edgeComp.of(
          edgeNavigateKeymap(() => onNavigateOutRef.current?.()),
        ),
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;

    // Only accept mouse-driven focus when the mousedown landed in this editor.
    // Clicks on surrounding page chrome (e.g. MAIN.center beside the shell) must
    // not leave a caret in the editor.
    let mouseDownInEditor = false;
    const onPointerDown = (e: MouseEvent) => {
      mouseDownInEditor = view.dom.contains(e.target as Node);
    };
    const onKeyDown = () => {
      mouseDownInEditor = true; // Tab / keyboard focus remains allowed
    };
    const onFocusIn = () => {
      if (allowProgrammaticFocusRef.current) {
        return;
      }
      if (!mouseDownInEditor) {
        view.contentDOM.blur();
      }
    };
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    host.addEventListener("focusin", onFocusIn);

    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      host.removeEventListener("focusin", onFocusIn);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; live/value synced via compartments + effects below
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    const { from, to, insert } = diffReplace(current, value);
    const insertLen = insert.length;
    const sel = view.state.selection;
    const nextRanges = sel.ranges.map((r) =>
      EditorSelection.range(
        mapPosThroughReplace(r.anchor, from, to, insertLen),
        mapPosThroughReplace(r.head, from, to, insertLen),
      ),
    );
    const scrollTop = view.scrollDOM.scrollTop;
    syncingFromPropRef.current = true;
    try {
      view.dispatch({
        changes: { from, to, insert },
        selection: EditorSelection.create(nextRanges, sel.mainIndex),
      });
      view.scrollDOM.scrollTop = scrollTop;
    } finally {
      syncingFromPropRef.current = false;
    }
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: liveComp.reconfigure(
        liveExtensions(live, mentionAutocomplete, localMedia),
      ),
    });
  }, [live, liveComp, mentionAutocomplete, localMedia]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: pairComp.reconfigure(
        autoPair ? createAutoPairExtensions() : [],
      ),
    });
  }, [autoPair, pairComp]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: mentionComp.reconfigure(
        mentionExtensions(mentionAutocomplete, assetFilenames),
      ),
    });
  }, [mentionAutocomplete, assetFilenames, mentionComp]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: ingestComp.reconfigure(
        ingestAssetFiles
          ? [
              assetIngestFacet.of((files) => {
                const fn = ingestRef.current;
                if (!fn) return Promise.resolve([]);
                return fn(files);
              }),
              ...createAssetIngestExtensions(),
            ]
          : [],
      ),
    });
  }, [ingestAssetFiles, ingestComp]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: phComp.reconfigure(
        placeholder ? cmPlaceholder(placeholder) : [],
      ),
    });
  }, [placeholder, phComp]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeComp.reconfigure(
        createChromeTheme(minHeightPx, borderless),
      ),
    });
  }, [minHeightPx, borderless, themeComp]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: edgeComp.reconfigure(
        edgeNavigateKeymap(() => onNavigateOutRef.current?.()),
      ),
    });
  }, [onNavigateOutAtStart, edgeComp]);

  return <div ref={hostRef} className={className} />;
}
