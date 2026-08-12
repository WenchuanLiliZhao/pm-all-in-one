/**
 * Shared @ autocomplete + Reading View chip + Live Cmd/Ctrl+click wiring.
 * Kind prefixes always required; candidate set is workspace-wide.
 */
// ↔ ./activate-pm-mention.ts — Live mention → navigate
// ↔ ./pm-link-plugin.tsx — Reading View chips
// ↔ src/components/markdown-editor/types.ts — MentionAutocompleteProps.onActivate
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { MentionAutocompleteProps } from "@/components/markdown-editor";
import type { MarkdownPlugin } from "@/components/markdown-editor";
import type { Issue, WikiNodeMeta } from "@/lib/types";
import { issueRefKey } from "@/lib/types";
import { useMember } from "@/lib/workspace/member-context";
import { useHandoffMetas } from "@/lib/workspace/use-handoff-metas";
import { activatePmMention } from "./activate-pm-mention";
import { createPmLinkPlugin } from "./pm-link-plugin";
import {
  toHandoffTitleMap,
  toIssueTitleMap,
  toMemberTitleMap,
  toWikiTitleMap,
} from "./mention-titles";
import { toWorkspaceMentionCandidates } from "./workspace-mention-candidates";

export type UsePmMentionsArgs = {
  issues: Issue[];
  wikiNodes: WikiNodeMeta[];
  /** When omitted, derived from `issues`. */
  knownIssueKeys?: Set<string>;
  onNavigateIssue: (projectId: string, issueId: string) => void;
};

export type UsePmMentionsResult = {
  plugins: MarkdownPlugin[];
  mentionAutocomplete: MentionAutocompleteProps;
};

export function usePmMentions({
  issues,
  wikiNodes,
  knownIssueKeys: knownIssueKeysProp,
  onNavigateIssue,
}: UsePmMentionsArgs): UsePmMentionsResult {
  const navigate = useNavigate();
  const { members } = useMember();
  const handoffs = useHandoffMetas();
  const memberNodes = members?.nodes ?? [];

  const knownIssueKeys = useMemo(
    () =>
      knownIssueKeysProp ??
      new Set(issues.map((i) => issueRefKey(i.projectId, i.id))),
    [knownIssueKeysProp, issues],
  );
  const knownWikiNodeIds = useMemo(
    () => new Set(wikiNodes.map((n) => n.id)),
    [wikiNodes],
  );
  const knownMemberIds = useMemo(
    () => new Set(memberNodes.map((m) => m.id)),
    [memberNodes],
  );
  const knownHandoffIds = useMemo(
    () => new Set(handoffs.map((h) => h.id)),
    [handoffs],
  );

  const issueTitles = useMemo(() => toIssueTitleMap(issues), [issues]);
  const wikiTitles = useMemo(() => toWikiTitleMap(wikiNodes), [wikiNodes]);
  const memberTitles = useMemo(() => toMemberTitleMap(memberNodes), [memberNodes]);
  const handoffTitles = useMemo(() => toHandoffTitleMap(handoffs), [handoffs]);

  const plugins = useMemo(
    () => [
      createPmLinkPlugin({
        knownIssueKeys,
        knownWikiNodeIds,
        knownMemberIds,
        knownHandoffIds,
        issueTitles,
        wikiTitles,
        memberTitles,
        handoffTitles,
        onNavigateIssue,
        onNavigateWikiNode: (id) => navigate(`/w/wiki/${id}`),
        onNavigateMember: (id) => navigate(`/w/members/${id}`),
        onNavigateHandoff: (id) => navigate(`/w/handoffs/${id}`),
      }),
    ],
    [
      knownIssueKeys,
      knownWikiNodeIds,
      knownMemberIds,
      knownHandoffIds,
      issueTitles,
      wikiTitles,
      memberTitles,
      handoffTitles,
      onNavigateIssue,
      navigate,
    ],
  );

  const mentionAutocomplete = useMemo(
    (): MentionAutocompleteProps => ({
      candidates: toWorkspaceMentionCandidates({
        issues,
        wikiNodes,
        members: memberNodes,
        handoffs,
      }),
      onActivate: (token) => {
        activatePmMention(token, {
          onNavigateIssue,
          onNavigateWikiNode: (id) => navigate(`/w/wiki/${id}`),
          onNavigateMember: (id) => navigate(`/w/members/${id}`),
          onNavigateHandoff: (id) => navigate(`/w/handoffs/${id}`),
        });
      },
    }),
    [issues, wikiNodes, memberNodes, handoffs, onNavigateIssue, navigate],
  );

  return { plugins, mentionAutocomplete };
}
