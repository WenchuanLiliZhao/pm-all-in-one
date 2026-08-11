// ↔ ./index.ts — codeblockPreviewComponents registered in element registry
// ↔ ./live.ts — Live twin (collapse fences / lang badge / highlight)
// ↔ ./preview.module.scss — boxed pre/code + highlight token colors

import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import styles from "./preview.module.scss";

function langFromClassName(className: string | undefined): string | undefined {
  if (!className) return undefined;
  const match = /(?:^|\s)language-([^\s]+)/.exec(className);
  return match?.[1];
}

/** Reading View fenced + inline code — traditional boxed layout + highlight. */
export const codeblockPreviewComponents: Components = {
  pre: ({ className, children, node: _node, ...props }) => {
    // react-markdown: <pre><code class="language-js">…</code></pre>
    let lang: string | undefined;
    const list = Array.isArray(children) ? children : [children];
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
