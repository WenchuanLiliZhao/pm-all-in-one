/**
 * Sibling order for `issue list`: blockedBy first, then stored roadmap
 * order, then title. Cancel sorts after still-open issues with the same deps.
 * ↔ electron/cli.ts — formatIssueListTree
 */
import { issueRefKey, type Issue } from "../identity/types.js";

export type IssueListOrderSlice = Pick<
  Issue,
  "id" | "projectId" | "title" | "status" | "blockedBy"
>;

function preferredIndex(
  issue: IssueListOrderSlice,
  preferredKeys: readonly string[],
): number {
  const key = issueRefKey(issue.projectId, issue.id);
  const i = preferredKeys.indexOf(key);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

function compareReady(
  a: IssueListOrderSlice,
  b: IssueListOrderSlice,
  preferredKeys: readonly string[],
): number {
  const aCancel = a.status === "cancel" ? 1 : 0;
  const bCancel = b.status === "cancel" ? 1 : 0;
  if (aCancel !== bCancel) {
    return aCancel - bCancel;
  }
  const aPref = preferredIndex(a, preferredKeys);
  const bPref = preferredIndex(b, preferredKeys);
  if (aPref !== bPref) {
    return aPref - bPref;
  }
  const byTitle = a.title.localeCompare(b.title);
  if (byTitle !== 0) {
    return byTitle;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Kahn topological sort among `siblings` using `blockedBy` edges that stay
 * inside the set. Ready-set tie-break: cancel last, then `preferredKeys`
 * (roadmap view-order), then title.
 */
export function sortIssueSiblings<T extends IssueListOrderSlice>(
  siblings: readonly T[],
  preferredKeys: readonly string[] = [],
): T[] {
  if (siblings.length <= 1) {
    return [...siblings];
  }
  const byId = new Map(siblings.map((s) => [s.id, s]));
  const ids = new Set(siblings.map((s) => s.id));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const s of siblings) {
    indegree.set(s.id, 0);
    outgoing.set(s.id, []);
  }
  for (const s of siblings) {
    for (const blocker of s.blockedBy) {
      if (!ids.has(blocker)) {
        continue;
      }
      outgoing.get(blocker)?.push(s.id);
      indegree.set(s.id, (indegree.get(s.id) ?? 0) + 1);
    }
  }

  const cmpIds = (a: string, b: string): number => {
    const ia = byId.get(a);
    const ib = byId.get(b);
    if (!ia || !ib) {
      return a.localeCompare(b);
    }
    return compareReady(ia, ib, preferredKeys);
  };

  const ready = siblings
    .filter((s) => (indegree.get(s.id) ?? 0) === 0)
    .map((s) => s.id)
    .sort(cmpIds);
  const out: T[] = [];
  const seen = new Set<string>();
  while (ready.length > 0) {
    const id = ready.shift();
    if (id === undefined || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const node = byId.get(id);
    if (node) {
      out.push(node);
    }
    for (const next of outgoing.get(id) ?? []) {
      const nextDeg = (indegree.get(next) ?? 1) - 1;
      indegree.set(next, nextDeg);
      if (nextDeg === 0) {
        ready.push(next);
        ready.sort(cmpIds);
      }
    }
  }
  if (out.length < siblings.length) {
    const leftover = siblings
      .filter((s) => !seen.has(s.id))
      .sort((a, b) => compareReady(a, b, preferredKeys));
    out.push(...leftover);
  }
  return out;
}
