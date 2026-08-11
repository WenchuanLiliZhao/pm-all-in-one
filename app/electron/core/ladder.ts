/**
 * Ladder rules for the fixed epic -> task -> subtask hierarchy.
 *
 * Pure functions only: no fs, no paths. Callers supply `parentKey`, so the same
 * module serves a nested layout (parent = containing directory) and a flat one
 * (parent = `parentId` field).
 *
 * The ladder exists because `level` is stated in props.ts while placement is
 * stated separately. That redundancy is deliberate: it is what makes a wrong
 * parent detectable instead of silently reinterpreted.
 */
import type { IssueLevel } from "./types.js";

export const LEVELS: readonly IssueLevel[] = ["epic", "task", "subtask"];

export const MAX_DEPTH = LEVELS.length - 1;

export function levelDepth(level: IssueLevel): number {
  return LEVELS.indexOf(level);
}

export function levelAtDepth(depth: number): IssueLevel | null {
  return LEVELS[depth] ?? null;
}

export function nextLevel(level: IssueLevel): IssueLevel | null {
  return levelAtDepth(levelDepth(level) + 1);
}

export function isIssueLevel(value: unknown): value is IssueLevel {
  return typeof value === "string" && LEVELS.includes(value as IssueLevel);
}

export interface LadderRow {
  key: string;
  level: IssueLevel;
  parentKey: string | null;
}

export type LadderViolationKind =
  /**
   * props.ts states no usable `level`. Raised by the store, not by
   * `validateLadder`, which only sees rows that already have one.
   */
  | "level-missing"
  /** `parentKey` points at the row itself. */
  | "self-parent"
  /** `parentKey` names a row that does not exist. */
  | "missing-parent"
  /** Row participates in a parent cycle. */
  | "cycle"
  /** No parent, but level is not `epic`. */
  | "root-not-epic"
  /** Level is not one step below the parent's level. */
  | "ladder-break";

export interface LadderViolation {
  kind: LadderViolationKind;
  message: string;
  /** What the ladder expects given the parent, when that is knowable. */
  expectedLevel: IssueLevel | null;
}

export type LadderReport = Map<string, LadderViolation[]>;

function indexByKey(rows: readonly LadderRow[]): Map<string, LadderRow> {
  const byKey = new Map<string, LadderRow>();
  for (const row of rows) {
    byKey.set(row.key, row);
  }
  return byKey;
}

/** Keys that sit on (or hang off) a parent cycle. */
function findCyclic(rows: readonly LadderRow[]): Set<string> {
  const byKey = indexByKey(rows);
  const cyclic = new Set<string>();
  const settled = new Set<string>();

  for (const row of rows) {
    if (settled.has(row.key)) {
      continue;
    }
    const chain: string[] = [];
    const onChain = new Set<string>();
    let cursor: LadderRow | undefined = row;

    while (cursor && !settled.has(cursor.key)) {
      if (onChain.has(cursor.key)) {
        for (const key of chain) {
          cyclic.add(key);
        }
        break;
      }
      chain.push(cursor.key);
      onChain.add(cursor.key);
      cursor = cursor.parentKey === null ? undefined : byKey.get(cursor.parentKey);
    }

    // A chain that reaches a known-cyclic node is itself unresolvable.
    if (cursor && cyclic.has(cursor.key)) {
      for (const key of chain) {
        cyclic.add(key);
      }
    }
    for (const key of chain) {
      settled.add(key);
    }
  }

  return cyclic;
}

/**
 * Report every row whose stated level disagrees with its stated parent.
 * Only rows with problems appear in the result.
 */
export function validateLadder(rows: readonly LadderRow[]): LadderReport {
  const byKey = indexByKey(rows);
  const cyclic = findCyclic(rows);
  const report: LadderReport = new Map();

  const add = (key: string, violation: LadderViolation): void => {
    const list = report.get(key);
    if (list) {
      list.push(violation);
    } else {
      report.set(key, [violation]);
    }
  };

  for (const row of rows) {
    if (row.parentKey === row.key) {
      add(row.key, {
        kind: "self-parent",
        message: "Parent points at itself.",
        expectedLevel: null,
      });
      continue;
    }

    if (cyclic.has(row.key)) {
      add(row.key, {
        kind: "cycle",
        message: "Parent chain forms a cycle, so this issue has no level.",
        expectedLevel: null,
      });
      continue;
    }

    if (row.parentKey === null) {
      if (row.level !== "epic") {
        add(row.key, {
          kind: "root-not-epic",
          message: `Has no parent but claims level "${row.level}"; top-level issues are epics.`,
          expectedLevel: "epic",
        });
      }
      continue;
    }

    const parent = byKey.get(row.parentKey);
    if (!parent) {
      add(row.key, {
        kind: "missing-parent",
        message: `Parent ${row.parentKey} does not exist.`,
        expectedLevel: null,
      });
      continue;
    }

    const expected = nextLevel(parent.level);
    if (expected === null) {
      add(row.key, {
        kind: "ladder-break",
        message: `Parent ${parent.key} is a subtask and cannot have children.`,
        expectedLevel: null,
      });
      continue;
    }
    if (row.level !== expected) {
      add(row.key, {
        kind: "ladder-break",
        message: `Parent ${parent.key} is a ${parent.level}, so this must be a ${expected}, not a ${row.level}.`,
        expectedLevel: expected,
      });
    }
  }

  return report;
}

/**
 * Ancestor count per key, for reading the level of a props.ts that does not
 * state one. `null` where the chain never terminates.
 */
