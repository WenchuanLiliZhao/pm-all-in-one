import type {
  HandoffMeta,
  Issue,
  MemberMeta,
  WikiNodeMeta,
} from "@/lib/types";
import { issueRefKey } from "@/lib/types";

/** Display title for an issue mention chip (matches autocomplete label). */
export function issueDisplayTitle(issue: Issue): string {
  const key = issueRefKey(issue.projectId, issue.id);
  const title = issue.title.trim();
  return title || `(untitled ${key})`;
}

/** Display title for a wiki mention chip (matches autocomplete label). */
export function wikiDisplayTitle(node: WikiNodeMeta): string {
  const title = node.title.trim();
  return title || `(untitled ${node.id})`;
}

/** Display title for a member mention chip (matches autocomplete label). */
export function memberDisplayTitle(member: MemberMeta): string {
  const title = member.title.trim();
  return title || `(untitled ${member.id})`;
}

/** Display title for a handoff mention chip (matches autocomplete label). */
export function handoffDisplayTitle(handoff: HandoffMeta): string {
  const title = handoff.title.trim();
  return title || `(untitled ${handoff.id})`;
}

export function toIssueTitleMap(issues: Issue[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const issue of issues) {
    map.set(issueRefKey(issue.projectId, issue.id), issueDisplayTitle(issue));
  }
  return map;
}

export function toWikiTitleMap(nodes: WikiNodeMeta[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of nodes) {
    map.set(node.id, wikiDisplayTitle(node));
  }
  return map;
}

export function toMemberTitleMap(members: MemberMeta[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    map.set(member.id, memberDisplayTitle(member));
  }
  return map;
}

export function toHandoffTitleMap(handoffs: HandoffMeta[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const handoff of handoffs) {
    map.set(handoff.id, handoffDisplayTitle(handoff));
  }
  return map;
}
