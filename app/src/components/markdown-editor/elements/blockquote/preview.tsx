// ↔ ./index.ts — blockquotePreviewComponents
// ↔ ./preview.module.scss — left border + muted text
// ↔ ./live.ts — Live twin

import type { Components } from "react-markdown";
import styles from "./preview.module.scss";

export const blockquotePreviewComponents: Components = {
  blockquote: ({ className, children, node: _node, ...props }) => (
    <blockquote
      className={[styles.blockquote, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </blockquote>
  ),
};
