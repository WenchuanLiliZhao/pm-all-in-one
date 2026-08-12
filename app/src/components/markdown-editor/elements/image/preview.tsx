// ↔ ./index.ts — imagePreviewComponents
// ↔ ./preview.module.scss
// ↔ ./live.ts — Live twin
// ↔ ../../inline-fragment.ts — caption HTML
// ↔ ../../local-media.ts — embed vs card

import type { Components } from "react-markdown";
import { renderInlineMarkdownFragment } from "../../inline-fragment";
import {
  assetBasename,
  isEmbeddableImageUrl,
} from "../../local-media";
import styles from "./preview.module.scss";

function AttachmentCard({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const name = label.trim() || assetBasename(href) || "file";
  const base = assetBasename(href);
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).toUpperCase() : "FILE";
  const titleHtml = renderInlineMarkdownFragment(name);
  return (
    <span className={styles.card}>
      <span className={styles.cardExt}>{ext}</span>
      {titleHtml ? (
        <span
          className={styles.cardTitle}
          dangerouslySetInnerHTML={{ __html: titleHtml }}
        />
      ) : (
        <span className={styles.cardTitle}>{name}</span>
      )}
    </span>
  );
}

export const imagePreviewComponents: Components = {
  img: ({ className, alt, src, node: _node, ...props }) => {
    const href = typeof src === "string" ? src : "";
    if (href && !isEmbeddableImageUrl(href)) {
      return <AttachmentCard href={href} label={alt ?? ""} />;
    }
    const caption = (alt ?? "").trim();
    const captionHtml = caption
      ? renderInlineMarkdownFragment(caption)
      : "";
    return (
      <figure className={styles.figure}>
        <img
          className={[styles.img, className].filter(Boolean).join(" ")}
          alt={alt ?? ""}
          src={src}
          {...props}
        />
        {captionHtml ? (
          <figcaption
            className={styles.caption}
            dangerouslySetInnerHTML={{ __html: captionHtml }}
          />
        ) : null}
      </figure>
    );
  },
};
