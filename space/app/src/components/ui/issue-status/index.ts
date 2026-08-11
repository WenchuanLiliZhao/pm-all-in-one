/**
 * Shared issue-status chrome (glyph + tone). Not view-specific.
 * ↔ src/lib/issue-status.ts — catalog ids / labels
 * ↔ electron/core/issue-status.ts — core catalog SoT
 * ↔ ./tone.module.scss — data-status color map (icons, text, bars)
 * ↔ ./css-color.ts — same map as CSS color strings for canvas/SVG fills
 */

export {
  issueStatusIcon,
  issueStatusLabel,
} from "./icon";
export { issueStatusCssColor } from "./css-color";
export { default as issueStatusToneStyles } from "./tone.module.scss";
