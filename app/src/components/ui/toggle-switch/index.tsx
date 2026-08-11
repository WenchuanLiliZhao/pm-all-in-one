/**
 * Binary on/off control with optional label.
 * Used standalone or inside DropdownMenu.ItemWithSwitch.
 *
 * ↔ components/ui/dropdown-menu/sub-components/item-with-switch.tsx — menu row host
 * ↔ components/ui/hover-overlay — track overlay
 * ↔ lab/pages/dropdown-menu.tsx — exercised via ItemWithSwitch matrix
 * ↔ lab/pages/toggle-switch.tsx — standalone matrix
 */
import type { FC, KeyboardEvent } from "react";
import { HoverOverlay } from "@/components/ui/hover-overlay";
import styles from "./styles.module.scss";

export type ToggleSwitchProps = {
  label?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export const ToggleSwitch: FC<ToggleSwitchProps> = ({
  label,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}) => {
  const containerClassName = [styles["toggle-switch"], className]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => {
    if (!disabled) onCheckedChange(!checked);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || event.key !== " ") return;
    event.preventDefault();
    onCheckedChange(!checked);
  };

  const ariaLabel = label ?? "Toggle switch";

  return (
    <div className={containerClassName}>
      {label ? (
        <span className={styles["toggle-switch__label"]}>{label}</span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        className={styles["toggle-switch__switch"]}
        data-state={checked ? "checked" : "unchecked"}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <span className={styles["toggle-switch__thumb"]} />
        <HoverOverlay
          className={styles["toggle-switch__overlay"]}
          disabled={disabled}
        />
      </button>
    </div>
  );
};
