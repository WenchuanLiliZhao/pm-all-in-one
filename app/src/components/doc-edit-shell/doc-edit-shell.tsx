/**
 * Shared vertical order for Notion-like doc editing across hosts.
 *
 * Sticky chrome spans the scrollport width (WikiShell main / detail aside),
 * not the reading-column max-width. Root breaks out of PageWidth; content
 * re-centers to the reading column (panels opt out via CSS vars).
 *
 * ↔ dogfood @wiki-6wChU3UIot-alcGXrfHUI — article / panel chrome
 * ↔ doc-edit-nav.tsx — sticky header content
 * ↔ wiki-shell/styles.module.scss — `.main` is `doc-edit-view` container
 * ↔ pages/channels/workspace-page/styles.module.scss — `.detail` container
 */
import type { ReactNode } from "react";
import styles from "./styles.module.scss";

export type DocEditShellProps = {
  /** Entity chrome (DocEditNav…). Sticky, full view width. */
  header?: ReactNode;
  conflictBanner?: ReactNode;
  /** Usually `<BorderlessTitle />`. */
  title: ReactNode;
  /** Status / priority / dates / readonly meta — existing controls. */
  propsSlot?: ReactNode;
  /** Borderless locked-live MarkdownEditor. */
  body: ReactNode;
  /** Assets, custom fields, dialogs. */
  footer?: ReactNode;
  className?: string;
  /**
   * Extra class on the padded content stack (title → footer).
   * Panel hosts use this for inset; article hosts rely on PageWidth pad.
   */
  contentClassName?: string;
};

/** Shared vertical order for Notion-like doc editing across hosts. */
export function DocEditShell({
  header,
  conflictBanner,
  title,
  propsSlot,
  body,
  footer,
  className,
  contentClassName,
}: DocEditShellProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      {header ? <div className={styles.chrome}>{header}</div> : null}
      <div className={[styles.content, contentClassName].filter(Boolean).join(" ")}>
        {conflictBanner}
        <div className={styles.title}>{title}</div>
        {propsSlot ? <div className={styles.props}>{propsSlot}</div> : null}
        <div className={styles.body}>{body}</div>
        {footer}
      </div>
    </div>
  );
}
