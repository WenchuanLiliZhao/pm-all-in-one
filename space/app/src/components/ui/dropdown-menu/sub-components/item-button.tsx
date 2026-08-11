/**
 * Prebuilt menu row with optional leading icon, label, and active check.
 *
 * ↔ components/ui/hover-overlay — row overlay
 */
import type { FC } from "react";
import { HoverOverlay } from "@/components/ui/hover-overlay";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { DropdownMenuItemButtonProps } from "../types";
import styles from "../styles.module.scss";
import { useDropdownMenuContext } from "./context";
import { DropdownMenuItem } from "./item";

export const ItemButton: FC<DropdownMenuItemButtonProps> = ({
  label,
  icon,
  active = false,
  disabled = false,
  onSelect,
  className,
  onMouseEnter,
  suggestionRowIndex,
}) => {
  const { isItemVisible } = useDropdownMenuContext();

  if (!isItemVisible(label)) return null;

  const itemClassName = [
    styles["dropdown-menu-item-button"],
    active && styles["dropdown-menu-item-button--active"],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={onSelect}
      className={itemClassName}
      onMouseEnter={onMouseEnter}
      {...(suggestionRowIndex !== undefined
        ? { "data-suggestion-index": suggestionRowIndex }
        : {})}
    >
      {icon ? (
        <span className={styles["dropdown-menu-item-button__icon"]}>
          {icon}
        </span>
      ) : null}
      <span className={styles["dropdown-menu-item-button__label"]}>{label}</span>
      {active ? (
        <span className={styles["dropdown-menu-item-button__check"]}>
          <MaterialIcon.Check size={16} aria-hidden />
        </span>
      ) : null}
      {!disabled ? (
        <HoverOverlay
          className={styles["dropdown-menu-item-button__overlay"]}
        />
      ) : null}
    </DropdownMenuItem>
  );
};

ItemButton.displayName = "DropdownMenuItemButton";
