// ↔ ./index.ts — listPreviewComponents registered in element registry
// ↔ ./preview.module.scss — ul/ol/li Reading View spacing
// ↔ ./live.ts — Live twin (ListMark hide + bullet/ordinal widgets)

import type { Components } from "react-markdown";
import styles from "./preview.module.scss";

/** Reading View lists — CommonMark / GFM ul·ol·li. */
export const listPreviewComponents: Components = {
  ul: ({ className, children, node: _node, ...props }) => (
    <ul
      className={[styles.ul, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ className, children, node: _node, ...props }) => (
    <ol
      className={[styles.ol, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ className, children, node: _node, ...props }) => (
    <li
      className={[styles.li, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </li>
  ),
};
