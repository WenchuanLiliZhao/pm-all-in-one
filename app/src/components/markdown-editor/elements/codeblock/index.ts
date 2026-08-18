// ↔ ../index.ts — registered in elementPreviewComponents + createElementLiveExtensions
// ↔ ./live.ts — Live fenced-code decorations / theme / boundary keymap / mermaid
// ↔ ./preview.tsx — Reading View pre/code + mermaid + fence-registry lookup
// ↔ ./mermaid-info.ts — fence info gate
// ↔ ./mermaid-widget.ts — Live idle SVG widget

export {
  codeblockPreviewComponents,
  createCodeblockPreviewComponents,
} from "./preview";
export { createCodeblockLiveExtensions } from "./live";
