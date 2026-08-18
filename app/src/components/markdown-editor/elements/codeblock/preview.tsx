// ↔ ./index.ts — createCodeblockPreviewComponents registered in element registry
// ↔ ./live.ts — Live twin (collapse fences / lang badge / highlight / mermaid)
// ↔ ./mermaid-info.ts — language-mermaid gate
// ↔ ./mermaid-render.ts — same SVG renderer as Live
// ↔ ./preview.module.scss — boxed pre/code + highlight token colors + mermaid host
// ↔ ../../merge-plugins.ts — fence registry looked up before mermaid / boxed code
// ↔ ../../AGENTS.md — § Reading View fence plugins (do not steal pre)

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Components } from "react-markdown";
import type { MarkdownFencePlugin } from "../../types";
import { isMermaidLang } from "./mermaid-info";
import {
  applyMermaidSvg,
  mermaidColorTheme,
  renderMermaidSvg,
  subscribeMermaidTheme,
  type MermaidRenderResult,
} from "./mermaid-render";
import styles from "./preview.module.scss";

function langFromClassName(className: string | undefined): string | undefined {
  if (!className) return undefined;
  const match = /(?:^|\s)language-([^\s]+)/.exec(className);
  return match?.[1];
}

function reactNodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return reactNodeText(props?.children);
  }
  return "";
}

function fenceLangAndSource(children: ReactNode): {
  lang: string | undefined;
  source: string;
} {
  const list = Array.isArray(children) ? children : [children];
  let lang: string | undefined;
  for (const child of list) {
    if (
      child &&
      typeof child === "object" &&
      "props" in child &&
      child.props &&
      typeof child.props === "object" &&
      "className" in child.props
    ) {
      lang = langFromClassName(
        (child.props as { className?: string }).className,
      );
      break;
    }
  }
  return { lang, source: reactNodeText(children) };
}

function MermaidFigure({ source }: { source: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(mermaidColorTheme);
  const [result, setResult] = useState<MermaidRenderResult | null>(null);

  useEffect(() => subscribeMermaidTheme(() => setTheme(mermaidColorTheme())), []);

  useEffect(() => {
    let stale = false;
    setResult(null);
    void renderMermaidSvg(source, theme).then((r) => {
      if (!stale) setResult(r);
    });
    return () => {
      stale = true;
    };
  }, [source, theme]);

  useEffect(() => {
    if (!result?.ok || !hostRef.current) return;
    applyMermaidSvg(hostRef.current, result.svg);
  }, [result]);

  if (!result) {
    return <div className={styles.mermaid}>Rendering…</div>;
  }
  if (!result.ok) {
    return (
      <div className={`${styles.mermaid} ${styles.mermaidError}`}>
        {result.error}
      </div>
    );
  }
  return <div ref={hostRef} className={styles.mermaid} />;
}

/**
 * Reading View fenced + inline code. Optional fence registry is looked up
 * before mermaid / boxed code so plugins claim langs without stealing `pre`.
 */
export function createCodeblockPreviewComponents(
  fences?: Map<string, MarkdownFencePlugin>,
): Components {
  return {
    pre: ({ className, children, node: _node, ...props }) => {
      // react-markdown: <pre><code class="language-js">…</code></pre>
      const { lang, source } = fenceLangAndSource(children);
      const claimed = lang
        ? fences?.get(lang.trim().toLowerCase())
        : undefined;
      if (claimed) {
        const Comp = claimed.component;
        return <Comp lang={lang ?? claimed.lang} source={source} />;
      }
      if (isMermaidLang(lang)) {
        return <MermaidFigure source={source} />;
      }

      return (
        <div className={styles.block}>
          <div className={styles.header}>{lang ?? "code"}</div>
          <pre
            className={[styles.pre, className].filter(Boolean).join(" ")}
            {...props}
          >
            {children as ReactNode}
          </pre>
        </div>
      );
    },
    code: ({ className, children, node: _node, ...props }) => {
      const isFence = Boolean(className);
      return (
        <code
          className={[
            isFence ? styles.fenceCode : styles.inlineCode,
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          {children}
        </code>
      );
    },
  };
}

/** Core defaults (no product fence plugins). */
export const codeblockPreviewComponents: Components =
  createCodeblockPreviewComponents();
