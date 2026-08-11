// ↔ ./index.ts — hrPreviewComponents
// ↔ ./preview.module.scss
// ↔ ./live.ts — Live twin

import type { Components } from "react-markdown";
import styles from "./preview.module.scss";

export const hrPreviewComponents: Components = {
  hr: ({ className, node: _node, ...props }) => (
    <hr
      className={[styles.hr, className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
};
