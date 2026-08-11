/**
 * Compound DropdownMenu — local port of ui-system general/dropdown-menu.
 *
 * Lab matrix: `src/lab/pages/dropdown-menu.tsx`
 * ↔ components/member-person — MemberPersonSelect uses Trigger asChild + Item rows
 * ↔ components/wiki-shell — Contents row / Add menus (Trigger asChild + ItemButton)
 * ↔ pages/.../roadmap — date context menu via Content `anchorPoint`
 * ↔ components/ui/hover-overlay — prebuilt row overlays
 * ↔ components/ui/toggle-switch — ItemWithSwitch
 * ↔ lab/pages/dropdown-menu.tsx — state matrix for this module
 */
import { DropdownMenuContent } from "./sub-components/content";
import { DropdownMenuGroup } from "./sub-components/group";
import { ItemButton } from "./sub-components/item-button";
import { DropdownMenuItem } from "./sub-components/item";
import { ItemWithShortcut } from "./sub-components/item-with-shortcut";
import { ItemWithSwitch } from "./sub-components/item-with-switch";
import { DropdownMenuLabel } from "./sub-components/label";
import { DropdownMenuRoot } from "./sub-components/root";
import { DropdownMenuSeparator } from "./sub-components/separator";
import { DropdownMenuTrigger } from "./sub-components/trigger";

export {
  useDropdownMenuContext,
  useOptionalDropdownMenuContext,
} from "./sub-components/context";

export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Group: DropdownMenuGroup,
  Separator: DropdownMenuSeparator,
  Label: DropdownMenuLabel,
  ItemButton,
  ItemWithShortcut,
  ItemWithSwitch,
});

export type {
  DropdownMenuProps,
  DropdownMenuTriggerProps,
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuGroupProps,
  DropdownMenuLabelProps,
  DropdownMenuSeparatorProps,
  DropdownMenuItemButtonProps,
  DropdownMenuItemWithShortcutProps,
  DropdownMenuItemWithSwitchProps,
  DropdownMenuFilterOptions,
  DropdownMenuContextValue,
} from "./types";
