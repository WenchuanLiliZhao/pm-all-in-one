// ↔ types.ts — MarkdownPlugin shape
// ↔ markdown-preview.tsx — sole Reading View consumer of these merges

import type { Components } from "react-markdown";
import type { MarkdownPlugin } from "./types";

export function applyTransforms(
  source: string,
  plugins: MarkdownPlugin[] | undefined,
): string {
  if (!plugins?.length) {
    return source;
  }
  return plugins.reduce(
    (acc, plugin) => plugin.transformSource?.(acc) ?? acc,
    source,
  );
}

/**
 * Merge Reading View components: core element defaults first, then plugins
 * (plugins win on key collision).
 */
export function mergeComponents(
  plugins: MarkdownPlugin[] | undefined,
  base?: Components,
): Components | undefined {
  const merged: Components = { ...(base ?? {}) };
  if (plugins?.length) {
    for (const plugin of plugins) {
      if (plugin.components) {
        Object.assign(merged, plugin.components);
      }
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/** Lowercased unique schemes from plugins (no trailing `:`). */
export function mergeAllowedUrlSchemes(
  plugins: MarkdownPlugin[] | undefined,
): Set<string> {
  const schemes = new Set<string>();
  if (!plugins?.length) {
    return schemes;
  }
  for (const plugin of plugins) {
    for (const scheme of plugin.allowedUrlSchemes ?? []) {
      const normalized = scheme.trim().toLowerCase().replace(/:$/, "");
      if (normalized) {
        schemes.add(normalized);
      }
    }
  }
  return schemes;
}
