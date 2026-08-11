/**
 * Dropdown Menu Custom Hooks
 *
 * Provides utility hooks for positioning, click outside detection, etc.
 */

import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useState, useCallback } from "react";

// ============ TYPES ============

interface PositionOptions {
  side: "top" | "bottom" | "left" | "right";
  align: "start" | "center" | "end";
  sideOffset: number;
  avoidCollisions?: boolean;
  /** Viewport point used as a 0×0 trigger rect (context-menu style). */
  anchorPoint?: { x: number; y: number } | null;
}

interface Position {
  x: number;
  y: number;
}

// ============ HOOKS ============

/**
 * Hook to calculate position of content relative to trigger
 * Includes boundary detection to keep content within viewport
 */
export function usePosition(
  triggerRef: RefObject<HTMLElement | null> | null,
  contentRef: RefObject<HTMLElement | null> | null,
  isOpen: boolean,
  options: PositionOptions,
): Position {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

  const {
    side,
    align,
    sideOffset,
    avoidCollisions = true,
    anchorPoint = null,
  } = options;
  const anchorX = anchorPoint?.x;
  const anchorY = anchorPoint?.y;
  const hasAnchor =
    typeof anchorX === "number" && typeof anchorY === "number";

  useLayoutEffect(() => {
    if (!isOpen || !contentRef?.current) return;
    if (!hasAnchor && !triggerRef?.current) return;

    const calculatePosition = () => {
      const triggerRect = hasAnchor
        ? ({
            left: anchorX,
            right: anchorX,
            top: anchorY,
            bottom: anchorY,
            width: 0,
            height: 0,
            x: anchorX,
            y: anchorY,
          } as DOMRect)
        : triggerRef!.current!.getBoundingClientRect();
      const contentRect = contentRef.current!.getBoundingClientRect();

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 8;

      let x = 0;
      let y = 0;
      let currentSide = side;
      let currentAlign = align;

      if (avoidCollisions) {
        if (side === "top" || side === "bottom") {
          const fitsBottom =
            triggerRect.bottom + contentRect.height + sideOffset <=
            viewportHeight - padding;
          const fitsTop =
            triggerRect.top - contentRect.height - sideOffset >= padding;

          if (side === "bottom" && !fitsBottom && fitsTop) {
            currentSide = "top";
          } else if (side === "top" && !fitsTop && fitsBottom) {
            currentSide = "bottom";
          }

          if (align === "start") {
            const fitsStart =
              triggerRect.left + contentRect.width <= viewportWidth - padding;
            const fitsEnd = triggerRect.right - contentRect.width >= padding;
            if (!fitsStart && fitsEnd) currentAlign = "end";
          } else if (align === "end") {
            const fitsEnd = triggerRect.right - contentRect.width >= padding;
            const fitsStart =
              triggerRect.left + contentRect.width <= viewportWidth - padding;
            if (!fitsEnd && fitsStart) currentAlign = "start";
          }
        } else {
          const fitsRight =
            triggerRect.right + contentRect.width + sideOffset <=
            viewportWidth - padding;
          const fitsLeft =
            triggerRect.left - contentRect.width - sideOffset >= padding;

          if (side === "right" && !fitsRight && fitsLeft) {
            currentSide = "left";
          } else if (side === "left" && !fitsLeft && fitsRight) {
            currentSide = "right";
          }

          if (align === "start") {
            const fitsStart =
              triggerRect.top + contentRect.height <= viewportHeight - padding;
            const fitsEnd = triggerRect.bottom - contentRect.height >= padding;
            if (!fitsStart && fitsEnd) currentAlign = "end";
          } else if (align === "end") {
            const fitsEnd = triggerRect.bottom - contentRect.height >= padding;
            const fitsStart =
              triggerRect.top + contentRect.height <= viewportHeight - padding;
            if (!fitsEnd && fitsStart) currentAlign = "start";
          }
        }
      }

      switch (currentSide) {
        case "bottom":
          y = triggerRect.bottom + sideOffset;
          break;
        case "top":
          y = triggerRect.top - contentRect.height - sideOffset;
          break;
        case "right":
          x = triggerRect.right + sideOffset;
          break;
        case "left":
          x = triggerRect.left - contentRect.width - sideOffset;
          break;
      }

      if (currentSide === "top" || currentSide === "bottom") {
        switch (currentAlign) {
          case "start":
            x = triggerRect.left;
            break;
          case "center":
            x = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
            break;
          case "end":
            x = triggerRect.right - contentRect.width;
            break;
        }
      } else {
        switch (currentAlign) {
          case "start":
            y = triggerRect.top;
            break;
          case "center":
            y = triggerRect.top + (triggerRect.height - contentRect.height) / 2;
            break;
          case "end":
            y = triggerRect.bottom - contentRect.height;
            break;
        }
      }

      if (x < padding) {
        x = padding;
      } else if (x + contentRect.width > viewportWidth - padding) {
        x = viewportWidth - contentRect.width - padding;
      }

      if (y < padding) {
        y = padding;
      } else if (y + contentRect.height > viewportHeight - padding) {
        y = viewportHeight - contentRect.height - padding;
      }

      setPosition({ x, y });
    };

    calculatePosition();

    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition, true);

    return () => {
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition, true);
    };
  }, [
    isOpen,
    triggerRef,
    contentRef,
    side,
    align,
    sideOffset,
    avoidCollisions,
    hasAnchor,
    anchorX,
    anchorY,
  ]);

  return position;
}

/**
 * Hook to detect clicks outside of element(s)
 * Note: refs array should be stable (not recreated on every render)
 */
export function useClickOutside(
  refs: (RefObject<HTMLElement | null> | null)[],
  handler: () => void,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      for (const ref of refs) {
        if (ref?.current && ref.current.contains(target)) {
          return;
        }
      }

      handler();
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, handler]);
}

/**
 * Hook to handle escape key press
 */
export function useEscapeKey(handler: () => void, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handler();
      }
    };

    document.addEventListener("keydown", listener);

    return () => {
      document.removeEventListener("keydown", listener);
    };
  }, [handler, enabled]);
}

/**
 * Hook to prevent body scroll when menu is open (modal mode)
 */
export function usePreventScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [enabled]);
}

/**
 * Hook to manage controllable state (can be controlled or uncontrolled)
 */
export function useControllableState<T>(
  controlledValue: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): [T, (value: T) => void] {
  const [internalValue, setInternalValue] = useState<T>(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const setValue = useCallback(
    (newValue: T) => {
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
    },
    [isControlled, onChange],
  );

  return [value, setValue];
}

/**
 * Hook to track focus within element
 */
export function useFocusWithin(ref: RefObject<HTMLElement | null> | null): boolean {
  const [isFocusWithin, setIsFocusWithin] = useState(false);

  useEffect(() => {
    if (!ref?.current) return;

    const element = ref.current;

    const handleFocusIn = () => setIsFocusWithin(true);
    const handleFocusOut = (event: FocusEvent) => {
      if (!element.contains(event.relatedTarget as Node)) {
        setIsFocusWithin(false);
      }
    };

    element.addEventListener("focusin", handleFocusIn);
    element.addEventListener("focusout", handleFocusOut);

    return () => {
      element.removeEventListener("focusin", handleFocusIn);
      element.removeEventListener("focusout", handleFocusOut);
    };
  }, [ref]);

  return isFocusWithin;
}
