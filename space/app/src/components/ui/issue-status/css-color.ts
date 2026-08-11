/**
 * Status → CSS color string for Roadmap bars / non-DOM paint.
 * Keep cases identical to tone.module.scss `[data-status=…]`.
 * ↔ ./tone.module.scss — SCSS twin of this map
 * ↔ ./icon.tsx — icons use tone via className
 */

import type { IssueStatusId } from "@/lib/issue-status";

export function issueStatusCssColor(
  status: IssueStatusId | undefined,
): string {
  switch (status) {
    case "todo":
      return "var(--color-use--text-secondary)";
    case "in-progress":
      return "var(--color-use--accent)";
    case "done":
      return "var(--color-use--success)";
    case "cancel":
      return "var(--color-use--warn-strong)";
    case "draft":
    default:
      return "var(--color-use--text-secondary)";
  }
}
