/**
 * Non-interactive text label in the menu.
 */
import type { FC } from "react";
import type { DropdownMenuLabelProps } from "../types";
import styles from "../styles.module.scss";

export const DropdownMenuLabel: FC<DropdownMenuLabelProps> = ({
  children,
  className,
}) => {
  const labelClassName = [styles["dropdown-menu-label"], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={labelClassName} role="presentation">
      {children}
    </div>
  );
};

DropdownMenuLabel.displayName = "DropdownMenuLabel";
