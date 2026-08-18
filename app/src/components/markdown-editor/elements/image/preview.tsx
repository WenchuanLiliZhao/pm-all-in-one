// ↔ ./index.ts — createImagePreviewComponents
// ↔ ./preview.module.scss
// ↔ ./live.ts — Live twin
// ↔ ../../inline-fragment.ts — caption HTML
// ↔ ../../local-media.ts — embed vs card + resolveMediaUrl
// ↔ ../link/preview.tsx — shared AttachmentCard
// ↔ ../../markdown-preview.tsx — overlays factory so Preview matches Live

import {
  Children,
  isValidElement,
  useState,
  type JSX,
} from "react";
import type { Components, ExtraProps } from "react-markdown";
import { renderInlineMarkdownFragment } from "../../inline-fragment";
import {
  assetBasename,
  isEmbeddableImageUrl,
  type LocalMediaOptions,
} from "../../local-media";
import styles from "./preview.module.scss";

export function AttachmentCard({
  href,
  label,
  stub,
}: {
  href: string;
  label: string;
  stub?: boolean;
}) {
  const name = label.trim() || assetBasename(href) || "file";
  const base = assetBasename(href);
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).toUpperCase() : "FILE";
  const titleHtml = renderInlineMarkdownFragment(name);
  return (
    <span
      className={[styles.card, stub ? styles.cardStub : ""]
        .filter(Boolean)
        .join(" ")}
    >
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

function PreviewFigure({
  href,
  resolved,
  alt,
  className,
  imgProps,
}: {
  href: string;
  resolved: string;
  alt: string;
  className?: string;
  imgProps: JSX.IntrinsicElements["img"];
}) {
  const [broken, setBroken] = useState(false);
  const caption = alt.trim();
  const captionHtml = caption ? renderInlineMarkdownFragment(caption) : "";
  return (
    <figure className={styles.figure}>
      {broken ? (
        <AttachmentCard
          href={href}
          label={caption || "broken image"}
          stub
        />
      ) : (
        <img
          className={[styles.img, className].filter(Boolean).join(" ")}
          alt={alt}
          {...imgProps}
          src={resolved}
          loading="lazy"
          onError={() => setBroken(true)}
        />
      )}
      {captionHtml ? (
        <figcaption
          className={styles.caption}
          dangerouslySetInnerHTML={{ __html: captionHtml }}
        />
      ) : null}
    </figure>
  );
}

function unwrapSoleBlock({
  children,
  node: _node,
  ...props
}: JSX.IntrinsicElements["p"] & ExtraProps) {
  const list = Children.toArray(children).filter(
    (child) => !(typeof child === "string" && child.trim() === ""),
  );
  if (list.length === 1 && isValidElement(list[0])) {
    const type = list[0].type;
    if (type === "figure" || type === AttachmentCard) {
      return list[0];
    }
  }
  return <p {...props}>{children}</p>;
}

/** Reading View img → figure / card. Pass `localMedia` so `assets/` loads. */
export function createImagePreviewComponents(
  localMedia?: LocalMediaOptions,
): Components {
  return {
    img: ({ className, alt, src, node: _node, ...props }) => {
      const href = typeof src === "string" ? src : "";
      if (href && !isEmbeddableImageUrl(href)) {
        return <AttachmentCard href={href} label={alt ?? ""} />;
      }
      const resolved = localMedia?.resolveMediaUrl?.(href) ?? href;
      return (
        <PreviewFigure
          href={href}
          resolved={resolved}
          alt={alt ?? ""}
          className={className}
          imgProps={props}
        />
      );
    },
    p: unwrapSoleBlock,
  };
}

export const imagePreviewComponents: Components =
  createImagePreviewComponents();
