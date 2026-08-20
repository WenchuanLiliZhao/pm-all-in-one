// ↔ ./index.ts — createLinkPreviewComponents registered in element registry
// ↔ ./preview.module.scss — accent link color
// ↔ ./live.ts — Live twin (hide [](); style label; assets/ → card)
// ↔ ../../local-media.ts — assets/ → attachment card
// ↔ ../image/preview.tsx — shared AttachmentCard
// ↔ ../../markdown-preview.tsx — overlays factory after plugin merge

import type { Components, ExtraProps } from "react-markdown";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { isNodeAssetRelUrl } from "../../local-media";
import { AttachmentCard } from "../image/preview";
import styles from "./preview.module.scss";

const MENTION_HREF = /^(issue|project|wiki|member|handoff):/i;

function childText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childText).join("");
  if (children == null || typeof children === "boolean") return "";
  return String(children);
}

type AnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & ExtraProps;

function PreviewAnchor({
  className,
  children,
  href,
  node: _node,
  ...props
}: AnchorProps) {
  return (
    <a
      className={[styles.a, className].filter(Boolean).join(" ")}
      href={href}
      {...props}
    >
      {children}
    </a>
  );
}

/**
 * Reading View anchors. Core owns `assets/` cards (same as Live).
 * Pass the merged plugin `a` so `issue:` / `wiki:` chips still render;
 * non-mention hrefs stay accent links even if a plugin overwrote `a`.
 */
export function createLinkPreviewComponents(
  inner?: Components["a"],
): Components {
  return {
    a: (props: AnchorProps) => {
      const href = typeof props.href === "string" ? props.href : "";
      if (href && isNodeAssetRelUrl(href)) {
        return (
          <AttachmentCard href={href} label={childText(props.children)} />
        );
      }
      if (href && MENTION_HREF.test(href) && typeof inner === "function") {
        return inner(props);
      }
      return <PreviewAnchor {...props} />;
    },
  };
}

export const linkPreviewComponents: Components =
  createLinkPreviewComponents();

/** Accent class for plugin fallbacks that still render a generic `<a>`. */
export const previewAnchorClassName = styles.a;
