// ↔ src/components/markdown-editor/types.ts — MarkdownPlugin contract
// ↔ src/components/markdown-editor/index.ts — linkChipStyles + replaceOutsideCode
// ↔ src/components/markdown-editor/AGENTS.md — product adapters live here, not in core
// ↔ electron/core/identity/links.ts — canonical @issue- / @wiki- / @member- / @handoff- shapes

import type { MarkdownPlugin } from "@/components/markdown-editor";
import {
  linkChipStyles,
  replaceOutsideCode,
} from "@/components/markdown-editor";
import { issueRefKey } from "@/lib/types";

const ID = "[A-Za-z0-9_-]{21}";
const ISSUE_MENTION = new RegExp(`@issue-(${ID})::(${ID})`, "g");
const WIKI_MENTION = new RegExp(`@wiki-(${ID})`, "g");
const MEMBER_MENTION = new RegExp(`@member-(${ID})`, "g");
const HANDOFF_MENTION = new RegExp(`@handoff-(${ID})`, "g");

function escapeLinkLabel(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function lookupTitle(
  titles: Map<string, string> | undefined,
  key: string,
): string {
  return titles?.get(key) ?? key;
}

export type PmLinkPluginOptions = {
  knownIssueKeys: Set<string>;
  knownWikiNodeIds: Set<string>;
  knownMemberIds?: Set<string>;
  knownHandoffIds?: Set<string>;
  /** issueRefKey → display title (chip label in Reading View). */
  issueTitles?: Map<string, string>;
  /** wikiNodeId → display title (chip label in Reading View). */
  wikiTitles?: Map<string, string>;
  memberTitles?: Map<string, string>;
  handoffTitles?: Map<string, string>;
  onNavigateIssue: (projectId: string, issueId: string) => void;
  onNavigateWikiNode: (wikiNodeId: string) => void;
  onNavigateMember?: (memberId: string) => void;
  onNavigateHandoff?: (handoffId: string) => void;
  classNames?: { ok: string; broken: string };
};

/**
 * Combined Reading View chips for `@issue-` / `@wiki-` / `@member-` / `@handoff-`.
 * One plugin so `components.a` is not overwritten by Object.assign merge.
 * Chip text is the object title when provided; SoT stays the raw @mention.
 * Mentions inside inline / fenced code are left literal.
 */
export function createPmLinkPlugin(options: PmLinkPluginOptions): MarkdownPlugin {
  const classNames = options.classNames ?? linkChipStyles;
  const knownMemberIds = options.knownMemberIds ?? new Set<string>();
  const knownHandoffIds = options.knownHandoffIds ?? new Set<string>();
  const issueHrefRe = new RegExp(`^issue:(${ID})::(${ID})$`);
  const wikiHrefRe = new RegExp(`^wiki:(${ID})$`);
  const memberHrefRe = new RegExp(`^member:(${ID})$`);
  const handoffHrefRe = new RegExp(`^handoff:(${ID})$`);

  return {
    allowedUrlSchemes: ["issue", "wiki", "member", "handoff"],
    transformSource: (source) => {
      let next = replaceOutsideCode(
        source,
        ISSUE_MENTION,
        (_full, projectId, issueId) => {
          const key = issueRefKey(projectId!, issueId!);
          const label = lookupTitle(options.issueTitles, key);
          return `[${escapeLinkLabel(label)}](issue:${key})`;
        },
      );
      next = replaceOutsideCode(next, WIKI_MENTION, (_full, wikiNodeId) => {
        const label = lookupTitle(options.wikiTitles, wikiNodeId!);
        return `[${escapeLinkLabel(label)}](wiki:${wikiNodeId})`;
      });
      next = replaceOutsideCode(next, MEMBER_MENTION, (_full, memberId) => {
        const label = lookupTitle(options.memberTitles, memberId!);
        return `[${escapeLinkLabel(label)}](member:${memberId})`;
      });
      next = replaceOutsideCode(next, HANDOFF_MENTION, (_full, handoffId) => {
        const label = lookupTitle(options.handoffTitles, handoffId!);
        return `[${escapeLinkLabel(label)}](handoff:${handoffId})`;
      });
      return next;
    },
    components: {
      a: ({ href, children }) => {
        const issueMatch = href?.match(issueHrefRe);
        if (issueMatch) {
          const projectId = issueMatch[1]!;
          const issueId = issueMatch[2]!;
          const key = issueRefKey(projectId, issueId);
          const ok = options.knownIssueKeys.has(key);
          return (
            <button
              type="button"
              className={ok ? classNames.ok : classNames.broken}
              title={`@issue-${key}`}
              onClick={(e) => {
                e.preventDefault();
                options.onNavigateIssue(projectId, issueId);
              }}
            >
              {children}
            </button>
          );
        }
        const wikiMatch = href?.match(wikiHrefRe);
        if (wikiMatch) {
          const wikiNodeId = wikiMatch[1]!;
          const ok = options.knownWikiNodeIds.has(wikiNodeId);
          return (
            <button
              type="button"
              className={ok ? classNames.ok : classNames.broken}
              title={`@wiki-${wikiNodeId}`}
              onClick={(e) => {
                e.preventDefault();
                options.onNavigateWikiNode(wikiNodeId);
              }}
            >
              {children}
            </button>
          );
        }
        const memberMatch = href?.match(memberHrefRe);
        if (memberMatch) {
          const memberId = memberMatch[1]!;
          const ok = knownMemberIds.has(memberId);
          return (
            <button
              type="button"
              className={ok ? classNames.ok : classNames.broken}
              title={`@member-${memberId}`}
              onClick={(e) => {
                e.preventDefault();
                options.onNavigateMember?.(memberId);
              }}
            >
              {children}
            </button>
          );
        }
        const handoffMatch = href?.match(handoffHrefRe);
        if (handoffMatch) {
          const handoffId = handoffMatch[1]!;
          const ok = knownHandoffIds.has(handoffId);
          return (
            <button
              type="button"
              className={ok ? classNames.ok : classNames.broken}
              title={`@handoff-${handoffId}`}
              onClick={(e) => {
                e.preventDefault();
                options.onNavigateHandoff?.(handoffId);
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
