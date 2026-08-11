// ↔ electron/core/sync/delete-cost.ts — sibling helper (parentId graph); shared formatDescendantCost shape
// Not a byte-sync mirror: this file walks IssueTree for UI delete cost.
import type { IssueLevel, IssueTree } from "@/lib/types";

export type DescendantCounts = Record<IssueLevel, number> & { total: number };

export function countTreeDescendants(
  tree: IssueTree,
  rootKey: string,
): DescendantCounts {
  const counts: DescendantCounts = {
    epic: 0,
    task: 0,
    subtask: 0,
    total: 0,
  };
  const stack = [...(tree.children[rootKey] ?? [])];
  while (stack.length > 0) {
    const key = stack.pop()!;
    const node = tree.byId[key];
    if (!node) {
      continue;
    }
    if (node.kind === "issue" && node.level) {
      counts[node.level] += 1;
      counts.total += 1;
    }
    const kids = tree.children[key];
    if (kids?.length) {
      stack.push(...kids);
    }
  }
  return counts;
}

export function formatDescendantCost(counts: DescendantCounts): string {
  if (counts.total === 0) {
    return "";
  }
  const parts: string[] = [];
  if (counts.epic) {
    parts.push(`${counts.epic} epic${counts.epic === 1 ? "" : "s"}`);
  }
  if (counts.task) {
    parts.push(
      `${counts.task} task${counts.task === 1 ? "" : "s"}`,
    );
  }
  if (counts.subtask) {
    parts.push(`${counts.subtask} subtask${counts.subtask === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}
