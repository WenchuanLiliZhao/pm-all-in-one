import type { IssueTree } from "./types.js";

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
