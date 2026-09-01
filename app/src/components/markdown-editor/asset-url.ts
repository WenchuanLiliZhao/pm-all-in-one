/**
 * Node-local `assets/…` cite parse / encode. No CodeMirror — safe for node:test.
 *
 * ↔ ./local-media.ts — widgets + facet re-export these
 * ↔ ./autocomplete/asset.ts — encodeAssetRelPath
 * ↔ ./asset-url.test.ts
 */

const EMBED_IMAGE_EXT =
  /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i;

function unwrapAssetSrc(src: string): string {
  let s = src.trim();
  if (s.startsWith("<") && s.endsWith(">")) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function decodeAssetPiece(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Decode a node-local `assets/…` cite to a posix relative path.
 * Nested segments are allowed; `..`, empty, and `%2F` in a segment are not.
 */
export function assetRelPath(src: string): string | null {
  const s = unwrapAssetSrc(src);
  if (!s.startsWith("assets/")) return null;
  const rest = s.slice("assets/".length);
  if (!rest) return null;
  const rawParts = rest.split("/");
  const trailingSlash = rawParts[rawParts.length - 1] === "";
  if (trailingSlash) rawParts.pop();
  if (rawParts.length === 0) return null;
  const decoded: string[] = [];
  for (const raw of rawParts) {
    if (!raw) return null;
    const piece = decodeAssetPiece(raw);
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

/** `assets/foo.png` or `assets/folder/foo%20bar.png` — no traversal. */
export function isNodeAssetRelUrl(src: string): boolean {
  return assetRelPath(src) !== null;
}

/** Encode a posix relative path for a Markdown `(assets/…)` destination. */
export function encodeAssetRelPath(relPath: string): string {
  const slash = relPath.replace(/\\/g, "/");
  const trailing = slash.endsWith("/");
  const encoded = slash
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return trailing ? `${encoded}/` : encoded;
}

export function isEmbeddableImageUrl(src: string): boolean {
  const raw = unwrapAssetSrc(src);
  // Remote URLs: try as image (error handler → card). Path may lack a file ext.
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:image/")) {
    return true;
  }
  const pathOnly = raw.split("?")[0]?.split("#")[0] ?? raw;
  return EMBED_IMAGE_EXT.test(decodeAssetPiece(pathOnly));
}

export function assetBasename(src: string): string {
  const rel = assetRelPath(src);
  if (rel) {
    const i = rel.lastIndexOf("/");
    return i >= 0 ? rel.slice(i + 1) : rel;
  }
  let s = unwrapAssetSrc(src);
  const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  if (i >= 0) s = s.slice(i + 1);
  return decodeAssetPiece(s);
}

/** SoT cite for a written assets/ relative path (per-segment encode). */
export function markdownCiteForAssetBasename(filename: string): string {
  const safe = filename.trim().replace(/\\/g, "/");
  const leaf =
    safe.split("/").filter(Boolean).pop() ?? safe.replace(/^.*\//, "");
  const stem = leaf.replace(/\.[^.]+$/, "") || leaf;
  const encoded = encodeAssetRelPath(safe);
  if (safe.endsWith("/") || safe.endsWith("\\")) {
    return `[${stem}](assets/${encoded.endsWith("/") ? encoded : `${encoded}/`})`;
  }
  if (isEmbeddableImageUrl(leaf)) {
    return `![${stem}](assets/${encoded})`;
  }
  return `[${stem}](assets/${encoded})`;
}
