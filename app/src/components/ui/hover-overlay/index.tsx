/**
 * Reusable hover/active overlay — parent SCSS drives opacity on hover/active.
 * Same currentColor pattern as Button `button__hover-overlay`.
 *
 * ↔ components/ui/dropdown-menu — ItemButton / shortcut / switch rows
 * ↔ components/ui/toggle-switch — thumb track overlay
 */
import type { CSSProperties, FC } from "react";
import styles from "./styles.module.scss";

export type HoverOverlayProps = {
  disabled?: boolean;
  color?: string;
  className?: string;
};

export const HoverOverlay: FC<HoverOverlayProps> = ({
  disabled = false,
  color,
  className,
}) => {
  if (disabled) return null;

  const inlineStyles: CSSProperties | undefined = color
    ? { backgroundColor: color }
    : undefined;

  return (
    <span
      className={[styles["hover-overlay"], className].filter(Boolean).join(" ")}
      style={inlineStyles}
      aria-hidden
    />
  );
};
