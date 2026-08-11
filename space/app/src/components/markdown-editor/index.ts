// ↔ AGENTS.md — module law / layout / public API this barrel exports
// ↔ types.ts — MarkdownPlugin + prop contracts
// ↔ transform-outside-code.ts — replaceOutsideCode for mention adapters
// ↔ src/lib/markdown/ — product plugins consume MarkdownPlugin + linkChipStyles + replaceOutsideCode

export { MarkdownEditor } from "./markdown-editor";
export { MarkdownPreview } from "./markdown-preview";
export { replaceOutsideCode } from "./transform-outside-code";
export type {
  MarkdownEditorHandle,
  MarkdownEditorMode,
  MarkdownEditorProps,
  MarkdownEditorVariant,
  MarkdownPlugin,
  MarkdownPreviewProps,
  MentionAutocompleteCandidate,
  MentionAutocompleteProps,
} from "./types";

import styles from "./styles.module.scss";

/** Optional CSS module class names for product link-chip plugins. */
export const linkChipStyles = {
  ok: styles.linkChip,
  broken: styles.linkChipBroken,
} as const;
