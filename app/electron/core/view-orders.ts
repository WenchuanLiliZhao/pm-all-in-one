import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import {
  emptyViewOrder,
  type ViewOrder,
} from "./view-order-apply.js";

export type { ViewOrder };
export { emptyViewOrder };

/** Reserved route keys — must not be used as custom view ids. */
export const BUILTIN_VIEW_KEYS = ["home", "roadmap", "table"] as const;
export type BuiltinViewKey = (typeof BUILTIN_VIEW_KEYS)[number];
export type ViewKey = BuiltinViewKey | string;

export type ViewOrdersFile = Record<string, ViewOrder>;

const ViewOrderZod = z.object({
  roots: z.array(z.string()),
  children: z.record(z.array(z.string())),
});

const ViewOrdersFileZod = z.record(ViewOrderZod);

export function viewOrdersPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".pm", "view-orders.json");
}

export function isBuiltinViewKey(key: string): key is BuiltinViewKey {
  return (BUILTIN_VIEW_KEYS as readonly string[]).includes(key);
}

export function isReservedViewKey(key: string): boolean {
  return isBuiltinViewKey(key);
}

function writeOrdersFile(workspaceRoot: string, data: ViewOrdersFile): void {
  const file = viewOrdersPath(workspaceRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Ensure `.pm/view-orders.json` exists. Missing/corrupt → empty map (non-destructive to views). */
export function ensureViewOrders(workspaceRoot: string): ViewOrdersFile {
  const file = viewOrdersPath(workspaceRoot);
  if (!fs.existsSync(file)) {
    const seeded: ViewOrdersFile = {};
    writeOrdersFile(workspaceRoot, seeded);
    return seeded;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return ViewOrdersFileZod.parse(raw);
  } catch {
    const seeded: ViewOrdersFile = {};
    writeOrdersFile(workspaceRoot, seeded);
    return seeded;
  }
}

export function getViewOrder(
  workspaceRoot: string,
  viewKey: string,
): ViewOrder {
  const all = ensureViewOrders(workspaceRoot);
  return all[viewKey] ?? emptyViewOrder();
}

export function getAllViewOrders(workspaceRoot: string): ViewOrdersFile {
  return ensureViewOrders(workspaceRoot);
}

export function setViewOrder(
  workspaceRoot: string,
  viewKey: string,
  order: ViewOrder,
): ViewOrder {
  if (!viewKey.trim()) {
    throw new Error("viewKey required");
  }
  const parsed = ViewOrderZod.parse(order);
  const all = ensureViewOrders(workspaceRoot);
  const next: ViewOrdersFile = { ...all, [viewKey]: parsed };
  if (parsed.roots.length === 0 && Object.keys(parsed.children).length === 0) {
    delete next[viewKey];
  }
  writeOrdersFile(workspaceRoot, next);
  return parsed;
}

/** Remove a custom view's order entry (builtins are never deleted this way). */
export function deleteViewOrder(
  workspaceRoot: string,
  viewKey: string,
): boolean {
  const all = ensureViewOrders(workspaceRoot);
  if (!(viewKey in all)) {
    return false;
  }
  const { [viewKey]: _removed, ...rest } = all;
  writeOrdersFile(workspaceRoot, rest);
  return true;
}

/**
 * After a reparent, prune `movedKey` from every view's buckets except
 * `activeViewKey` (which the caller rewrites explicitly).
 */
export function pruneKeyFromOtherViews(
  workspaceRoot: string,
  movedKey: string,
  activeViewKey: string,
): void {
  const all = ensureViewOrders(workspaceRoot);
  let dirty = false;
  const next: ViewOrdersFile = {};
  for (const [key, order] of Object.entries(all)) {
    if (key === activeViewKey) {
      next[key] = order;
      continue;
    }
    const pruned = pruneKeyFromOrder(order, movedKey);
    if (pruned !== order) {
      dirty = true;
    }
    if (pruned.roots.length > 0 || Object.keys(pruned.children).length > 0) {
      next[key] = pruned;
    } else if (key in all) {
      dirty = true;
    }
  }
  if (dirty) {
    writeOrdersFile(workspaceRoot, next);
  }
}

export function pruneKeyFromOrder(order: ViewOrder, key: string): ViewOrder {
  const roots = order.roots.filter((k) => k !== key);
  const children: Record<string, string[]> = {};
  let changed = roots.length !== order.roots.length || key in order.children;
  for (const [parent, list] of Object.entries(order.children)) {
    if (parent === key) {
      changed = true;
      continue;
    }
    const filtered = list.filter((k) => k !== key);
    if (filtered.length !== list.length) {
      changed = true;
    }
    if (filtered.length > 0) {
      children[parent] = filtered;
    } else if (list.length > 0) {
      changed = true;
    }
  }
  if (!changed) {
    return order;
  }
  return { roots, children };
}
