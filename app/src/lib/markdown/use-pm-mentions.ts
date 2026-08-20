/**
 * Shared @ autocomplete + Reading View chip + Live Cmd/Ctrl+click wiring.
 * Kind prefixes always required; candidate set is workspace-wide.
 */
// ↔ ./activate-pm-mention.ts — Live mention → navigate
// ↔ ./pm-link-plugin.tsx — Reading View chips
// ↔ ./plot-fence-plugin/ — Reading View plot fences
// ↔ src/components/markdown-editor/types.ts — MentionAutocompleteProps.onActivate
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { MentionAutocompleteProps } from "@/components/markdown-editor";
import type { MarkdownPlugin } from "@/components/markdown-editor";
import type { Issue, Project, WikiNodeMeta } from "@/lib/types";
import { issueRefKey } from "@/lib/types";
import { useMember } from "@/lib/workspace/member-context";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import { useHandoffMetas } from "@/lib/workspace/use-handoff-metas";
import { activatePmMention } from "./activate-pm-mention";
import { plotFencePlugin } from "./plot-fence-plugin";
import { createPmLinkPlugin } from "./pm-link-plugin";
import {
  toHandoffTitleMap,
  toIssueTitleMap,
  toMemberTitleMap,
  toProjectTitleMap,
  toWikiTitleMap,
} from "./mention-titles";
import { toWorkspaceMentionCandidates } from "./workspace-mention-candidates";

export type UsePmMentionsArgs = {
  issues: Issue[];
  wikiNodes: WikiNodeMeta[];
  /** When omitted, taken from workspace context. */
  projects?: Project[];
  /** When omitted, derived from `issues`. */
  knownIssueKeys?: Set<string>;
  onNavigateIssue: (projectId: string, issueId: string) => void;
  onNavigateProject?: (projectId: string) => void;
};

export type UsePmMentionsResult = {
  plugins: MarkdownPlugin[];
  mentionAutocomplete: MentionAutocompleteProps;
};

export function usePmMentions({
  issues,
  wikiNodes,
  projects: projectsProp,
  knownIssueKeys: knownIssueKeysProp,
  onNavigateIssue,
  onNavigateProject,
}: UsePmMentionsArgs): UsePmMentionsResult {
  const navigate = useNavigate();
  const { projects: workspaceProjects } = useWorkspace();
  const projects = projectsProp ?? workspaceProjects;
  const { members } = useMember();
  const handoffs = useHandoffMetas();
  const memberNodes = members?.nodes ?? [];

  const knownIssueKeys = useMemo(
    () =>
      knownIssueKeysProp ??
      new Set(issues.map((i) => issueRefKey(i.projectId, i.id))),
    [knownIssueKeysProp, issues],
  );
  const knownProjectIds = useMemo(
    () => new Set(projects.map((p) => p.id)),
    [projects],
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
  const projectTitles = useMemo(() => toProjectTitleMap(projects), [projects]);
  const wikiTitles = useMemo(() => toWikiTitleMap(wikiNodes), [wikiNodes]);
  const memberTitles = useMemo(() => toMemberTitleMap(memberNodes), [memberNodes]);
  const handoffTitles = useMemo(() => toHandoffTitleMap(handoffs), [handoffs]);

  const plugins = useMemo(
    () => [
      plotFencePlugin,
      createPmLinkPlugin({
        knownIssueKeys,
        knownProjectIds,
        knownWikiNodeIds,
        knownMemberIds,
        knownHandoffIds,
        issueTitles,
        projectTitles,
        wikiTitles,
        memberTitles,
        handoffTitles,
        onNavigateIssue,
        onNavigateProject,
        onNavigateWikiNode: (id) => navigate(`/w/wiki/${id}`),
        onNavigateMember: (id) => navigate(`/w/members/${id}`),
        onNavigateHandoff: (id) => navigate(`/w/handoffs/${id}`),
      }),
    ],
    [
      knownIssueKeys,
      knownProjectIds,
      knownWikiNodeIds,
      knownMemberIds,
      knownHandoffIds,
      issueTitles,
      projectTitles,
      wikiTitles,
      memberTitles,
      handoffTitles,
      onNavigateIssue,
      onNavigateProject,
      navigate,
    ],
  );

  const mentionAutocomplete = useMemo(
    (): MentionAutocompleteProps => ({
      candidates: toWorkspaceMentionCandidates({
        projects,
        issues,
        wikiNodes,
        members: memberNodes,
        handoffs,
      }),
      onActivate: (token) => {
        activatePmMention(token, {
          onNavigateIssue,
          onNavigateProject,
          onNavigateWikiNode: (id) => navigate(`/w/wiki/${id}`),
          onNavigateMember: (id) => navigate(`/w/members/${id}`),
          onNavigateHandoff: (id) => navigate(`/w/handoffs/${id}`),
        });
      },
    }),
    [
      projects,
      issues,
      wikiNodes,
      memberNodes,
      handoffs,
      onNavigateIssue,
      onNavigateProject,
      navigate,
    ],
  );

  return { plugins, mentionAutocomplete };
}
