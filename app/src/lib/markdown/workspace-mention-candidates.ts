// ↔ *-mention-completions.ts — per-kind candidate lists
// ↔ src/components/markdown-editor/autocomplete/mention.ts — generic @ shell

import type { MentionAutocompleteCandidate } from "@/components/markdown-editor";
import type {
  HandoffMeta,
  Issue,
  MemberMeta,
  WikiNodeMeta,
} from "@/lib/types";
import { toHandoffMentionCandidates } from "./handoff-mention-completions";
import { toIssueMentionCandidates } from "./issue-mention-completions";
import { toMemberMentionCandidates } from "./member-mention-completions";
import { toWikiMentionCandidates } from "./wiki-mention-completions";

export type WorkspaceMentionSources = {
  issues: Issue[];
  wikiNodes: WikiNodeMeta[];
  members: MemberMeta[];
  handoffs: HandoffMeta[];
};

/**
 * One workspace-wide @ candidate list (issue + wiki + member + handoff).
 * Insert text is always the full kind-prefixed locator.
 */
export function toWorkspaceMentionCandidates(
  sources: WorkspaceMentionSources,
): MentionAutocompleteCandidate[] {
  return [
    ...toIssueMentionCandidates(sources.issues),
    ...toWikiMentionCandidates(sources.wikiNodes),
    ...toMemberMentionCandidates(sources.members),
    ...toHandoffMentionCandidates(sources.handoffs),
  ];
}
