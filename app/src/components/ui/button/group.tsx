/**
 * Joined Button cluster.
 * `outlined` (default): UI-304 shared 1px stroke, inner radii 0.
 * `flush`: no own stroke — for embedding in existing chrome (editor nav).
 *
 * ↔ button/index.tsx — Button + ButtonGroup barrel
 * ↔ lab/pages/button — group matrix
 */

import type { HTMLAttributes } from "react";
import styles from "./group.module.scss";

export type ButtonGroupAppearance = "outlined" | "flush";

export type ButtonGroupProps = HTMLAttributes<HTMLDivElement> & {
  appearance?: ButtonGroupAppearance;
};

export function ButtonGroup({
  className,
  role = "group",
  appearance = "outlined",
  ...props
}: ButtonGroupProps) {
  return (
    <div
      role={role}
      data-appearance={appearance}
      className={[
        styles.group,
        appearance === "flush" ? styles.groupFlush : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