export function depthFromParents(
  parents: ReadonlyMap<string, string | null>,
): Map<string, number | null> {
  const depths = new Map<string, number | null>();

  const resolve = (key: string, onChain: Set<string>): number | null => {
    const cached = depths.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (onChain.has(key)) {
      return null;
    }
    const parentKey = parents.get(key);
    if (parentKey === undefined || parentKey === null) {
      depths.set(key, 0);
      return 0;
    }
    if (!parents.has(parentKey)) {
      depths.set(key, 0);
      return 0;
    }
    onChain.add(key);
    const parentDepth = resolve(parentKey, onChain);
    onChain.delete(key);
    const depth = parentDepth === null ? null : parentDepth + 1;
    depths.set(key, depth);
    return depth;
  };

  for (const key of parents.keys()) {
    resolve(key, new Set());
  }
  return depths;
}

export function buildChildIndex(
  rows: readonly LadderRow[],
): Map<string | null, string[]> {
  const children = new Map<string | null, string[]>();
  for (const row of rows) {
    const bucket = children.get(row.parentKey);
    if (bucket) {
      bucket.push(row.key);
    } else {
      children.set(row.parentKey, [row.key]);
    }
  }
  return children;
}

/** Descendant keys of `key`, breadth-first, excluding `key` itself. */
export function descendantsOf(
  rows: readonly LadderRow[],
  key: string,
): string[] {
  const children = buildChildIndex(rows);
  const out: string[] = [];
  const seen = new Set<string>([key]);
  const queue = [...(children.get(key) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);
    out.push(current);
    queue.push(...(children.get(current) ?? []));
  }
  return out;
}

/** Relative depth of the deepest descendant (0 when `key` has no children). */
export function subtreeHeight(rows: readonly LadderRow[], key: string): number {
  const children = buildChildIndex(rows);
  let height = 0;
  const seen = new Set<string>([key]);
  let frontier = [...(children.get(key) ?? [])].filter((k) => !seen.has(k));
  while (frontier.length > 0) {
    height += 1;
    const next: string[] = [];
    for (const current of frontier) {
      if (seen.has(current)) {
        continue;
      }
      seen.add(current);
      next.push(...(children.get(current) ?? []));
    }
    frontier = next.filter((k) => !seen.has(k));
  }
  return height;
}

export interface LevelChange {
  key: string;
  from: IssueLevel;
  to: IssueLevel;
}

/**
 * Levels to rewrite so that `key` becomes a child of `newParentKey`.
 *
 * Reparenting is not a single-field edit: re-leveling a task to an epic re-levels
 * its whole subtree with it. Throws when the move is illegal (cycle, unknown
 * target, or a subtree that would not fit under the ladder).
 */
export function planMove(
  rows: readonly LadderRow[],
  key: string,
  newParentKey: string | null,
): LevelChange[] {
  const byKey = indexByKey(rows);
  const row = byKey.get(key);
  if (!row) {
    throw new Error(`Unknown issue: ${key}`);
  }
  if (newParentKey === key) {
    throw new Error("Cannot make an issue its own parent");
  }
  if (findCyclic(rows).has(key)) {
    throw new Error(
      `Cannot move ${key}: its parent chain is broken. Fix the cycle first.`,
    );
  }

  let targetLevel: IssueLevel;
  if (newParentKey === null) {
    targetLevel = "epic";
  } else {
    const parent = byKey.get(newParentKey);
    if (!parent) {
      throw new Error(`Unknown parent: ${newParentKey}`);
    }
    if (descendantsOf(rows, key).includes(newParentKey)) {
      throw new Error("Cannot move an issue into its own subtree");
    }
    const next = nextLevel(parent.level);
    if (next === null) {
      throw new Error(
        `Cannot nest under ${newParentKey}: subtasks cannot have children`,
      );
    }
    targetLevel = next;
  }

  const targetDepth = levelDepth(targetLevel);
  const height = subtreeHeight(rows, key);
  if (targetDepth + height > MAX_DEPTH) {
    const deepest = levelAtDepth(MAX_DEPTH)!;
    throw new Error(
      `Move would push descendants past ${deepest}: target depth ${targetDepth} plus subtree height ${height} exceeds ${MAX_DEPTH}`,
    );
  }

  const children = buildChildIndex(rows);
  const changes: LevelChange[] = [];
  const seen = new Set<string>();
  let frontier: string[] = [key];
  let depth = targetDepth;

  while (frontier.length > 0) {
    const level = levelAtDepth(depth);
    if (level === null) {
      break;
    }
    const next: string[] = [];
    for (const current of frontier) {
      if (seen.has(current)) {
        continue;
      }
      seen.add(current);
      const currentRow = byKey.get(current);
      if (currentRow && currentRow.level !== level) {
        changes.push({ key: current, from: currentRow.level, to: level });
      }
      next.push(...(children.get(current) ?? []));
    }
    frontier = next.filter((k) => !seen.has(k));
    depth += 1;
  }

  return changes;
}

/**
 * True when moving `key` under `newParentKey` keeps every level in the subtree
 * unchanged (empty LevelChange[]). Used by DnD so the GUI never promote/demotes;
 * unrestricted `moveIssue` / repair still call `planMove` directly.
 */
export function canReparentPreservingLevel(
  rows: readonly LadderRow[],
  key: string,
  newParentKey: string | null,
): boolean {
  try {
    return planMove(rows, key, newParentKey).length === 0;
  } catch {
    return false;
  }
}
