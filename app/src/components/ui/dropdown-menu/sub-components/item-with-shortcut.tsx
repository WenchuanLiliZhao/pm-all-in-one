/**
 * Prebuilt menu row with icon, label, and keyboard shortcut hint.
 *
 * ↔ components/ui/hover-overlay — row overlay
 */
import type { FC } from "react";
import { HoverOverlay } from "@/components/ui/hover-overlay";
import type { DropdownMenuItemWithShortcutProps } from "../types";
import styles from "../styles.module.scss";
import { useDropdownMenuContext } from "./context";
import { DropdownMenuItem } from "./item";

export const ItemWithShortcut: FC<DropdownMenuItemWithShortcutProps> = ({
  label,
  icon,
  shortcut,
  disabled = false,
  onSelect,
  className,
}) => {
  const { isItemVisible } = useDropdownMenuContext();

  if (!isItemVisible(label)) return null;

  const itemClassName = [styles["dropdown-menu-item-with-shortcut"], className]
    .filter(Boolean)
    .join(" ");

  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={onSelect}
      className={itemClassName}
    >
      <div className={styles["dropdown-menu-item-with-shortcut__content"]}>
        {icon ? (
          <span className={styles["dropdown-menu-item-with-shortcut__icon"]}>
            {icon}
          </span>
        ) : null}
        <span className={styles["dropdown-menu-item-with-shortcut__label"]}>
          {label}
        </span>
      </div>
      <kbd className={styles["dropdown-menu-item-with-shortcut__shortcut"]}>
        {shortcut}
      </kbd>
      {!disabled ? (
        <HoverOverlay
          className={styles["dropdown-menu-item-with-shortcut__overlay"]}
        />
      ) : null}
    </DropdownMenuItem>
  );
};

ItemWithShortcut.displayName = "DropdownMenuItemWithShortcut";
