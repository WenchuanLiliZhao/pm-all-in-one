/**
 * Builds cached `MaterialIcon.<Name>` components from PascalCase glyph names.
 */
import type { MaterialIconComponent, MaterialIconProps } from "..";
import { IconGlyph } from "./icon-glyph";
import { pascalToLigature } from "./pascal-to-ligature";

const iconComponentCache = new Map<string, MaterialIconComponent>();

function createIconComponent(iconName: string): MaterialIconComponent {
  const ligature = pascalToLigature(iconName);

  function Icon(props: MaterialIconProps) {
    return <IconGlyph ligature={ligature} {...props} />;
  }

  Icon.displayName = `MaterialIcon.${iconName}`;
  return Icon;
}

export function resolveIconComponent(iconName: string): MaterialIconComponent {
  const cached = iconComponentCache.get(iconName);
  if (cached) return cached;

  const created = createIconComponent(iconName);
  iconComponentCache.set(iconName, created);
  return created;
}
