// ↔ src/components/markdown-editor/types.ts — MarkdownPlugin contract
// ↔ src/components/markdown-editor/index.ts — linkChipStyles + previewAnchorClassName + replaceOutsideCode
// ↔ ./pm-link-plugin.tsx — preferred combined issue+wiki plugin (avoids components.a clobber)

import type { MarkdownPlugin } from "@/components/markdown-editor";
import {
  linkChipStyles,
  previewAnchorClassName,
  replaceOutsideCode,
} from "@/components/markdown-editor";
import { issueRefKey } from "@/lib/types";

const ID = "[A-Za-z0-9_-]{21}";
const ISSUE_MENTION = new RegExp(`@issue-(${ID})::(${ID})`, "g");

function escapeLinkLabel(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

export type IssueLinkPluginOptions = {
  knownKeys: Set<string>;
  /** issueRefKey → display title. */
  titles?: Map<string, string>;
  onNavigate: (projectId: string, issueId: string) => void;
  classNames?: { ok: string; broken: string };
};

/** Adapter: @issue-p::i → clickable chips in Reading View. */
export function createIssueLinkPlugin(
  options: IssueLinkPluginOptions,
): MarkdownPlugin {
  const classNames = options.classNames ?? linkChipStyles;
  const hrefRe = new RegExp(`^issue:(${ID})::(${ID})$`);

  return {
    allowedUrlSchemes: ["issue"],
    transformSource: (source) =>
      replaceOutsideCode(
        source,
        ISSUE_MENTION,
        (_full, projectId, issueId) => {
          const key = issueRefKey(projectId!, issueId!);
          const label = options.titles?.get(key) ?? key;
          return `[${escapeLinkLabel(label)}](issue:${key})`;
        },
      ),
    components: {
      a: ({ href, children }) => {
        const m = href?.match(hrefRe);
        if (m) {
          const projectId = m[1]!;
          const issueId = m[2]!;
          const key = issueRefKey(projectId, issueId);
          const ok = options.knownKeys.has(key);
          return (
            <a
              href={href}
              className={ok ? classNames.ok : classNames.broken}
              title={`@issue-${key}`}
              onClick={(e) => {
                e.preventDefault();
                options.onNavigate(projectId, issueId);
              }}
            >
              {children}
            </a>
          );
        }
        return (
          <a
            className={previewAnchorClassName}
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        );
      },
    },
  };
}
