/**
 * Prebuilt menu row with embedded ToggleSwitch (does not close menu on toggle).
 *
 * ↔ components/ui/toggle-switch — switch control
 * ↔ components/ui/hover-overlay — row overlay
 */
import type { FC, KeyboardEvent, MouseEvent } from "react";
import { HoverOverlay } from "@/components/ui/hover-overlay";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import type { DropdownMenuItemWithSwitchProps } from "../types";
import styles from "../styles.module.scss";
import { useDropdownMenuContext } from "./context";
import { DropdownMenuItem } from "./item";

export const ItemWithSwitch: FC<DropdownMenuItemWithSwitchProps> = ({
  label,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}) => {
  const { isItemVisible } = useDropdownMenuContext();

  if (!isItemVisible(label)) return null;

  const itemClassName = [styles["dropdown-menu-item-with-switch"], className]
    .filter(Boolean)
    .join(" ");

  const stopMenuClose = (
    event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onCheckedChange(!checked);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onCheckedChange(!checked);
  };

  const stopPropagation = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={stopMenuClose}
      onKeyDown={handleKeyDown}
      className={itemClassName}
    >
      <div onClick={stopPropagation} onKeyDown={stopPropagation}>
        <ToggleSwitch
          label={label}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </div>
      {!disabled ? (
        <HoverOverlay
          className={styles["dropdown-menu-item-with-switch__overlay"]}
        />
      ) : null}
    </DropdownMenuItem>
  );
};

ItemWithSwitch.displayName = "DropdownMenuItemWithSwitch";
