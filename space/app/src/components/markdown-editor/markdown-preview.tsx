// ↔ merge-plugins.ts — transform / components / URL-scheme merge
// ↔ elements/index.ts — core elementPreviewComponents defaults
// ↔ types.ts — MarkdownPreviewProps / MarkdownPlugin

import { useMemo } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { elementPreviewComponents } from "./elements";
import {
  applyTransforms,
  mergeAllowedUrlSchemes,
  mergeComponents,
} from "./merge-plugins";
import type { MarkdownPreviewProps } from "./types";
import styles from "./styles.module.scss";

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];

function createPluginAwareUrlTransform(allowedSchemes: Set<string>) {
  return (url: string): string => {
    const scheme = url.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1]?.toLowerCase();
    if (scheme && allowedSchemes.has(scheme)) {
      return url;
    }
    return defaultUrlTransform(url);
  };
}

export function MarkdownPreview({
  source,
  plugins,
  className,
}: MarkdownPreviewProps) {
  const prepared = useMemo(
    () => applyTransforms(source, plugins),
    [source, plugins],
  );
  const components = useMemo(
    () => mergeComponents(plugins, elementPreviewComponents),
    [plugins],
  );
  const urlTransform = useMemo(
    () => createPluginAwareUrlTransform(mergeAllowedUrlSchemes(plugins)),
    [plugins],
  );

  if (!source.trim()) {
    return <span className={styles.muted}>Empty</span>;
  }

  return (
    <div className={[styles.markdown, className].filter(Boolean).join(" ")}>
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
        urlTransform={urlTransform}
      >
        {prepared}
      </Markdown>
    </div>
  );
}
