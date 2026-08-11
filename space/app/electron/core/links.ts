import {
  ENTITY_ID_SRC,
  ISSUE_REF_SEP,
  isValidEntityId,
  type EntityId,
} from "./dir-id.js";

export interface IssueLinkRef {
  projectId: EntityId;
  issueId: EntityId;
  raw: string;
}

export interface WikiLinkRef {
  wikiNodeId: EntityId;
  raw: string;
}

export interface MemberLinkRef {
  memberId: EntityId;
  raw: string;
}

export interface HandoffLinkRef {
  handoffId: EntityId;
  raw: string;
}

/** Canonical mention: `@issue-<projectId>::<issueId>`. */
const ISSUE_LINK_RE = new RegExp(
  `@issue-${ENTITY_ID_SRC}${ISSUE_REF_SEP}${ENTITY_ID_SRC}`,
  "g",
);

/** Canonical mention: `@wiki-<wikiNodeId>` → `wiki/<id>/README.md`. */
const WIKI_LINK_RE = new RegExp(`@wiki-${ENTITY_ID_SRC}`, "g");

/** Canonical mention: `@member-<memberId>` → `members/<id>/`. */
const MEMBER_LINK_RE = new RegExp(`@member-${ENTITY_ID_SRC}`, "g");

/** Canonical mention: `@handoff-<handoffId>` → `handoffs/<id>/`. */
const HANDOFF_LINK_RE = new RegExp(`@handoff-${ENTITY_ID_SRC}`, "g");

export function parseIssueLinks(markdown: string): IssueLinkRef[] {
  const out: IssueLinkRef[] = [];
  for (const m of markdown.matchAll(ISSUE_LINK_RE)) {
    const projectId = m[1]!;
    const issueId = m[2]!;
    if (!isValidEntityId(projectId) || !isValidEntityId(issueId)) {
      continue;
    }
    out.push({
      projectId,
      issueId,
      raw: m[0]!,
    });
  }
  return out;
}

export function issueLinkSyntax(projectId: EntityId, issueId: EntityId): string {
  return `@issue-${projectId}${ISSUE_REF_SEP}${issueId}`;
}

export function parseWikiLinks(markdown: string): WikiLinkRef[] {
  const out: WikiLinkRef[] = [];
  for (const m of markdown.matchAll(WIKI_LINK_RE)) {
    const wikiNodeId = m[1]!;
    if (!isValidEntityId(wikiNodeId)) {
      continue;
    }
    out.push({ wikiNodeId, raw: m[0]! });
  }
  return out;
}

export function wikiLinkSyntax(wikiNodeId: EntityId): string {
  return `@wiki-${wikiNodeId}`;
}

export function parseMemberLinks(markdown: string): MemberLinkRef[] {
  const out: MemberLinkRef[] = [];
  for (const m of markdown.matchAll(MEMBER_LINK_RE)) {
    const memberId = m[1]!;
    if (!isValidEntityId(memberId)) {
      continue;
    }
    out.push({ memberId, raw: m[0]! });
  }
  return out;
}

export function memberLinkSyntax(memberId: EntityId): string {
  return `@member-${memberId}`;
}

export function parseHandoffLinks(markdown: string): HandoffLinkRef[] {
  const out: HandoffLinkRef[] = [];
  for (const m of markdown.matchAll(HANDOFF_LINK_RE)) {
    const handoffId = m[1]!;
    if (!isValidEntityId(handoffId)) {
      continue;
    }
    out.push({ handoffId, raw: m[0]! });
  }
  return out;
}

export function handoffLinkSyntax(handoffId: EntityId): string {
  return `@handoff-${handoffId}`;
}
