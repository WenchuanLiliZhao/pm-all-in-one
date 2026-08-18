// ↔ elements/image/live.ts — figure / attachment widgets
// ↔ elements/link/live.ts — assets/ links → attachment cards
// ↔ extensions/live-preview.ts — facet provided with Live options
// ↔ types.ts — LocalMediaProps on MarkdownEditor + MarkdownPreview

import { Facet } from "@codemirror/state";
import { renderInlineMarkdownFragment } from "./inline-fragment";

/** Host-supplied media hooks (product resolves pm-asset / file URLs). */
export type LocalMediaOptions = {
  /** Map SoT src (e.g. assets/a.png) to a loadable URL. */
  resolveMediaUrl?: (src: string) => string;
};

export const localMediaFacet = Facet.define<
  LocalMediaOptions,
  LocalMediaOptions
>({
  combine: (values) => Object.assign({}, ...values),
});

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

/** `assets/foo.png` or `assets/foo%20bar.png` — basename only, no traversal. */
export function isNodeAssetRelUrl(src: string): boolean {
  const s = unwrapAssetSrc(src);
  if (!s.startsWith("assets/")) return false;
  const rest = s.slice("assets/".length);
  if (!rest) return false;
  const decoded = decodeAssetPiece(rest);
  if (
    decoded.includes("/") ||
    decoded.includes("\\") ||
    decoded.includes("\0") ||
    decoded === "." ||
    decoded === ".."
  ) {
    return false;
  }
  return true;
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
  let s = unwrapAssetSrc(src);
  if (s.startsWith("assets/")) s = s.slice("assets/".length);
  else {
    const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
    if (i >= 0) s = s.slice(i + 1);
  }
  return decodeAssetPiece(s);
}

/** SoT cite for a written assets/ basename (spaces → %20). */
export function markdownCiteForAssetBasename(filename: string): string {
  const safe = filename.trim();
  const stem = safe.replace(/\.[^.]+$/, "") || safe;
  const encoded = encodeURIComponent(safe);
  if (isEmbeddableImageUrl(safe)) {
    return `![${stem}](assets/${encoded})`;
  }
  return `[${stem}](assets/${encoded})`;
}

/** Build idle attachment card DOM (PDF / zip / non-embed `![]`). */
export function createAttachmentCardEl(
  src: string,
  label: string,
): HTMLElement {
  const card = document.createElement("span");
  card.className = "cm-md-asset-card";
  card.setAttribute("data-media-src", src);

  const name = label.trim() || assetBasename(src) || "file";
  const ext = (() => {
    const base = assetBasename(src);
    const dot = base.lastIndexOf(".");
    return dot >= 0 ? base.slice(dot + 1).toUpperCase() : "FILE";
  })();

  const badge = document.createElement("span");
  badge.className = "cm-md-asset-card-ext";
  badge.textContent = ext;

  const title = document.createElement("span");
  title.className = "cm-md-asset-card-title";
  const html = renderInlineMarkdownFragment(name);
  if (html) title.innerHTML = html;
  else title.textContent = name;

  card.appendChild(badge);
  card.appendChild(title);
  return card;
}

/** Build idle figure DOM for embeddable images. */
export function createFigureEl(
  resolvedSrc: string,
  sotSrc: string,
  caption: string,
): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "cm-md-image";
  figure.setAttribute("data-media-src", sotSrc);

  const img = document.createElement("img");
  img.className = "cm-md-image-el";
  img.src = resolvedSrc;
  img.alt = caption;
  img.loading = "lazy";

  const captionTrim = caption.trim();
  img.addEventListener("error", () => {
    figure.classList.add("cm-md-image-broken");
    img.remove();
    const stub = createAttachmentCardEl(sotSrc, captionTrim || "broken image");
    stub.classList.add("cm-md-image-stub");
    figure.appendChild(stub);
  });

  figure.appendChild(img);

  if (captionTrim) {
    const cap = document.createElement("figcaption");
    cap.className = "cm-md-image-caption";
    cap.innerHTML = renderInlineMarkdownFragment(captionTrim);
    figure.appendChild(cap);
  }

  return figure;
}

export function mediaThemeSpec(): Record<string, Record<string, string>> {
  return {
    ".cm-md-image": {
      display: "block",
      width: "100%",
      maxWidth: "100%",
      margin: "0.45em 0",
    },
    ".cm-md-image-el": {
      display: "block",
      width: "100%",
      maxWidth: "100%",
      height: "auto",
      objectFit: "contain",
      borderRadius: "4px",
    },
    ".cm-md-image-caption": {
      display: "block",
      marginTop: "0.35em",
      fontSize: "0.9em",
      color: "var(--color-use--text-secondary)",
      lineHeight: "1.35",
    },
    ".cm-md-image-caption code": {
      fontSize: "0.92em",
      backgroundColor: "var(--color-use--bg-darken)",
      padding: "0 0.25em",
      borderRadius: "3px",
    },
    ".cm-md-asset-card": {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.45em",
      maxWidth: "100%",
      padding: "0.35em 0.55em",
      margin: "0.2em 0",
      backgroundColor: "var(--color-use--bg-darken)",
      border: "1px solid var(--color-use--border-prime-hex)",
      borderRadius: "6px",
      verticalAlign: "middle",
      fontSize: "0.92em",
      color: "var(--color-use--text-prime)",
    },
    ".cm-md-asset-card-ext": {
      flex: "0 0 auto",
      fontSize: "0.75em",
      fontWeight: "650",
      letterSpacing: "0.02em",
      color: "var(--color-use--text-secondary)",
      backgroundColor: "var(--color-use--bg-prime-hex)",
      border: "1px solid var(--color-use--border-emphasis-hex)",
      borderRadius: "4px",
      padding: "0.1em 0.35em",
    },
    ".cm-md-asset-card-title": {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    ".cm-md-asset-card-title code": {
      fontSize: "0.92em",
      backgroundColor: "var(--color-use--bg-prime-hex)",
      padding: "0 0.25em",
      borderRadius: "3px",
    },
    ".cm-md-image-stub": {
      display: "inline-flex",
    },
  };
}
