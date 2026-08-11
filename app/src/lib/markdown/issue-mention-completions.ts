// ↔ src/components/markdown-editor/types.ts — MentionAutocompleteCandidate
// ↔ src/components/markdown-editor/autocomplete/mention.ts — generic @ shell

import type { MentionAutocompleteCandidate } from "@/components/markdown-editor";
import type { Issue } from "@/lib/types";
import { issueRefKey } from "@/lib/types";
import { issueDisplayTitle } from "./mention-titles";

function issueLinkSyntax(projectId: string, issueId: string): string {
  return `@issue-${projectId}::${issueId}`;
}

/** Map workspace issues → generic @ mention autocomplete candidates. */
export function toIssueMentionCandidates(
  issues: Issue[],
): MentionAutocompleteCandidate[] {
  return issues.map((issue) => {
    const key = issueRefKey(issue.projectId, issue.id);
    return {
      id: key,
      label: issueDisplayTitle(issue),
      secondary: `${issue.level} · ${key}`,
      insertText: issueLinkSyntax(issue.projectId, issue.id),
    };
  });
}
