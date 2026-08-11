import type { IssueTree } from "@/lib/types";
import { hasChildren } from "@/lib/drag-collapse";

/** Ladder ranks that support bulk collapse (subtask is never a target). */
export type CollapseLevel = "project" | "epic" | "task";

/**
 * Keys of foldable nodes at `level` (have children). Sorted for stability.
 * - project → every project with kids
 * - epic / task → issues at that level with kids
 */
export function collapseKeysForLevel(
  tree: IssueTree,
  level: CollapseLevel,
): string[] {
  const keys: string[] = [];
  for (const node of Object.values(tree.byId)) {
    if (!hasChildren(tree, node.key)) {
      continue;
    }
    if (level === "project") {
      if (node.kind === "project") {
        keys.push(node.key);
      }
      continue;
    }
    if (node.kind === "issue" && node.level === level) {
      keys.push(node.key);
    }
  }
  keys.sort();
  return keys;
}

/** Union foldable keys for `level` into a new collapsed set. */
export function applyCollapseLevel(
  collapsed: ReadonlySet<string>,
  tree: IssueTree,
  level: CollapseLevel,
): Set<string> {
  const next = new Set(collapsed);
  for (const key of collapseKeysForLevel(tree, level)) {
    next.add(key);
  }
  return next;
}

/** Empty collapsed set — full tree expanded. */
export function expandAllCollapsed(): Set<string> {
  return new Set();
}
