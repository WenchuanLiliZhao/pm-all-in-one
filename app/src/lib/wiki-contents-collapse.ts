/**
 * Wiki Contents fold prefs — machine-local UI chrome (localStorage).
 * ↔ components/wiki-shell — consume collapsed + default depth
 * ↔ pages/.../route SettingsGeneralView — depth number input
 * ↔ wiki @wiki-5FG_8PUrpU4edQeivzJcx — inventory
 */
import type { WikiSidebarRootNode } from "@/lib/types";
import { contentsGroupKey } from "@/lib/wiki-contents-dnd";

export const WIKI_CONTENTS_COLLAPSED_KEY = "pm.wiki.contents.collapsed";
export const WIKI_CONTENTS_DEFAULT_EXPAND_DEPTH_KEY =
  "pm.wiki.contents.defaultExpandDepth";

/** Fired in-page when Settings changes the default depth (storage event is cross-tab only). */
export const WIKI_CONTENTS_DEPTH_CHANGED_EVENT =
  "pm:wiki-contents-default-expand-depth";

const DEFAULT_EXPAND_DEPTH = 1;

export function readWikiContentsDefaultExpandDepth(): number {
  try {
    const raw = localStorage.getItem(WIKI_CONTENTS_DEFAULT_EXPAND_DEPTH_KEY);
    if (raw === null) {
      return DEFAULT_EXPAND_DEPTH;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return DEFAULT_EXPAND_DEPTH;
    }
    return Math.floor(n);
  } catch {
    return DEFAULT_EXPAND_DEPTH;
  }
}

export function writeWikiContentsDefaultExpandDepth(depth: number): number {
  const n = Number.isFinite(depth) && depth >= 0 ? Math.floor(depth) : DEFAULT_EXPAND_DEPTH;
  try {
    localStorage.setItem(WIKI_CONTENTS_DEFAULT_EXPAND_DEPTH_KEY, String(n));
  } catch {
    // private mode / disabled storage
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(WIKI_CONTENTS_DEPTH_CHANGED_EVENT, { detail: n }),
    );
  }
  return n;
}

export function readWikiContentsCollapsed(): Set<string> | null {
  try {
    const raw = localStorage.getItem(WIKI_CONTENTS_COLLAPSED_KEY);
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return new Set(parsed.filter((k): k is string => typeof k === "string"));
  } catch {
    return null;
  }
}

export function writeWikiContentsCollapsed(collapsed: ReadonlySet<string>): void {
  try {
    localStorage.setItem(
      WIKI_CONTENTS_COLLAPSED_KEY,
      JSON.stringify([...collapsed]),
    );
  } catch {
    // private mode / disabled storage
  }
}

/**
 * Collapse every foldable Contents node whose depth >= `expandDepth`.
 * Depth 0 = only top-level rows visible; larger values show more nesting.
 * Root columns are not foldable — children keep the column's depth
 * (same as implicit standing / Contents). Group keys match
 * `flattenContentsRows` (`contentsGroupKey`).
 */
export function collapsedKeysForExpandDepth(
  nodes: WikiSidebarRootNode[],
  expandDepth: number,
): Set<string> {
  const collapsed = new Set<string>();
  const depthCap = Number.isFinite(expandDepth)
    ? Math.max(0, Math.floor(expandDepth))
    : DEFAULT_EXPAND_DEPTH;

  const walk = (list: WikiSidebarRootNode[], depth: number) => {
    for (let i = 0; i < list.length; i++) {
      const node = list[i]!;
      if (node.type === "column") {
        walk(node.children, depth);
        continue;
      }
      if (node.type === "ref") {
        const hasChildren = (node.children?.length ?? 0) > 0;
        if (hasChildren && depth >= depthCap) {
          collapsed.add(node.id);
        }
        if (hasChildren) {
          walk(node.children!, depth + 1);
        }
        continue;
      }
      if (node.type === "group") {
        const key = contentsGroupKey(depth, node.title, i);
        const hasChildren = node.children.length > 0;
        if (hasChildren && depth >= depthCap) {
          collapsed.add(key);
        }
        if (hasChildren) {
          walk(node.children, depth + 1);
        }
      }
    }
  };
  walk(nodes, 0);
  return collapsed;
}

/** Initial collapsed set: persisted fold wins; else derive from default depth. */
export function initialWikiContentsCollapsed(
  nodes: WikiSidebarRootNode[],
): Set<string> {
  const saved = readWikiContentsCollapsed();
  return (
    saved ??
    collapsedKeysForExpandDepth(
      nodes,
      readWikiContentsDefaultExpandDepth(),
    )
  );
}
