/**
 * Hard-dependency (`blockedBy`) validation.
 *
 * Semantics: `issue.blockedBy` lists blockers that must complete before `issue`.
 * Graph edge: blocker → blocked.
 */

import { isValidEntityId, type EntityId } from "./dir-id.js";

export interface DepIssueRow {
  id: EntityId;
  blockedBy: readonly EntityId[];
}

/** Dedupe, drop empties; throw if any entry is not a valid entity id. */
export function normalizeBlockedBy(raw: unknown): EntityId[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new Error("blockedBy must be an array of issue ids.");
  }
  const out: EntityId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !isValidEntityId(item)) {
      throw new Error(`Invalid blockedBy id: ${JSON.stringify(item)}`);
    }
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out;
}

/** Build blocker → blocked adjacency (includes nodes with empty out-edges). */
export function buildDepAdjacency(
  rows: readonly DepIssueRow[],
): Map<EntityId, EntityId[]> {
  const adj = new Map<EntityId, EntityId[]>();
  for (const row of rows) {
    if (!adj.has(row.id)) {
      adj.set(row.id, []);
    }
  }
  for (const row of rows) {
    for (const blocker of row.blockedBy) {
      const list = adj.get(blocker) ?? [];
      list.push(row.id);
      adj.set(blocker, list);
      if (!adj.has(row.id)) {
        adj.set(row.id, []);
      }
    }
  }
  return adj;
}

export function depGraphHasCycle(adj: Map<EntityId, EntityId[]>): boolean {
  const visiting = new Set<EntityId>();
  const done = new Set<EntityId>();

  const dfs = (n: EntityId): boolean => {
    if (done.has(n)) {
      return false;
    }
    if (visiting.has(n)) {
      return true;
    }
    visiting.add(n);
    for (const m of adj.get(n) ?? []) {
      if (dfs(m)) {
        return true;
      }
    }
    visiting.delete(n);
    done.add(n);
    return false;
  };

  for (const id of adj.keys()) {
    if (dfs(id)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate `nextBlockedBy` for `targetId` against the project issue set.
 * Throws on missing ids, self-edge, or cycle. Does not mutate.
 */
export function assertValidBlockedBy(
  rows: readonly DepIssueRow[],
  targetId: EntityId,
  nextBlockedBy: readonly EntityId[],
): void {
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  if (!byId.has(targetId)) {
    throw new Error(`Issue not found for blockedBy: ${targetId}`);
  }
  for (const blocker of nextBlockedBy) {
    if (blocker === targetId) {
      throw new Error("An issue cannot block itself.");
    }
    if (!byId.has(blocker)) {
      throw new Error(
        `blockedBy references missing same-project issue: ${blocker}`,
      );
    }
  }
  const nextRows: DepIssueRow[] = rows.map((r) =>
    r.id === targetId ? { id: r.id, blockedBy: [...nextBlockedBy] } : r,
  );
  if (depGraphHasCycle(buildDepAdjacency(nextRows))) {
    throw new Error("blockedBy would create a dependency cycle.");
  }
}

/** Drop deleted issue ids from a blockedBy list. */
export function pruneDeletedFromBlockedBy(
  blockedBy: readonly EntityId[],
  deletedIds: ReadonlySet<EntityId>,
): EntityId[] {
  return blockedBy.filter((id) => !deletedIds.has(id));
}
