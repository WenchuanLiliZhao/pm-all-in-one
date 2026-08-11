/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DropdownMenu Trigger — opens/closes the menu; supports asChild merge onto a native button.
 */

import React, { useRef, useEffect } from "react";
import { useDropdownMenuContext } from "./context";
import type { DropdownMenuTriggerProps } from "../types";

export const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({
  children,
  asChild = false,
  className,
}) => {
  const context = useDropdownMenuContext();
  const {
    isOpen,
    toggleMenu,
    scheduleClose,
    cancelScheduledClose,
    disabled,
    level,
    setTriggerRef,
  } = context;

  const triggerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setTriggerRef(triggerRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) return;

    if (level === 0) {
      toggleMenu();
    }
  };

  const handleMouseEnter = () => {
    if (disabled) return;

    if (level > 0) {
      cancelScheduledClose();

      if (!isOpen) {
        toggleMenu();
      }
    }
  };

  const handleMouseLeave = () => {
    if (disabled) return;

    if (level > 0 && isOpen) {
      scheduleClose(150);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    }

    if (event.key === "ArrowDown" && !isOpen) {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    }

    if (event.key === "ArrowRight" && level > 0 && !isOpen) {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    }

    if (event.key === "ArrowLeft" && level > 0 && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    }
  };

  const buttonProps = {
    ref: triggerRef as React.RefObject<HTMLButtonElement>,
    type: "button" as const,
    className,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    "aria-haspopup": "true" as const,
    "data-state": isOpen ? "open" : "closed",
    "data-disabled": disabled,
    "data-level": level,
    disabled,
    children,
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: triggerRef,
      onClick: (e: React.MouseEvent) => {
        handleClick(e);
        (children as any).props?.onClick?.(e);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        handleKeyDown(e);
        (children as any).props?.onKeyDown?.(e);
      },
      onMouseEnter: (e: React.MouseEvent) => {
        handleMouseEnter();
        (children as any).props?.onMouseEnter?.(e);
      },
      onMouseLeave: (e: React.MouseEvent) => {
        handleMouseLeave();
        (children as any).props?.onMouseLeave?.(e);
      },
      "aria-haspopup": "true",
      "aria-expanded": isOpen ? "true" : "false",
      "data-state": isOpen ? "open" : "closed",
      "data-disabled": disabled,
      "data-level": level,
    });
  }

  return isOpen ? (
    <button {...buttonProps} aria-expanded="true" />
  ) : (
    <button {...buttonProps} aria-expanded="false" />
  );
};

DropdownMenuTrigger.displayName = "DropdownMenuTrigger";
