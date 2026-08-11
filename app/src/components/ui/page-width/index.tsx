/**
 * Page column width — reading / full / narrow via layout tokens.
 *
 * Owns max-width + optional page pad. Does **not** own scroll, flex fill, or
 * rail geometry (those stay on WikiShell / feature roots via `className`).
 *
 * ↔ src/global-styles/layout.scss — `--layout--content-max` / `--content-narrow` / page-pad
 * ↔ src/global-styles/seams.md — `rail↔mainBody` (WikiShell padded reading/full)
 * ↔ src/components/wiki-shell — `contentWidth` implemented with this module
 * ↔ src/lab/pages/page-width.tsx — Lab matrix
 */
import type { HTMLAttributes, ReactNode } from "react";
import styles from "./styles.module.scss";

export type PageWidthMode = "reading" | "full" | "narrow";

export type PageWidthProps = {
  /** Default `reading` (`--layout--content-max`). */
  width?: PageWidthMode;
  /** Apply `--layout--page-pad-*`. Off by default to avoid double-pad. */
  padded?: boolean;
  children?: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">;

export function PageWidth({
  width = "reading",
  padded = false,
  children,
  className,
  ...rest
}: PageWidthProps) {
  const merged = [
    styles.root,
    styles[width],
    padded ? styles.padded : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={merged} {...rest}>
      {children}
    </div>
  );
}

/** For hosts that compose classes without mounting `<PageWidth>` (rare). */
export const pageWidthStyles = styles;
