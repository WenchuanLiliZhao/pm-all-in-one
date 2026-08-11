/**
 * Shared issue-priority chrome (glyph + tone). Not view-specific.
 * ↔ src/lib/issue-priority.ts — catalog ids / labels
 * ↔ electron/core/identity/issue-priority.ts — core catalog SoT
 * ↔ ./tone.module.scss — data-priority color map
 * ↔ ../issue-status/index.ts — sibling field chrome (status)
 */

export {
  issuePriorityIcon,
  issuePriorityLabel,
} from "./icon";
export { default as issuePriorityToneStyles } from "./tone.module.scss";
