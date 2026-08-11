/**
 * DropdownMenu Content — portal panel with positioning + optional filter field.
 */
import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDropdownMenuContext } from "./context";
import { DropdownMenuFilterField } from "./filter-field";
import {
  usePosition,
  useClickOutside,
  useEscapeKey,
  usePreventScroll,
} from "./hooks";
import type { DropdownMenuContentProps } from "../types";
import styles from "../styles.module.scss";

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  children,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  avoidCollisions = true,
  container,
  className,
  anchorPoint = null,
  ...rest
}) => {
  const context = useDropdownMenuContext();
  const {
    isOpen,
    closeMenu,
    scheduleClose,
    cancelScheduledClose,
    level,
    triggerRef,
    setContentRef,
    filterEnabled,
    filterQuery,
    setFilterQuery,
  } = context;

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContentRef(contentRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const position = usePosition(triggerRef, contentRef, isOpen, {
    side,
    align,
    sideOffset,
    avoidCollisions,
    anchorPoint,
  });

  const anchorOnly = anchorPoint != null;

  const clickOutsideRefs = useMemo(
    () => (anchorOnly ? [contentRef] : [contentRef, triggerRef]),
    [contentRef, triggerRef, anchorOnly],
  );

  useClickOutside(clickOutsideRefs, closeMenu, isOpen);

  const handleEscape = useCallback(() => {
    if (filterEnabled && filterQuery.trim()) {
      setFilterQuery("");
      return;
    }
    closeMenu();
  }, [filterEnabled, filterQuery, setFilterQuery, closeMenu]);

  useEscapeKey(handleEscape, isOpen);

  usePreventScroll(isOpen && level === 0);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!isOpen || !contentElement) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!contentElement) return;

      const items = Array.from(
        contentElement.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([data-disabled="true"])',
        ),
      );

      if (items.length === 0) return;

      const currentIndex = items.findIndex(
        (item) => item === document.activeElement,
      );

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          const nextIndex =
            currentIndex === items.length - 1 ? 0 : currentIndex + 1;
          items[nextIndex]?.focus();
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          const prevIndex =
            currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
          items[prevIndex]?.focus();
          break;
        }

        case "Home":
          event.preventDefault();
          items[0]?.focus();
          break;

        case "End":
          event.preventDefault();
          items[items.length - 1]?.focus();
          break;
      }
    };

    contentElement.addEventListener("keydown", handleKeyDown);

    return () => {
      contentElement.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (level > 0) {
      cancelScheduledClose();
    }
  };

  const handleMouseLeave = () => {
    if (level > 0) {
      scheduleClose(150);
    }
  };

  if (!isOpen) return null;

  const contentClassName = [
    styles["dropdown-menu-content"],
    styles[`dropdown-menu-content--level-${level}`],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <div
      ref={contentRef}
      className={contentClassName}
      data-state="open"
      data-side={side}
      data-align={align}
      data-level={level}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000 + level,
      }}
      {...rest}
    >
      <div
        role="menu"
        aria-label="Menu"
        aria-orientation="vertical"
        className={styles["dropdown-menu-content__group"]}
      >
        <div
          role="separator"
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
          }}
        />
        {filterEnabled ? <DropdownMenuFilterField /> : null}
        {children}
      </div>
    </div>
  );

  return createPortal(content, container ?? document.body);
};

DropdownMenuContent.displayName = "DropdownMenuContent";
