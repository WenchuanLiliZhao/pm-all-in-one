// ↔ ./use-pm-mentions.ts — Live Cmd/Ctrl+click → navigate
// ↔ ./pm-link-plugin.tsx — Reading View chip click (same destinations)
// ↔ electron/core/identity/links.ts — canonical @issue- / @wiki- / @member- / @handoff-

import {
  parseHandoffLinks,
  parseIssueLinks,
  parseMemberLinks,
  parseProjectLinks,
  parseWikiLinks,
} from "@pm-core/identity/links";

export type ActivatePmMentionHandlers = {
  onNavigateIssue: (projectId: string, issueId: string) => void;
  onNavigateProject?: (projectId: string) => void;
  onNavigateWikiNode: (wikiNodeId: string) => void;
  onNavigateMember?: (memberId: string) => void;
  onNavigateHandoff?: (handoffId: string) => void;
};

/**
 * Route a single Live `@…` SoT token to the matching navigate handler.
 * Returns true when the token matched a known locator shape.
 */
export function activatePmMention(
  token: string,
  handlers: ActivatePmMentionHandlers,
): boolean {
  const issue = parseIssueLinks(token).find((r) => r.raw === token);
  if (issue) {
    handlers.onNavigateIssue(issue.projectId, issue.issueId);
    return true;
  }
  const project = parseProjectLinks(token).find((r) => r.raw === token);
  if (project) {
    handlers.onNavigateProject?.(project.projectId);
    return true;
  }
  const wiki = parseWikiLinks(token).find((r) => r.raw === token);
  if (wiki) {
    handlers.onNavigateWikiNode(wiki.wikiNodeId);
    return true;
  }
  const member = parseMemberLinks(token).find((r) => r.raw === token);
  if (member) {
    handlers.onNavigateMember?.(member.memberId);
    return true;
  }
  const handoff = parseHandoffLinks(token).find((r) => r.raw === token);
  if (handoff) {
    handlers.onNavigateHandoff?.(handoff.handoffId);
    return true;
  }
  return false;
}
