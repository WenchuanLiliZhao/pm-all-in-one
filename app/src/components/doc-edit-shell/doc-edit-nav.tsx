/**
 * Sticky left/right chrome for article pages and detail panels.
 * Actions are icon-only; low-frequency items (Delete today) go in DocEditOverflowMenu.
 *
 * ↔ dogfood @wiki-6wChU3UIot-alcGXrfHUI — article / node / panel nav
 * ↔ doc-edit-shell.tsx — header slot hosts this
 * ↔ doc-edit-overflow-menu.tsx — ··· overflow
 */
import type { ReactNode } from "react";
import styles from "./doc-edit-nav.module.scss";

export type DocEditNavProps = {
  left: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function DocEditNav({ left, actions, className }: DocEditNavProps) {
  return (
    <div className={[styles.nav, className].filter(Boolean).join(" ")}>
      <div className={styles.left}>{left}</div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}

/** Left label for non-node article pages (e.g. Overview). */
export function DocEditChannelTitle({ children }: { children: ReactNode }) {
  return <span className={styles.channelTitle}>{children}</span>;
}
