/**
 * DropdownMenu root — open state, nesting level, filter, and shared context.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type RefObject,
} from "react";
import type { DropdownMenuFilterOptions, DropdownMenuProps } from "../types";
import { DropdownMenuProvider, useOptionalDropdownMenuContext } from "./context";
import { useControllableState } from "./hooks";
import { isMenuItemVisible } from "./menu-filter";

function resolveFilterConfig(
  filter: DropdownMenuProps["filter"],
): DropdownMenuFilterOptions | null {
  if (!filter) return null;
  if (filter === true) return {};
  return filter;
}

export const DropdownMenuRoot: FC<DropdownMenuProps> = ({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  modal: _modal = false,
  filter,
}) => {
  const [isOpen, setIsOpen] = useControllableState(
    controlledOpen,
    defaultOpen,
    onOpenChange,
  );
  const filterConfig = resolveFilterConfig(filter);
  const filterEnabled = Boolean(filterConfig);
  const filterPlaceholder = filterConfig?.placeholder ?? "Filter…";
  const [filterQuery, setFilterQuery] = useState("");

  const [triggerRef, setTriggerRef] = useState<
    RefObject<HTMLElement | null> | null
  >(null);
  const [contentRef, setContentRef] = useState<
    RefObject<HTMLElement | null> | null
  >(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) setFilterQuery("");
  }, [isOpen]);

  const parentContext = useOptionalDropdownMenuContext();
  const level = parentContext ? parentContext.level + 1 : 0;

  const closeMenu = useCallback(() => {
    if (!disabled) setIsOpen(false);
  }, [disabled, setIsOpen]);

  const toggleMenu = useCallback(() => {
    if (!disabled) setIsOpen(!isOpen);
  }, [disabled, isOpen, setIsOpen]);

  const scheduleClose = useCallback(
    (delay = 150) => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => {
        closeMenu();
        closeTimerRef.current = null;
      }, delay);
    },
    [closeMenu],
  );

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const isItemVisible = useCallback(
    (filterText?: string) =>
      isMenuItemVisible(filterEnabled, filterQuery, filterText),
    [filterEnabled, filterQuery],
  );

  const contextValue = useMemo(
    () => ({
      isOpen,
      closeMenu,
      toggleMenu,
      scheduleClose,
      cancelScheduledClose,
      disabled,
      level,
      triggerRef,
      contentRef,
      setTriggerRef,
      setContentRef,
      filterEnabled,
      filterQuery,
      setFilterQuery,
      filterPlaceholder,
      isItemVisible,
    }),
    [
      isOpen,
      closeMenu,
      toggleMenu,
      scheduleClose,
      cancelScheduledClose,
      disabled,
      level,
      triggerRef,
      contentRef,
      filterEnabled,
      filterQuery,
      filterPlaceholder,
      isItemVisible,
    ],
  );

  return (
    <DropdownMenuProvider value={contextValue}>{children}</DropdownMenuProvider>
  );
};

DropdownMenuRoot.displayName = "DropdownMenu";
