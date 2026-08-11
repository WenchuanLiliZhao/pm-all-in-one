/**
 * Orphan Electron-root twin of renderer issue-status (byte-identical to src/lib).
 * ↔ src/lib/issue-status.ts — prefer that file + electron/core/issue-status.ts
 * ↔ src/components/ui/issue-status/ — Lucide glyph + tone chrome (shared asset)
 * Props store `status: <id>`. category reserves future variants.
 */

export const ISSUE_STATUS_CATEGORIES = [
  "draft",
  "todo",
  "in-progress",
  "done",
  "cancel",
] as const;

export type IssueStatusCategory = (typeof ISSUE_STATUS_CATEGORIES)[number];

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

export function normalizeIssueStatus(raw: unknown): IssueStatusId {
  return isIssueStatusId(raw) ? raw : DEFAULT_ISSUE_STATUS;
}
