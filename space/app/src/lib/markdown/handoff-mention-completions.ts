// ↔ src/components/markdown-editor/types.ts — MentionAutocompleteCandidate
// ↔ src/components/markdown-editor/autocomplete/mention.ts — generic @ shell

import type { MentionAutocompleteCandidate } from "@/components/markdown-editor";
import type { HandoffMeta } from "@/lib/types";
import { handoffDisplayTitle } from "./mention-titles";

function handoffLinkSyntax(handoffId: string): string {
  return `@handoff-${handoffId}`;
}

/** Map workspace handoffs → generic @ mention autocomplete candidates. */
export function toHandoffMentionCandidates(
  handoffs: HandoffMeta[],
): MentionAutocompleteCandidate[] {
  return handoffs.map((handoff) => ({
    id: handoff.id,
    label: handoffDisplayTitle(handoff),
    secondary: `handoff · ${handoff.open ? "open" : "closed"} · ${handoff.id}`,
    insertText: handoffLinkSyntax(handoff.id),
  }));
}
