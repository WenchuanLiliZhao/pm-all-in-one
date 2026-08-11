import type { Issue, IssueLevel } from "@/lib/types";

/** Exact phrase required when removing a field that still has saved values. */
export const REMOVE_FIELD_ACK = "I know what I am doing";

function valueIsPresent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  return true;
}

/** True when this issue has a non-empty saved value for `key` in fields or markdownFields. */
export function issueHasFieldValue(issue: Issue, key: string): boolean {
  if (Object.prototype.hasOwnProperty.call(issue.markdownFields, key)) {
    return valueIsPresent(issue.markdownFields[key]);
  }
  if (Object.prototype.hasOwnProperty.call(issue.fields, key)) {
    return valueIsPresent(issue.fields[key]);
  }
  return false;
}

/** Count same-project, same-level issues that still store a value for `key`. */
export function countFieldUsage(
  issues: Issue[],
  projectId: string,
  level: IssueLevel,
  key: string,
): number {
  let n = 0;
  for (const issue of issues) {
    if (issue.projectId !== projectId || issue.level !== level) {
      continue;
    }
    if (issueHasFieldValue(issue, key)) {
      n += 1;
    }
  }
  return n;
}
