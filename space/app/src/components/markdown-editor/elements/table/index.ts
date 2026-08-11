// ↔ ../index.ts — registered in elementPreviewComponents + createElementLiveExtensions
// ↔ ./chrome.ts — Live idle HTML host; selection into table → parent pipe edit
// ↔ ./preview.tsx — Reading View table components

import type { Extension } from "@codemirror/state";
import { createTableChromeExtensions } from "./chrome";

export { tablePreviewComponents } from "./preview";

/**
 * Live-mode GFM table: pinned-width scroll host (HTML idle).
 * Selection into the table clears the decoration; edit as parent CM pipe text.
 */
export function createTableLiveExtensions(): Extension[] {
  return createTableChromeExtensions();
}
