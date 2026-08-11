/**
 * Maps `MaterialIcon.<PascalCaseName>` to Material Symbols ligature text.
 */
export function pascalToLigature(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}
