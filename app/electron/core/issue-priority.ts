/**
 * Built-in issue priority catalog. Props store `priority: <id>`.
 * ↔ src/lib/issue-priority.ts — renderer hand-mirror of the catalog ids
 * ↔ src/components/ui/issue-priority/ — renderer glyph + tone chrome (not in core)
 */

export const ISSUE_PRIORITY_IDS_CONST = [
  "very-low",
  "low",
  "medium",
  "high",
  "very-high",
] as const;

export type IssuePriorityId = (typeof ISSUE_PRIORITY_IDS_CONST)[number];

export interface IssuePriorityDef {
  id: IssuePriorityId;
  label: string;
}

export const BUILTIN_ISSUE_PRIORITIES: readonly IssuePriorityDef[] = [
  { id: "very-low", label: "Very low" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "very-high", label: "Very high" },
];

export const ISSUE_PRIORITY_IDS = BUILTIN_ISSUE_PRIORITIES.map((p) => p.id);

export const DEFAULT_ISSUE_PRIORITY: IssuePriorityId = "medium";

const ID_SET = new Set<string>(ISSUE_PRIORITY_IDS);

export function isIssuePriorityId(value: unknown): value is IssuePriorityId {
  return typeof value === "string" && ID_SET.has(value);
}

/** Missing or unknown → Medium (create default / safe read). */
export function normalizeIssuePriority(raw: unknown): IssuePriorityId {
  return isIssuePriorityId(raw) ? raw : DEFAULT_ISSUE_PRIORITY;
}

export function issuePriorityLabel(id: IssuePriorityId): string {
  return BUILTIN_ISSUE_PRIORITIES.find((p) => p.id === id)?.label ?? id;
}
