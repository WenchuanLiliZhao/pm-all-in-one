/**
 * System + custom-union column model and cell formatters for IssueTable.
 * Keep in sync with filter.ts haystack (search matches painted text).
 */
import {
  issueStatusLabel,
} from "@/components/ui/issue-status";
import { issuePriorityLabel } from "@/lib/issue-priority";
import type {
  CustomPropDef,
  CustomPropsSchema,
  Issue,
  IssueLevel,
  MetaFieldType,
  Project,
  TreeNode,
} from "@/lib/types";

export const MARKDOWN_CELL_MAX = 80;

export const SYSTEM_COLUMN_IDS = [
  "title",
  "level",
  "status",
  "priority",
  "startDate",
  "endDate",
  "created",
  "updated",
] as const;

export type SystemColumnId = (typeof SYSTEM_COLUMN_IDS)[number];

export interface CustomColumn {
  key: string;
  label: string;
  type: MetaFieldType;
}

export function defsForLevel(
  schema: CustomPropsSchema,
  level: IssueLevel,
): CustomPropDef[] {
  return schema[level];
}

/** Workspace-wide custom columns: first label/type wins on key collision. */
export function buildCustomUnion(
  schemas: Iterable<CustomPropsSchema>,
): CustomColumn[] {
  const seen = new Set<string>();
  const out: CustomColumn[] = [];
  for (const schema of schemas) {
    for (const level of ["epic", "task", "subtask"] as const) {
      for (const def of schema[level]) {
        if (seen.has(def.key)) {
          continue;
        }
        seen.add(def.key);
        out.push({ key: def.key, label: def.label, type: def.type });
      }
    }
  }
  return out;
}

export function keysDeclaredForRow(
  schema: CustomPropsSchema | undefined,
  level: IssueLevel | undefined,
): Set<string> {
  if (!schema || !level) {
    return new Set();
  }
  return new Set(defsForLevel(schema, level).map((d) => d.key));
}

export function truncateMarkdown(
  raw: string,
  maxLen: number = MARKDOWN_CELL_MAX,
): string {
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) {
    return oneLine;
  }
  return `${oneLine.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function formatFieldValue(
  value: unknown,
  type: MetaFieldType,
): string {
  if (value === undefined || value === null) {
    return "";
  }
  switch (type) {
    case "boolean":
      return value === true ? "true" : value === false ? "false" : String(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : String(value);
    case "date":
    case "string":
      return String(value);
    case "markdown":
      return truncateMarkdown(String(value));
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return String(value);
    }
  }
}

export function formatCustomCell(
  issue: Issue,
  column: CustomColumn,
  declaredKeys: Set<string>,
): string {
  if (!declaredKeys.has(column.key)) {
    return "";
  }
  if (column.type === "markdown") {
    const raw = issue.markdownFields[column.key];
    return typeof raw === "string" ? truncateMarkdown(raw) : "";
  }
  return formatFieldValue(issue.fields[column.key], column.type);
}

export function rowLevelLabel(entry: TreeNode): string {
  if (entry.kind === "project") {
    return "project";
  }
  return entry.level ?? "issue";
}

export function formatStatusCell(issue: Issue | null): string {
  if (!issue) {
    return "";
  }
  return issueStatusLabel(issue.status);
}

export function formatPriorityCell(issue: Issue | null): string {
  if (!issue) {
    return "";
  }
  return issuePriorityLabel(issue.priority);
}

export function formatDateCell(value: string | null | undefined): string {
  return value ?? "";
}

export function formatCreatedCell(
  entry: TreeNode,
  issue: Issue | null,
  project: Project | null,
): string {
  if (entry.kind === "project") {
    return project?.created ?? "";
  }
  return issue?.created ?? "";
}

export function formatUpdatedCell(
  entry: TreeNode,
  issue: Issue | null,
  project: Project | null,
): string {
  if (entry.kind === "project") {
    return project?.updated ?? "";
  }
  return issue?.updated ?? "";
}

/** Concatenated painted cell text for search. */
export function rowSearchHaystack(args: {
  entry: TreeNode;
  issue: Issue | null;
  project: Project | null;
  customColumns: readonly CustomColumn[];
  declaredKeys: Set<string>;
}): string {
  const { entry, issue, project, customColumns, declaredKeys } = args;
  const parts: string[] = [
    entry.title || "(untitled)",
    rowLevelLabel(entry),
  ];

  if (issue) {
    parts.push(formatStatusCell(issue));
    parts.push(issue.status);
    parts.push(formatPriorityCell(issue));
    parts.push(issue.priority);
    parts.push(formatDateCell(issue.startDate));
    parts.push(formatDateCell(issue.endDate));
    for (const col of customColumns) {
      parts.push(formatCustomCell(issue, col, declaredKeys));
    }
  }

  parts.push(formatCreatedCell(entry, issue, project));
  parts.push(formatUpdatedCell(entry, issue, project));

  return parts.filter(Boolean).join("\u0000").toLowerCase();
}
