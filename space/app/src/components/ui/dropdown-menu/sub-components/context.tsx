/**
 * DropdownMenu shared context for trigger, content, and nested submenus.
 */
import { createContext, useContext } from "react";
import type { DropdownMenuContextValue } from "../types";

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

export const DropdownMenuProvider = DropdownMenuContext.Provider;

export function useDropdownMenuContext(): DropdownMenuContextValue {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("useDropdownMenuContext must be used within a DropdownMenu component");
  }
  return context;
}

export function useOptionalDropdownMenuContext(): DropdownMenuContextValue | null {
  return useContext(DropdownMenuContext);
}
