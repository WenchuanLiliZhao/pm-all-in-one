// ↔ index.ts — re-exported public contracts
// ↔ merge-plugins.ts — applies MarkdownPlugin transform/components/schemes
// ↔ src/lib/markdown/ — product adapters implement MarkdownPlugin

import type { ReactNode, Ref } from "react";
import type { Components } from "react-markdown";

/**
 * Retained on the public API. UI is temporarily locked to Live — `source` /
 * `preview` values are accepted but ignored until mode switching returns.
 */
export type MarkdownEditorMode = "live" | "source" | "preview";

/**
 * chrome = optional label header + bordered shell; borderless = no header,
 * no border/radius on the CM shell. Mode switching is paused for both.
 */
export type MarkdownEditorVariant = "chrome" | "borderless";

/** Imperative handle for title→body handoff (and Lab focus demos). */
export type MarkdownEditorHandle = {
  focus: (opts?: { at?: "start" | "end" }) => void;
};

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
};

export type MarkdownEditorProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /**
   * Retained for API compatibility. Defaults to `"live"`. Currently ignored —
   * the editor always renders Live.
   */
  defaultMode?: MarkdownEditorMode;
  /**
   * chrome (default): optional label header + bordered shell.
   * borderless: no header; no border/radius on CM shell.
   * Mode switching is paused; both variants always render Live.
   */
  variant?: MarkdownEditorVariant;
  /** Imperative focus (e.g. after Title Enter). */
  editorRef?: Ref<MarkdownEditorHandle>;
  /**
   * When caret is at doc start and user presses ArrowUp / ArrowLeft,
   * call this instead of moving within the editor (title handoff).
   */
  onNavigateOutAtStart?: () => void;
  /** Blur of the editor shell (autosave flush). */
  onBlur?: () => void;
  plugins?: MarkdownPlugin[];
  className?: string;
  /** Approximate min height in rows (mapped to px for CM). */
  rows?: number;
  /** Optional label in the chrome header. Ignored when borderless. */
  label?: ReactNode;
  /** When false, skip closeBrackets / custom pair keymap. Default true. */
  autoPair?: boolean;
  /** Generic `@` autocomplete; omit to disable. */
  mentionAutocomplete?: MentionAutocompleteProps;
};

export type MarkdownPreviewProps = {
  source: string;
  plugins?: MarkdownPlugin[];
  className?: string;
};
