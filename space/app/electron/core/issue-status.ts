/**
 * Built-in issue status catalog. Props store `status: <id>`.
 * `category` reserves Jira-style variants later (multiple ids → one column).
 * Today every builtin has id === category.
 * ↔ src/lib/issue-status.ts — renderer hand-mirror of the catalog ids
 * ↔ src/components/ui/issue-status/ — renderer glyph + tone chrome (not in core)
 */

export const ISSUE_STATUS_CATEGORIES = [
  "draft",
  "todo",
  "in-progress",
  "done",
  "cancel",
] as const;

export type IssueStatusCategory = (typeof ISSUE_STATUS_CATEGORIES)[number];

/** v1: status ids are the five categories. */
export type IssueStatusId = IssueStatusCategory;

export interface IssueStatusDef {
  id: IssueStatusId;
  label: string;
  category: IssueStatusCategory;
}

export const BUILTIN_ISSUE_STATUSES: readonly IssueStatusDef[] = [
  { id: "draft", label: "Draft", category: "draft" },
  { id: "todo", label: "Todo", category: "todo" },
  { id: "in-progress", label: "In progress", category: "in-progress" },
  { id: "done", label: "Done", category: "done" },
  { id: "cancel", label: "Cancel", category: "cancel" },
];

export const ISSUE_STATUS_IDS = BUILTIN_ISSUE_STATUSES.map((s) => s.id);

export const DEFAULT_ISSUE_STATUS: IssueStatusId = "draft";

const ID_SET = new Set<string>(ISSUE_STATUS_IDS);

export function isIssueStatusId(value: unknown): value is IssueStatusId {
  return typeof value === "string" && ID_SET.has(value);
}

/** Missing or unknown → Draft (create default / safe read). */
export function normalizeIssueStatus(raw: unknown): IssueStatusId {
  return isIssueStatusId(raw) ? raw : DEFAULT_ISSUE_STATUS;
}

export function issueStatusLabel(id: IssueStatusId): string {
  return BUILTIN_ISSUE_STATUSES.find((s) => s.id === id)?.label ?? id;
}
