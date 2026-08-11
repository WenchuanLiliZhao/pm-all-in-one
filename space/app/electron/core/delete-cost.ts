// ↔ src/lib/workspace/delete-cost.ts — sibling helper (IssueTree walk for UI)
// This file counts via parentId graph for core delete cost — not a duplicate API.
import type { EntityId, Issue, IssueLevel } from "./types.js";

export type DescendantCounts = Record<IssueLevel, number> & { total: number };

export function emptyDescendantCounts(): DescendantCounts {
  return { epic: 0, task: 0, subtask: 0, total: 0 };
}

/**
 * Count descendants of one issue by walking `parentId`. Flat storage has no
 * subtree on disk, so "what does deleting this cost" is a graph question.
 */
export function countDescendants(
  issues: readonly Issue[],
  projectId: EntityId,
  issueId: EntityId,
): DescendantCounts {
  const childrenOf = new Map<EntityId, Issue[]>();
  for (const issue of issues) {
    if (issue.projectId !== projectId || issue.parentId === null) {
      continue;
    }
    const bucket = childrenOf.get(issue.parentId);
    if (bucket) {
      bucket.push(issue);
    } else {
      childrenOf.set(issue.parentId, [issue]);
    }
  }

  const counts = emptyDescendantCounts();
  const seen = new Set<EntityId>([issueId]);
  const queue = [...(childrenOf.get(issueId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current.id)) {
      continue;
    }
    seen.add(current.id);
    counts[current.level] += 1;
    counts.total += 1;
    queue.push(...(childrenOf.get(current.id) ?? []));
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
