// ↔ ./index.ts — tablePreviewComponents registered in elementPreviewComponents
// ↔ ./preview.module.scss — bordered table + local horizontal scroll host
// ↔ AGENTS.md — Preview GFM tables checklist

import type { Components } from "react-markdown";
import styles from "./preview.module.scss";

/** Reading View table elements — GFM pipe tables via remark-gfm. */
export const tablePreviewComponents: Components = {
  table: ({ className, children, node: _node, ...props }) => (
    <div className={styles.scroll}>
      <table
        className={[styles.table, className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ className, children, node: _node, ...props }) => (
    <th
      className={[styles.th, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ className, children, node: _node, ...props }) => (
    <td
      className={[styles.td, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </td>
  ),
};
