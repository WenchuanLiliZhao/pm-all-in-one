/**
 * Shared outline select control for Roadmap + Hierarchy outline + wiki rail.
 * Lead owns folder icon↔chevron swap (ui-system SidebarTree contract); Lucide only.
 * Select button keeps optional kind + title as flex siblings (left-aligned).
 *
 * Host chrome prompt: render lead+select inside an outer hover/selected wrapper
 * that owns padding AND lead↔title gap (`treeRowStyles.rowHoverRoot`). Do not pad
 * or gap only via `className` on this select — lead is a sibling outside the button.
 * Non-interactive labels in the same column must share that outer pad-x
 * (seams.md `rail-row↔section-chrome`).
 *
 * ↔ src/components/wiki-shell/styles.module.scss — rail host that follows this
 */
import type {
  ButtonHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { Lucide } from "@/components/ui/lucide";
import styles from "./styles.module.scss";

export type TreeRowProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  /** Rest glyph (Lucide). Folder rows swap to chevron on row hover / lead focus-visible. */
  icon?: ReactNode;
  hasChildren?: boolean;
  /** Open = true → chevron rotated 90deg. Only with hasChildren. */
  expanded?: boolean;
  onToggle?: () => void;
  /** Drag-collapse lock: disable folder lead. */
  twistLocked?: boolean;
  /**
   * Escape hatch — skips built-in lead. Prefer icon/hasChildren/expanded/onToggle.
   * @deprecated Prefer built-in lead API.
   */
  lead?: ReactNode;
  /**
   * Legacy external twist slot. Prefer built-in lead API.
   * @deprecated
   */
  twist?: ReactNode;
  /** Optional secondary label (lab / legacy). Product call sites omit. */
  kind?: ReactNode;
  title: ReactNode;
  /**
   * Trailing adornment (e.g. status / priority icons) — pinned right after title.
   * Layout (margin-left: auto, cluster gap) lives here; icon modules stay layout-free.
   */
  trailing?: ReactNode;
  kindClassName?: string;
  titleClassName?: string;
  className?: string;
};

export function TreeRow({
  icon,
  hasChildren = false,
  expanded = false,
  onToggle,
  twistLocked = false,
  lead,
  twist,
  kind,
  title,
  trailing,
  kindClassName,
  titleClassName,
  className,
  type = "button",
  ...selectProps
}: TreeRowProps) {
  const builtInLead = (() => {
    if (lead != null) {
      return lead;
    }
    if (twist != null) {
      return twist;
    }
    if (hasChildren) {
      return (
        <button
          type="button"
          className={styles.lead}
          data-folder="true"
          data-has-icon={icon ? "true" : undefined}
          aria-label={expanded ? "Collapse" : "Expand"}
          aria-expanded={expanded}
          disabled={twistLocked}
          onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => {
            e.stopPropagation();
          }}
          onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            if (twistLocked) {
              return;
            }
            onToggle?.();
          }}
        >
          {icon ? (
            <span className={styles.leadIcon} aria-hidden>
              {icon}
            </span>
          ) : null}
          <Lucide.ChevronRight
            className={styles.leadChevron}
            data-expanded={expanded ? "true" : undefined}
            size={18}
            aria-hidden
          />
        </button>
      );
    }
    if (icon) {
      return (
        <span className={styles.lead} aria-hidden>
          {icon}
        </span>
      );
    }
    return <span className={styles.leadSpacer} aria-hidden />;
  })();

  return (
    <>
      {builtInLead}
      <button
        type={type}
        className={[styles.select, className].filter(Boolean).join(" ")}
        {...selectProps}
      >
        {kind != null && kind !== "" ? (
          <span className={[styles.kind, kindClassName].filter(Boolean).join(" ")}>
            {kind}
          </span>
        ) : null}
        <span className={titleClassName}>{title}</span>
        {trailing != null && trailing !== "" ? (
          <span className={styles.trailing}>{trailing}</span>
        ) : null}
      </button>
    </>
  );
}

/** Compose onto DnD outer row so folder lead swaps on whole-row hover. */
export const treeRowStyles = {
  rowHoverRoot: styles.rowHoverRoot,
} as const;
