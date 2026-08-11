/**
 * Renders one Material Symbols ligature span.
 */
import { createElement } from "react";
import type { MaterialIconProps } from "..";
import styles from "../styles.module.scss";

type IconGlyphProps = MaterialIconProps & {
  ligature: string;
};

export function IconGlyph({
  ligature,
  size,
  weight = 300,
  fill = false,
  opsz,
  className,
  style,
  ...props
}: IconGlyphProps) {
  const resolvedOpsz = opsz ?? size ?? 24;

  return createElement(
    "span",
    {
      ...props,
      className: [styles["material-icon"], className].filter(Boolean).join(" "),
      style: {
        ...(size !== undefined ? { fontSize: size } : {}),
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${resolvedOpsz}`,
        ...style,
      },
    },
    ligature,
  );
}
