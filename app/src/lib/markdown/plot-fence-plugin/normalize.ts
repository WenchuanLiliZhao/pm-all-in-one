import type { CalcKitSpec } from "./vendor/calc-kit.js";

/** Lab / early wiki fences used these names; calc-kit reads the right-hand keys. */
const ALIASES: Record<string, string> = {
  expression: "f",
  steps: "n",
  bounds: "range",
};

export function normalizePlotSpec(
  raw: Record<string, unknown>,
): CalcKitSpec {
  const spec: Record<string, unknown> = { ...raw };
  for (const [from, to] of Object.entries(ALIASES)) {
    if (spec[to] == null && spec[from] != null) {
      spec[to] = spec[from];
    }
  }
  return spec as CalcKitSpec;
}
