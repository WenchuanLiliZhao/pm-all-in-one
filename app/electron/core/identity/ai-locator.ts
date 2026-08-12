import {
  handoffLinkSyntax,
  issueLinkSyntax,
  memberLinkSyntax,
  wikiLinkSyntax,
} from "./links.js";

// ↔ src/lib/ai-locator.ts — thin re-export via @pm-core/identity/ai-locator

export type AiLocatorInput =
  | { kind: "wiki"; wikiNodeId: string }
  | { kind: "project"; projectId: string }
  | { kind: "issue"; projectId: string; issueId: string }
  | { kind: "member"; memberId: string }
  | { kind: "handoff"; handoffId: string };

/**
 * Clipboard plaintext for “Copy for AI”: a single inline mention / id noun.
 * Never absolute paths. Project has no `@project-…` mention in product law —
 * copy the opaque projectId alone.
 *
 * ↔ src/lib/ai-locator.ts — thin re-export via @pm-core/identity/ai-locator
 * ↔ src/components/doc-edit-shell/locator-copy-text.tsx — click-to-copy nav chrome
 */
export function formatAiLocator(input: AiLocatorInput): string {
  if (input.kind === "wiki") {
    return wikiLinkSyntax(input.wikiNodeId);
  }
  if (input.kind === "project") {
    return input.projectId;
  }
  if (input.kind === "member") {
    return memberLinkSyntax(input.memberId);
  }
  if (input.kind === "handoff") {
    return handoffLinkSyntax(input.handoffId);
  }
  return issueLinkSyntax(input.projectId, input.issueId);
}
