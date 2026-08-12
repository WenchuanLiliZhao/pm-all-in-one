// ↔ ./index.ts — linkPreviewComponents registered in element registry
// ↔ ./preview.module.scss — accent link color
// ↔ ./live.ts — Live twin (hide [](); style label)
// ↔ ../../local-media.ts — assets/ → attachment card
// ↔ ../image/preview.module.scss — shared card styles

import type { Components, ExtraProps } from "react-markdown";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderInlineMarkdownFragment } from "../../inline-fragment";
import { assetBasename, isNodeAssetRelUrl } from "../../local-media";
import imageStyles from "../image/preview.module.scss";
import styles from "./preview.module.scss";

function childText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childText).join("");
  if (children == null || typeof children === "boolean") return "";
  return String(children);
}

function AttachmentCard({ href, label }: { href: string; label: string }) {
  const name = label.trim() || assetBasename(href) || "file";
  const base = assetBasename(href);
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).toUpperCase() : "FILE";
  const titleHtml = renderInlineMarkdownFragment(name);
  return (
    <span className={imageStyles.card}>
      <span className={imageStyles.cardExt}>{ext}</span>
      {titleHtml ? (
        <span
          className={imageStyles.cardTitle}
          dangerouslySetInnerHTML={{ __html: titleHtml }}
        />
      ) : (
        <span className={imageStyles.cardTitle}>{name}</span>
      )}
    </span>
  );
}

/** Reading View anchors; node-asset hrefs become attachment cards. */
export const linkPreviewComponents: Components = {
  a: ({
    className,
    children,
    href,
    node: _node,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & ExtraProps) => {
    if (href && isNodeAssetRelUrl(href)) {
      return <AttachmentCard href={href} label={childText(children)} />;
    }
    return (
      <a
        className={[styles.a, className].filter(Boolean).join(" ")}
        href={href}
        {...props}
      >
        {children}
      </a>
    );
  },
};
