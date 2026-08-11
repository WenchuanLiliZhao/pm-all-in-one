// ↔ src/components/markdown-editor/types.ts — MentionAutocompleteCandidate
// ↔ src/components/markdown-editor/autocomplete/mention.ts — generic @ shell

import type { MentionAutocompleteCandidate } from "@/components/markdown-editor";
import type { MemberMeta } from "@/lib/types";
import { memberDisplayTitle } from "./mention-titles";

function memberLinkSyntax(memberId: string): string {
  return `@member-${memberId}`;
}

/** Map workspace members → generic @ mention autocomplete candidates. */
export function toMemberMentionCandidates(
  members: MemberMeta[],
): MentionAutocompleteCandidate[] {
  return members.map((member) => ({
    id: member.id,
    label: memberDisplayTitle(member),
    secondary: `member · ${member.membership} · ${member.id}`,
    insertText: memberLinkSyntax(member.id),
  }));
}
