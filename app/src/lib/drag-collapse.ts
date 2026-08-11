import type { IssueTree } from "@/lib/types";

/** True if this node has at least one direct child in the tree. */
export function hasChildren(tree: IssueTree, key: string): boolean {
  return (tree.children[key] ?? []).length > 0;
}

/**
 * Keys that should be force-collapsed while dragging `activeId`.
 *
 * All nodes at the same hierarchy rank as active that have children:
 * - project → every project with kids
 * - issue → every issue with the same `level` that has kids
 *
 * Hides peer subtrees so sibling reorder is not stolen by expanded children.
 */
export function desiredTempCollapseKeys(
  tree: IssueTree,
  activeId: string,
): string[] {
  const active = tree.byId[activeId];
  if (!active) {
    return [];
  }

  const keys: string[] = [];
  for (const node of Object.values(tree.byId)) {
    if (!hasChildren(tree, node.key)) {
      continue;
    }
    if (active.kind === "project") {
      if (node.kind === "project") {
        keys.push(node.key);
      }
      continue;
    }
    if (
      node.kind === "issue" &&
      node.level !== undefined &&
      node.level === active.level
    ) {
      keys.push(node.key);
    }
  }
  keys.sort();
  return keys;
}

export type CollapseBaseline = Map<string, boolean>;

/**
 * Sync `collapsed` / `forced` to `desired`.
 * - Entering forced: record baseline (was collapsed?) then add to set.
 * - Leaving forced: restore baseline only for that key; never touch other keys.
 * Returns the next collapsed set (new instance if mutated).
 */
export function applyForcedCollapseDiff(
  collapsed: ReadonlySet<string>,
  forced: Set<string>,
  baseline: CollapseBaseline,
  desired: readonly string[],
): Set<string> {
  const desiredSet = new Set(desired);
  let next: Set<string> | null = null;

  const ensureWritable = (): Set<string> => {
    if (!next) {
      next = new Set(collapsed);
    }
    return next;
  };

  for (const key of [...forced]) {
    if (!desiredSet.has(key)) {
      forced.delete(key);
      const wasCollapsed = baseline.get(key) ?? false;
      baseline.delete(key);
      const writable = ensureWritable();
      if (wasCollapsed) {
        writable.add(key);
      } else {
        writable.delete(key);
      }
    }
  }

  for (const key of desiredSet) {
    if (!forced.has(key)) {
      if (!baseline.has(key)) {
        baseline.set(key, collapsed.has(key));
      }
      forced.add(key);
      ensureWritable().add(key);
    } else if (!(next ?? collapsed).has(key)) {
      // Still forced but somehow expanded — keep collapsed while forced.
      ensureWritable().add(key);
    }
  }

  return next ?? new Set(collapsed);
}

/** Pure: apply a collapse restore from snapshots (safe under setState double-invoke). */
export function applyCollapseRestore(
  collapsed: ReadonlySet<string>,
  forcedKeys: readonly string[],
  baseline: ReadonlyMap<string, boolean>,
): Set<string> {
  const next = new Set(collapsed);
  for (const key of forcedKeys) {
    if (baseline.get(key)) {
      next.add(key);
    } else {
      next.delete(key);
    }
  }
  return next;
}

/**
 * Restore every forced key from baseline and clear tracking.
 * Prefer snapshotting forced/baseline *outside* setState, then calling
 * {@link applyCollapseRestore} — mutating refs inside an updater breaks under
 * React Strict Mode double-invoke.
 */
export function restoreForcedCollapse(
  collapsed: ReadonlySet<string>,
  forced: Set<string>,
  baseline: CollapseBaseline,
): Set<string> {
  const forcedKeys = [...forced];
  const baselineSnap = new Map(baseline);
  forced.clear();
  baseline.clear();
  return applyCollapseRestore(collapsed, forcedKeys, baselineSnap);
}
