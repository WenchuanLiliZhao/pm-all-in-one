// ↔ ./index.ts — imagePreviewComponents
// ↔ ./preview.module.scss
// ↔ ./live.ts — Live twin

import type { Components } from "react-markdown";
import styles from "./preview.module.scss";

export const imagePreviewComponents: Components = {
  img: ({ className, alt, node: _node, ...props }) => (
    <img
      className={[styles.img, className].filter(Boolean).join(" ")}
      alt={alt ?? ""}
      {...props}
    />
  ),
};
