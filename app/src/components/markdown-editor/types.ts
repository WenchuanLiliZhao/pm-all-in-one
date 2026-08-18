// ↔ index.ts — re-exported public contracts
// ↔ merge-plugins.ts — applies MarkdownPlugin transform/components/schemes/fences
// ↔ AGENTS.md — § Reading View fence plugins
// ↔ src/lib/markdown/ — product adapters implement MarkdownPlugin

import type { ComponentType, Ref } from "react";
import type { Components } from "react-markdown";

export type MarkdownEditorMode = "live" | "source" | "preview";

/** Imperative handle for title→body handoff (and Lab focus demos). */
export type MarkdownEditorHandle = {
  focus: (opts?: { at?: "start" | "end" }) => void;
  /** Insert text at the current selection (replaces selection). */
  insertAtCursor: (text: string) => void;
};

/**
 * Reading View fence claim. Core `pre` looks this up by the first info-string
 * token before mermaid / boxed code. Do not override `pre` to claim a lang.
 */
export type MarkdownFencePlugin = {
  /** Fence language (first info-string token). `plot` matches `plot riemann`. */
  lang: string;
  /** Reading View renderer for that fence's body. */
  component: ComponentType<{ lang: string; source: string }>;
  /**
   * If true, the component may own a canvas and an imperative lifecycle
   * (listeners, animation, resize). False = pure render, like mermaid SVG.
   */
  interactive?: boolean;
};

/**
 * Reading View only: `transformSource` + `components` + `allowedUrlSchemes`
 * + optional `fences` lang registry. Do not add a Live figure runtime;
 * do not override `pre` to claim a fence language.
 */
export type MarkdownPlugin = {
  /** Rewrite source before markdown parse (Reading View only). */
  transformSource?: (source: string) => string;
  /** react-markdown `components` overrides (Reading View only). */
  components?: Components;
  /**
   * Custom URL schemes (no trailing `:`) that `MarkdownPreview` must preserve.
   * react-markdown's defaultUrlTransform strips unknown schemes; plugins that
   * emit e.g. `issue:` / `wiki:` hrefs must declare them here.
   */
  allowedUrlSchemes?: string[];
  /**
   * Claim fence languages for Reading View. Duplicate `lang` across plugins
   * is a load-time error. Core looks these up before mermaid / boxed code.
   */
  fences?: MarkdownFencePlugin[];
};

/** Generic @-mention autocomplete; product fills insertText. */
export type MentionAutocompleteCandidate = {
  /** Stable key for React / highlight (e.g. "1-2" or "ok"). */
  id: string;
  /** Primary row text (title). */
  label: string;
  /** Secondary row text (e.g. "1-2" or "concerto · 1-2"). */
  secondary?: string;
  /** Full token written on confirm (e.g. @issue-w_1::w_2). */
  insertText: string;
};

export type MentionAutocompleteProps = {
  candidates: MentionAutocompleteCandidate[];
  /** Optional; default matches label + id + secondary. */
  filterCandidate?: (
    candidate: MentionAutocompleteCandidate,
    query: string,
  ) => boolean;
  /** Max rows; default 50. */
  maxResults?: number;
  emptyMessage?: string;
  /**
   * Live: Cmd/Ctrl+click an `@…` mention (chip or raw token, outside code)
   * calls this with the full SoT token. Product adapters navigate from here.
   */
  onActivate?: (token: string) => void;
};

export type MarkdownEditorProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /**
   * Initial mode. Defaults to `"preview"`. Uncontrolled after mount;
   * not persisted.
   */
  defaultMode?: MarkdownEditorMode;
  /**
   * Left sticky-nav label (disk basename). Defaults to `"README.md"`.
   */
  filename?: string;
  /** Imperative focus (e.g. after Title Enter). */
  editorRef?: Ref<MarkdownEditorHandle>;
  /**
   * When caret is at doc start and user presses ArrowUp / ArrowLeft,
   * call this instead of moving within the editor (title handoff).
   */
  onNavigateOutAtStart?: () => void;
  /** Optional blur of the editor shell (no longer a save trigger). */
  onBlur?: () => void;
  plugins?: MarkdownPlugin[];
  className?: string;
  /** Approximate min height in rows (mapped to px for CM). */
  rows?: number;
  /** When false, skip closeBrackets / custom pair keymap. Default true. */
  autoPair?: boolean;
  /** Generic `@` autocomplete; omit to disable. */
  mentionAutocomplete?: MentionAutocompleteProps;
  /**
   * Local `assets/…` URL resolve. Product fills this; core stays bridge-free.
   */
  localMedia?: {
    resolveMediaUrl?: (src: string) => string;
  };
  /** Basenames for `assets/` autocomplete. */
  assetFilenames?: string[];
  /**
   * Paste/drop files into the editor: product copies into node `assets/` and
   * returns written basenames; core inserts Markdown cites. Omit to disable.
   */
  ingestAssetFiles?: (files: File[]) => Promise<string[]>;
};

export type MarkdownPreviewProps = {
  source: string;
  plugins?: MarkdownPlugin[];
  className?: string;
  /**
   * Same `assets/…` resolve Live uses. Product fills this; omit in Lab
   * fixtures that only cite https / data URIs.
   */
  localMedia?: {
    resolveMediaUrl?: (src: string) => string;
  };
};
