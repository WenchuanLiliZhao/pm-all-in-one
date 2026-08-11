/**
 * Built-in issue priority catalog — keep in sync with electron/core/issue-priority.ts.
 * Props store `priority: <id>`.
 * ↔ electron/core/issue-priority.ts — catalog SoT (core may add labels/helpers)
 * ↔ electron/src/lib/issue-priority.ts — orphan Electron-root twin of this file
 * ↔ src/components/ui/issue-priority/ — Lucide glyph + tone chrome (shared asset)
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

export function normalizeIssuePriority(raw: unknown): IssuePriorityId {
  return isIssuePriorityId(raw) ? raw : DEFAULT_ISSUE_PRIORITY;
}

export function issuePriorityLabel(id: IssuePriorityId): string {
  return BUILTIN_ISSUE_PRIORITIES.find((p) => p.id === id)?.label ?? id;
}
