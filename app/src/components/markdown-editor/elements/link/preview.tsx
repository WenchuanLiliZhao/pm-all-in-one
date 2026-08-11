// ↔ ./index.ts — linkPreviewComponents registered in element registry
// ↔ ./preview.module.scss — accent link color
// ↔ ./live.ts — Live twin (hide [](); style label)

import type { Components } from "react-markdown";
import styles from "./preview.module.scss";

/** Reading View anchors. */
export const linkPreviewComponents: Components = {
  a: ({ className, children, node: _node, ...props }) => (
    <a
      className={[styles.a, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </a>
  ),
};
