/**
 * Material Symbols Outlined as `MaterialIcon.<Name>` — self-contained port of
 * ui-system MaterialIcon (SidebarTree.Action uses `MaterialIcon.MoreHoriz`).
 */
import type { HTMLAttributes, ReactElement } from "react";
import { resolveIconComponent } from "./sub-components/create-icon-component";

export type MaterialIconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** Pixel `fontSize` on the 1em box. */
  size?: number;
  /** Material Symbols `wght` axis. Default `300`. */
  weight?: number;
  /** Material Symbols `FILL` axis (`1` = filled, `0` = outlined). Default `false`. */
  fill?: boolean;
  /** Material Symbols `opsz` axis; defaults to `size` when set, otherwise `24`. */
  opsz?: number;
};

export type MaterialIconComponent = (props: MaterialIconProps) => ReactElement;

export const MaterialIcon = new Proxy(
  {} as Record<string, MaterialIconComponent>,
  {
    get(_target, prop) {
      if (typeof prop !== "string" || prop === "then" || !/^[A-Z]/.test(prop)) {
        return undefined;
      }

      return resolveIconComponent(prop);
    },
  },
);
