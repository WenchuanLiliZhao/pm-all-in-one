// ↔ types.ts — MarkdownPlugin shape (transform / components / schemes / fences)
// ↔ markdown-preview.tsx — sole Reading View consumer of these merges

import type { Components } from "react-markdown";
import type { MarkdownFencePlugin, MarkdownPlugin } from "./types";

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
 * (plugins win on key collision). Callers that own `pre` / `a` / `img` must
 * re-apply those factories after this merge so plugins cannot steal mermaid,
 * `assets/` cards, or resolved images.
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

/**
 * Merge fence lang claims. First info-string token, lowercased.
 * Duplicate `lang` is a load-time error.
 */
export function mergeFenceRegistry(
  plugins: MarkdownPlugin[] | undefined,
): Map<string, MarkdownFencePlugin> {
  const map = new Map<string, MarkdownFencePlugin>();
  if (!plugins?.length) {
    return map;
  }
  for (const plugin of plugins) {
    for (const fence of plugin.fences ?? []) {
      const lang = fence.lang.trim().toLowerCase();
      if (!lang) {
        throw new Error("MarkdownPlugin fence lang must be non-empty");
      }
      if (map.has(lang)) {
        throw new Error(`Duplicate MarkdownPlugin fence lang: ${lang}`);
      }
      map.set(lang, { ...fence, lang });
    }
  }
  return map;
}
