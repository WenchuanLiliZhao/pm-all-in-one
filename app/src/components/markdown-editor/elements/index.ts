// ↔ AGENTS.md — element encapsulation law + registry contract
// ↔ ../extensions/live-preview.ts — mounts createElementLiveExtensions in Live mode
// ↔ ../markdown-preview.tsx — mounts elementPreviewComponents in Reading View
// ↔ ./table|codeblock|list|link|blockquote|hr|image|math — shipped element packages

import type { Components } from "react-markdown";
import type { Extension } from "@codemirror/state";
import {
  blockquotePreviewComponents,
  createBlockquoteLiveExtensions,
} from "./blockquote";
import {
  codeblockPreviewComponents,
  createCodeblockLiveExtensions,
} from "./codeblock";
import {
  createHrLiveExtensions,
  hrPreviewComponents,
} from "./hr";
import {
  createImageLiveExtensions,
  imagePreviewComponents,
} from "./image";
import {
  createLinkLiveExtensions,
  linkPreviewComponents,
} from "./link";
import {
  createListLiveExtensions,
  listPreviewComponents,
} from "./list";
import {
  createMathLiveExtensions,
  mathPreviewComponents,
} from "./math";
import {
  createTableLiveExtensions,
  tablePreviewComponents,
} from "./table";

/**
 * Per-element Reading View component map (core defaults).
 * Plugins merge on top via `mergeComponents`.
 */
export const elementPreviewComponents: Components = {
  ...tablePreviewComponents,
  ...codeblockPreviewComponents,
  ...listPreviewComponents,
  ...linkPreviewComponents,
  ...blockquotePreviewComponents,
  ...hrPreviewComponents,
  ...imagePreviewComponents,
  ...mathPreviewComponents,
};

/** Per-element Live decoration / theme extensions. */
export function createElementLiveExtensions(): Extension[] {
  return [
    ...createTableLiveExtensions(),
    ...createCodeblockLiveExtensions(),
    ...createListLiveExtensions(),
    ...createLinkLiveExtensions(),
    ...createBlockquoteLiveExtensions(),
    ...createHrLiveExtensions(),
    ...createImageLiveExtensions(),
    ...createMathLiveExtensions(),
  ];
}
