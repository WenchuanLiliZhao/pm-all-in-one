import type { ReactNode } from "react";
import styles from "./styles.module.scss";

export type DocEditShellProps = {
  /** Entity chrome (Save, Delete, chips…). */
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
}: DocEditShellProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      {header ? <div className={styles.header}>{header}</div> : null}
      {conflictBanner}
      <div className={styles.title}>{title}</div>
      {propsSlot ? <div className={styles.props}>{propsSlot}</div> : null}
      <div className={styles.body}>{body}</div>
      {footer}
    </div>
  );
}
