/**
 * Base menu row — accepts arbitrary children; closes menu on select.
 * Ignores clicks on nested `button` / interactive controls.
 */
import {
  forwardRef,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { DropdownMenuItemProps } from "../types";
import styles from "../styles.module.scss";
import { useDropdownMenuContext } from "./context";

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  (
    {
      children,
      disabled = false,
      onSelect,
      filterText,
      className,
      onClick,
      onKeyDown,
      ...rest
    },
    ref,
  ) => {
    const { closeMenu, isItemVisible } = useDropdownMenuContext();

    if (!isItemVisible(filterText)) return null;

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onClick?.(event);
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, button, a, [role='switch']")) {
        return;
      }

      onSelect?.(event);
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      onKeyDown?.(event);
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!event.defaultPrevented) {
          onSelect?.(event);
          closeMenu();
        }
      }
    };

    const itemClassName = [
      styles["dropdown-menu-item"],
      disabled && styles["dropdown-menu-item--disabled"],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        ref={ref}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        className={itemClassName}
        data-disabled={disabled ? "true" : "false"}
        aria-disabled={disabled ? "true" : "false"}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

DropdownMenuItem.displayName = "DropdownMenuItem";
