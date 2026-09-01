// ↔ electron/core/views/view-orders.ts — CLI persist uses append/reparent helpers
import type { IssueTree } from "../identity/types.js";

export interface ViewOrder {
  /** Ordered project keys (`String(projectId)`). */
  roots: string[];
  /** parentKey → ordered child keys (project or issueRefKey). */
  children: Record<string, string[]>;
}

export function emptyViewOrder(): ViewOrder {
  return { roots: [], children: {} };
}

/**
 * Apply a sparse per-view order over a title-sorted tree.
 * Known keys keep the stored order; missing siblings append in tree order.
 */
export function applyViewOrder(
  tree: IssueTree,
  order: ViewOrder | null | undefined,
): IssueTree {
  const o = order ?? emptyViewOrder();
  const roots = mergeOrdered(tree.roots, o.roots);
  const children: Record<string, string[]> = {};
  const parentKeys = new Set([
    ...Object.keys(tree.children),
    ...Object.keys(o.children),
  ]);
  for (const parent of parentKeys) {
    const live = tree.children[parent] ?? [];
    if (live.length === 0 && !(parent in o.children)) {
      continue;
    }
    children[parent] = mergeOrdered(live, o.children[parent] ?? []);
  }
  return { byId: tree.byId, roots, children };
}

function mergeOrdered(
  live: readonly string[],
  preferred: readonly string[],
): string[] {
  const liveSet = new Set(live);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of preferred) {
    if (liveSet.has(key) && !seen.has(key)) {
      out.push(key);
      seen.add(key);
    }
  }
  for (const key of live) {
    if (!seen.has(key)) {
      out.push(key);
      seen.add(key);
    }
  }
  return out;
}

/** Reorder `activeId` among siblings under `parentKey` (null = roots). */
export function reorderSiblingInOrder(
  order: ViewOrder,
  parentKey: string | null,
  activeId: string,
  overId: string,
): ViewOrder {
  const list =
    parentKey === null
      ? [...(order.roots.length ? order.roots : [])]
      : [...(order.children[parentKey] ?? [])];

  ensureInList(list, activeId);
  ensureInList(list, overId);

  const from = list.indexOf(activeId);
  const to = list.indexOf(overId);
  if (from < 0 || to < 0 || from === to) {
    return order;
  }
  list.splice(from, 1);
  list.splice(to, 0, activeId);

  if (parentKey === null) {
    return { ...order, roots: list };
  }
  return {
    ...order,
    children: { ...order.children, [parentKey]: list },
  };
}

/**
 * Move `activeId` from `fromParent` to `toParent` at index before `beforeId`
 * (or append if beforeId is null). Parents use tree keys; null parent = roots.
 */
export function reparentInOrder(
  order: ViewOrder,
  activeId: string,
  fromParent: string | null,
  toParent: string | null,
  beforeId: string | null,
): ViewOrder {
  let roots = [...order.roots];
  const children: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(order.children)) {
    children[k] = [...v];
  }

  const removeFrom = (parent: string | null): void => {
    if (parent === null) {
      roots = roots.filter((k) => k !== activeId);
      return;
    }
    const list = children[parent];
    if (!list) {
      return;
    }
    children[parent] = list.filter((k) => k !== activeId);
    if (children[parent]!.length === 0) {
      delete children[parent];
    }
  };

  removeFrom(fromParent);

  const insertInto = (parent: string | null): void => {
    const list =
      parent === null ? roots : (children[parent] = children[parent] ?? []);
    const filtered = list.filter((k) => k !== activeId);
    const idx = beforeId ? filtered.indexOf(beforeId) : -1;
    if (idx < 0) {
      filtered.push(activeId);
    } else {
      filtered.splice(idx, 0, activeId);
    }
    if (parent === null) {
      roots = filtered;
    } else {
      children[parent] = filtered;
    }
  };

  insertInto(toParent);
  return { roots, children };
}

/**
 * Place `childKey` last under `parentKey`. Stored siblings keep their order;
 * other live siblings are materialized in tree order before the append.
 */
export function appendSiblingToEnd(
  order: ViewOrder,
  parentKey: string,
  childKey: string,
  liveSiblings: readonly string[],
): ViewOrder {
  const stored = order.children[parentKey] ?? [];
  const liveWithout = liveSiblings.filter((k) => k !== childKey);
  const storedWithout = stored.filter((k) => k !== childKey);
  const merged = mergeOrdered(liveWithout, storedWithout);
  if (!merged.includes(childKey)) {
    merged.push(childKey);
  }
  const same =
    stored.length === merged.length && stored.every((k, i) => k === merged[i]);
  if (same) {
    return order;
  }
  return {
    ...order,
    children: { ...order.children, [parentKey]: merged },
  };
}

/**
 * Remove `childKey` from every parent list, then append it on `toParentKey`.
 * Keeps `children[childKey]` (the moved node's own subtree order).
 */
export function reparentSiblingToEnd(
  order: ViewOrder,
  childKey: string,
  fromParentKey: string,
  toParentKey: string,
  liveDestSiblings: readonly string[],
): ViewOrder {
  if (fromParentKey === toParentKey) {
    return order;
  }
  const roots = order.roots.filter((k) => k !== childKey);
  const children: Record<string, string[]> = {};
  for (const [parent, list] of Object.entries(order.children)) {
    if (parent === toParentKey) {
      continue;
    }
    const filtered = list.filter((k) => k !== childKey);
    if (filtered.length > 0) {
      children[parent] = filtered;
    }
  }
  return appendSiblingToEnd(
    { roots, children },
    toParentKey,
    childKey,
    liveDestSiblings,
  );
}

/**
 * Seed an order from the live tree for the sibling group being edited,
 * so sparse files become complete for that parent before rewrite.
 */
export function materializeSiblingOrder(
  tree: IssueTree,
  order: ViewOrder,
  parentKey: string | null,
): ViewOrder {
  const live =
    parentKey === null ? tree.roots : (tree.children[parentKey] ?? []);
  const preferred =
    parentKey === null ? order.roots : (order.children[parentKey] ?? []);
  const merged = mergeOrdered(live, preferred);
  if (parentKey === null) {
    return { ...order, roots: merged };
  }
  return {
    ...order,
    children: { ...order.children, [parentKey]: merged },
  };
}

function ensureInList(list: string[], id: string): void {
  if (!list.includes(id)) {
    list.push(id);
  }
}
