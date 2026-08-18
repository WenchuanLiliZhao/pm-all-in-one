// ↔ src/components/markdown-editor/types.ts — MarkdownPlugin contract
// ↔ src/components/markdown-editor/AGENTS.md — Lab mock only; never real wiki index
// ↔ ./markdown-editor.tsx — harness mounts this mock plugin

import type { MarkdownPlugin } from "@/components/markdown-editor";
import {
  linkChipStyles,
  replaceOutsideCode,
} from "@/components/markdown-editor";

const MENTION = /@wiki-([A-Za-z0-9_-]+)/g;

function escapeLinkLabel(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

export type MockWikiPluginOptions = {
  knownKeys: Set<string>;
  /** wiki key → display title for Reading View chips. */
  titles?: Map<string, string>;
  onNavigate: (key: string) => void;
  classNames?: { ok: string; broken: string };
};

/** Lab-only adapter: @wiki-key → clickable chips in preview. */
export function createMockWikiPlugin(
  options: MockWikiPluginOptions,
): MarkdownPlugin {
  const classNames = options.classNames ?? linkChipStyles;

  return {
    allowedUrlSchemes: ["wiki"],
    transformSource: (source) =>
      replaceOutsideCode(source, MENTION, (_full, key) => {
        const label = options.titles?.get(key!) ?? key!;
        return `[${escapeLinkLabel(label)}](wiki:${encodeURIComponent(key!)})`;
      }),
    components: {
      a: ({ href, children }) => {
        const m = href?.match(/^wiki:(.+)$/);
        if (m) {
          const key = decodeURIComponent(m[1]);
          const ok = options.knownKeys.has(key);
          return (
            <a
              href={href}
              className={ok ? classNames.ok : classNames.broken}
              title={`@wiki-${key}`}
              onClick={(e) => {
                e.preventDefault();
                options.onNavigate(key);
              }}
            >
              {children}
            </a>
          );
        }
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      },
    },
  };
}
