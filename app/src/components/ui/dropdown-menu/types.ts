/**
 * DropdownMenu compound component types (local port of ui-system).
 */
import type { HTMLAttributes, ReactNode, RefObject } from "react";

export type DropdownMenuFilterOptions = {
  /** Placeholder and accessible name for the panel filter field. */
  placeholder?: string;
};

export type DropdownMenuProps = {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  modal?: boolean;
  /**
   * When set, renders a filter {@link Input} at the top of the menu panel.
   * Narrows rows that expose filter text (prebuilt `label`, or optional `filterText` on Item).
   */
  filter?: boolean | DropdownMenuFilterOptions;
};

export type DropdownMenuTriggerProps = {
  children: ReactNode;
  asChild?: boolean;
  className?: string;
};

export type DropdownMenuContentProps = {
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  avoidCollisions?: boolean;
  container?: HTMLElement | null;
  className?: string;
  /**
   * Position the panel at a viewport point (e.g. context menu) instead of
   * the trigger rect. When set, trigger is optional — treated as a 0×0
   * anchor at `(x, y)` with the same side/align/collision rules.
   */
  anchorPoint?: { x: number; y: number } | null;
};

export type DropdownMenuItemProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSelect"
> & {
  children: ReactNode;
  disabled?: boolean;
  onSelect?: (
    event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ) => void;
  className?: string;
  /**
   * When the menu `filter` prop is set, only rows with `filterText` are narrowed.
   * Omit to keep a custom Item always visible (e.g. headers).
   */
  filterText?: string;
};

export type DropdownMenuGroupProps = {
  children: ReactNode;
  className?: string;
};

export type DropdownMenuLabelProps = {
  children: ReactNode;
  className?: string;
};

export type DropdownMenuSeparatorProps = {
  className?: string;
};

export type DropdownMenuItemButtonProps = {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  className?: string;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  suggestionRowIndex?: number;
};

export type DropdownMenuItemWithShortcutProps = {
  label: string;
  icon?: ReactNode;
  shortcut: string;
  disabled?: boolean;
  onSelect?: () => void;
  className?: string;
};

export type DropdownMenuItemWithSwitchProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export type DropdownMenuContextValue = {
  isOpen: boolean;
  closeMenu: () => void;
  toggleMenu: () => void;
  scheduleClose: (delay?: number) => void;
  cancelScheduledClose: () => void;
  disabled: boolean;
  level: number;
  triggerRef: RefObject<HTMLElement | null> | null;
  contentRef: RefObject<HTMLElement | null> | null;
  setTriggerRef: (ref: RefObject<HTMLElement | null>) => void;
  setContentRef: (ref: RefObject<HTMLElement | null>) => void;
  filterEnabled: boolean;
  filterQuery: string;
  setFilterQuery: (query: string) => void;
  filterPlaceholder: string;
  isItemVisible: (filterText?: string) => boolean;
};
