// ↔ ../local-media.ts — isEmbeddableImageUrl
// ↔ ../markdown-cm-view.tsx — mounts with mention autocomplete (same tooltip)
// ↔ src/lib/markdown/node-local-media.ts — filenames + encodeAssetBasenameForUrl

import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { Facet } from "@codemirror/state";
import { isEmbeddableImageUrl } from "../local-media";

const assetFilenamesFacet = Facet.define<string[], string[]>({
  combine: (values) => values[values.length - 1] ?? [],
});

export { assetFilenamesFacet };

/** Basename query inside `](assets/…` — allow spaces / % until `)`. */
const ASSET_URL_SLOT = /!?\[[^\]]*\]\(assets\/[^)\n]*$/;

function encodeBasename(name: string): string {
  return encodeURIComponent(name.trim());
}

/**
 * Only inside `[](assets/…)` or `![](assets/…)` — complete the basename.
 * Same Codemirror autocomplete chrome as `@` mentions. Writes %-encoded names
 * so spaces work in CommonMark destinations.
 */
export function assetCompletions(
  context: CompletionContext,
): CompletionResult | null {
  const match = context.matchBefore(ASSET_URL_SLOT);
  if (!match) return null;

  const names = context.state.facet(assetFilenamesFacet);
  const assetsIdx = match.text.lastIndexOf("assets/");
  if (assetsIdx < 0) return null;
  const basenameFrom = match.from + assetsIdx + "assets/".length;
  const rawQuery = match.text.slice(assetsIdx + "assets/".length);
  let query = rawQuery.toLowerCase();
  try {
    query = decodeURIComponent(rawQuery).toLowerCase();
  } catch {
    /* keep */
  }

  const filtered = names
    .filter((n) => !query || n.toLowerCase().startsWith(query))
    .slice(0, 50);

  const options: Completion[] = filtered.map((name) => ({
    label: name,
    detail: isEmbeddableImageUrl(name) ? "image" : "file",
    apply: encodeBasename(name),
    type: "text",
  }));

  if (options.length === 0) {
    options.push({
      label: names.length === 0 ? "No assets on this node" : "No matches",
      apply: () => {},
      boost: -99,
    });
  }

  return {
    from: basenameFrom,
    options,
    filter: false,
  };
}
