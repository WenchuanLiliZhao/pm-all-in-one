// ↔ src/lib/workspace/delete-cost.ts — sibling helper (IssueTree walk for UI)
// This file counts via parentId graph for core delete cost — not a duplicate API.
import type { EntityId, Issue, IssueLevel } from "../identity/types.js";

export type DescendantCounts = Record<IssueLevel, number> & { total: number };

export function emptyDescendantCounts(): DescendantCounts {
  return { epic: 0, task: 0, subtask: 0, total: 0 };
}

/**
 * Descendants of one issue by walking `parentId` (excludes `issueId` itself).
 * Flat storage has no subtree on disk, so this is a graph question.
 */
export function listDescendantIssues(
  issues: readonly Issue[],
  projectId: EntityId,
  issueId: EntityId,
): Issue[] {
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

  const out: Issue[] = [];
  const seen = new Set<EntityId>([issueId]);
  const queue = [...(childrenOf.get(issueId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current.id)) {
      continue;
    }
    seen.add(current.id);
    out.push(current);
    queue.push(...(childrenOf.get(current.id) ?? []));
  }
  return out;
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
  const counts = emptyDescendantCounts();
  for (const current of listDescendantIssues(issues, projectId, issueId)) {
    counts[current.level] += 1;
    counts.total += 1;
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
