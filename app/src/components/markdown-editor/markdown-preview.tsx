// ↔ merge-plugins.ts — transform / components / URL-scheme / fence-registry merge
// ↔ preview-rehype.ts — remark-gfm/math + rehype-raw/sanitize/highlight/katex
// ↔ elements/index.ts — core elementPreviewComponents defaults
// ↔ elements/image/preview.tsx — createImagePreviewComponents (assets/ resolve)
// ↔ elements/link/preview.tsx — createLinkPreviewComponents (assets/ cards after plugin merge)
// ↔ elements/codeblock/preview.tsx — mermaid skipped in rehype-highlight; fence lookup
// ↔ elements/math/preview.tsx — KaTeX CSS + token remap (remark-math / rehype-katex)
// ↔ types.ts — MarkdownPreviewProps / MarkdownPlugin

import { useMemo } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import { elementPreviewComponents } from "./elements";
import { createCodeblockPreviewComponents } from "./elements/codeblock";
import { createImagePreviewComponents } from "./elements/image";
import { createLinkPreviewComponents } from "./elements/link";
import {
  applyTransforms,
  mergeAllowedUrlSchemes,
  mergeComponents,
  mergeFenceRegistry,
} from "./merge-plugins";
import {
  PREVIEW_REMARK_PLUGINS,
  createPreviewRehypePlugins,
} from "./preview-rehype";
import type { MarkdownPreviewProps } from "./types";
import styles from "./styles.module.scss";

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
  localMedia,
}: MarkdownPreviewProps) {
  const prepared = useMemo(
    () => applyTransforms(source, plugins),
    [source, plugins],
  );
  const fenceRegistry = useMemo(
    () => mergeFenceRegistry(plugins),
    [plugins],
  );
  const components = useMemo(() => {
    const merged = mergeComponents(plugins, elementPreviewComponents) ?? {};
    // Re-apply core `pre` / `a` / `img` after plugin merge so a plugin cannot
    // steal mermaid, `assets/` cards, or resolved images. Mention-scheme
    // hrefs still go to the plugin `a` (issue/wiki chips).
    return {
      ...merged,
      ...createImagePreviewComponents(localMedia),
      ...createLinkPreviewComponents(merged.a),
      ...createCodeblockPreviewComponents(fenceRegistry),
    };
  }, [plugins, fenceRegistry, localMedia]);
  const allowedUrlSchemes = useMemo(
    () => mergeAllowedUrlSchemes(plugins),
    [plugins],
  );
  const urlTransform = useMemo(
    () => createPluginAwareUrlTransform(allowedUrlSchemes),
    [allowedUrlSchemes],
  );
  const rehypePlugins = useMemo(
    () =>
      createPreviewRehypePlugins({
        allowedUrlSchemes,
        highlightPlainText: ["mermaid", ...fenceRegistry.keys()],
      }),
    [allowedUrlSchemes, fenceRegistry],
  );

  if (!source.trim()) {
    return (
      <span className={[styles.muted, className].filter(Boolean).join(" ")}>
        Empty
      </span>
    );
  }

  return (
    <div className={[styles.markdown, className].filter(Boolean).join(" ")}>
      <Markdown
        remarkPlugins={PREVIEW_REMARK_PLUGINS}
        rehypePlugins={rehypePlugins}
        components={components}
        urlTransform={urlTransform}
      >
        {prepared}
      </Markdown>
    </div>
  );
}
