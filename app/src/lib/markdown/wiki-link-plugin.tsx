// ↔ src/components/markdown-editor/types.ts — MarkdownPlugin contract
// ↔ src/components/markdown-editor/index.ts — linkChipStyles + replaceOutsideCode
// ↔ ./pm-link-plugin.tsx — preferred combined issue+wiki plugin (avoids components.a clobber)

import type { MarkdownPlugin } from "@/components/markdown-editor";
import {
  linkChipStyles,
  replaceOutsideCode,
} from "@/components/markdown-editor";

const ID = "[A-Za-z0-9_-]{21}";
const WIKI_MENTION = new RegExp(`@wiki-(${ID})`, "g");

function escapeLinkLabel(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

export type WikiLinkPluginOptions = {
  knownIds: Set<string>;
  /** wikiNodeId → display title. */
  titles?: Map<string, string>;
  onNavigate: (wikiNodeId: string) => void;
  classNames?: { ok: string; broken: string };
};

/** Adapter: @wiki-w_3 → clickable chips in Reading View. */
export function createWikiNodeLinkPlugin(
  options: WikiLinkPluginOptions,
): MarkdownPlugin {
  const classNames = options.classNames ?? linkChipStyles;
  const hrefRe = new RegExp(`^wiki:(${ID})$`);

  return {
    allowedUrlSchemes: ["wiki"],
    transformSource: (source) =>
      replaceOutsideCode(source, WIKI_MENTION, (_full, wikiNodeId) => {
        const label = options.titles?.get(wikiNodeId!) ?? wikiNodeId!;
        return `[${escapeLinkLabel(label)}](wiki:${wikiNodeId})`;
      }),
    components: {
      a: ({ href, children }) => {
        const m = href?.match(hrefRe);
        if (m) {
          const wikiNodeId = m[1]!;
          const ok = options.knownIds.has(wikiNodeId);
          return (
            <button
              type="button"
              className={ok ? classNames.ok : classNames.broken}
              title={`@wiki-${wikiNodeId}`}
              onClick={(e) => {
                e.preventDefault();
                options.onNavigate(wikiNodeId);
              }}
            >
              {children}
            </button>
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
