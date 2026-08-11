// ↔ src/components/markdown-editor/types.ts — MentionAutocompleteCandidate
// ↔ src/components/markdown-editor/autocomplete/mention.ts — generic @ shell

import type { MentionAutocompleteCandidate } from "@/components/markdown-editor";
import type { WikiNodeMeta } from "@/lib/types";
import { wikiDisplayTitle } from "./mention-titles";

function wikiLinkSyntax(wikiNodeId: string): string {
  return `@wiki-${wikiNodeId}`;
}

/** Map workspace wiki-nodes → generic @ mention autocomplete candidates. */
export function toWikiMentionCandidates(
  nodes: WikiNodeMeta[],
): MentionAutocompleteCandidate[] {
  return nodes.map((node) => ({
    id: node.id,
    label: wikiDisplayTitle(node),
    secondary: `wiki · ${node.id}`,
    insertText: wikiLinkSyntax(node.id),
  }));
}
