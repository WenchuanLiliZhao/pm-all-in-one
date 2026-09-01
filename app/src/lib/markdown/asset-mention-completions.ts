// ↔ src/components/markdown-editor/autocomplete/mention.ts — generic @ shell
// ↔ ./node-local-media.ts — withAssetFolderMentions merges into node editors
// ↔ src/components/markdown-editor/asset-url.ts — encodeAssetRelPath

import type { MentionAutocompleteCandidate } from "@/components/markdown-editor";
import { encodeAssetRelPath } from "../../components/markdown-editor/asset-url.ts";

const PREFIX = "@assets/";

/** This-node folder mention: `@assets/<relpath>` (per-segment encoded). */
export function assetFolderMentionSyntax(relPath: string): string {
  const rel = relPath.replace(/\\/g, "/").replace(/\/+$/, "");
  return `${PREFIX}${encodeAssetRelPath(rel)}`;
}

export function parseAssetFolderMentionToken(token: string): string | null {
  const t = token.trim();
  if (!t.startsWith(PREFIX)) return null;
  const rest = t.slice(PREFIX.length).replace(/\/+$/, "");
  if (!rest) return null;
  const decoded: string[] = [];
  for (const raw of rest.split("/")) {
    if (!raw) return null;
    let piece = raw;
    try {
      piece = decodeURIComponent(raw);
    } catch {
      /* keep */
    }
    if (
      !piece ||
      piece === "." ||
      piece === ".." ||
      piece.includes("/") ||
      piece.includes("\\") ||
      piece.includes("\0")
    ) {
      return null;
    }
    decoded.push(piece);
  }
  return decoded.join("/");
}

/** Folders from `listNodeAssets` (entries ending in `/`). */
export function toAssetFolderMentionCandidates(
  relPaths: string[],
): MentionAutocompleteCandidate[] {
  const seen = new Set<string>();
  const out: MentionAutocompleteCandidate[] = [];
  for (const raw of relPaths) {
    if (!raw.endsWith("/")) continue;
    const rel = raw.replace(/\/+$/, "");
    if (!rel || seen.has(rel)) continue;
    seen.add(rel);
    const leaf = rel.split("/").pop() ?? rel;
    out.push({
      id: `asset-dir:${rel}`,
      label: leaf,
      secondary: `folder · ${rel}/`,
      insertText: assetFolderMentionSyntax(rel),
    });
  }
  return out;
}
