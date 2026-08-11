import type { WikiSidebarNode, WikiSidebarPlacement } from "@/lib/types";
import type { DropZone } from "@/lib/tree-dnd";

export type ContentsDropResult =
  | { ok: true; placement: WikiSidebarPlacement }
  | { ok: false; reason: string };

function findRef(
  nodes: WikiSidebarNode[],
  id: string,
): Extract<WikiSidebarNode, { type: "ref" }> | null {
  for (const node of nodes) {
    if (node.type === "ref") {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        const hit = findRef(node.children, id);
        if (hit) {
          return hit;
        }
      }
    } else if (node.type === "group") {
      const hit = findRef(node.children, id);
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}

function collectDescendantRefIds(
  node: Extract<WikiSidebarNode, { type: "ref" }>,
): Set<string> {
  const out = new Set<string>();
  const walk = (list: WikiSidebarNode[] | undefined) => {
    if (!list) {
      return;
    }
    for (const child of list) {
      if (child.type === "ref") {
        out.add(child.id);
        walk(child.children);
      } else if (child.type === "group") {
        walk(child.children);
      }
    }
  };
  walk(node.children);
  return out;
}

/** Parent ref id for `id`, or null when `id` sits at Contents root. */
export function parentRefIdOf(
  nodes: WikiSidebarNode[],
  id: string,
  parentRefId: string | null = null,
): string | null | undefined {
  for (const node of nodes) {
    if (node.type === "ref") {
      if (node.id === id) {
        return parentRefId;
      }
      if (node.children) {
        const hit = parentRefIdOf(node.children, id, node.id);
        if (hit !== undefined) {
          return hit;
        }
      }
    } else if (node.type === "group") {
      // Group children keep the nearest enclosing ref as parent for placement.
      const hit = parentRefIdOf(node.children, id, parentRefId);
      if (hit !== undefined) {
        return hit;
      }
    }
  }
  return undefined;
}

/** Index of `id` among siblings in its parent list; -1 if missing. */
export function indexAmongSiblings(
  nodes: WikiSidebarNode[],
  id: string,
): number {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "ref" && node.id === id) {
      return i;
    }
  }
  for (const node of nodes) {
    if (node.type === "ref" && node.children) {
      const hit = indexAmongSiblings(node.children, id);
      if (hit >= 0) {
        return hit;
      }
    } else if (node.type === "group") {
      // Prefer searching group children for the direct sibling index.
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]!;
        if (child.type === "ref" && child.id === id) {
          return i;
        }
      }
      const hit = indexAmongSiblings(node.children, id);
      if (hit >= 0) {
        return hit;
      }
    }
  }
  return -1;
}

function siblingListContaining(
  nodes: WikiSidebarNode[],
  id: string,
): WikiSidebarNode[] | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "ref" && node.id === id) {
      return nodes;
    }
  }
  for (const node of nodes) {
    if (node.type === "ref" && node.children) {
      const hit = siblingListContaining(node.children, id);
      if (hit) {
        return hit;
      }
    } else if (node.type === "group") {
      const hit = siblingListContaining(node.children, id);
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}

/** Collapse key for a `group` node, which has no id of its own. */
export function contentsGroupKey(
  depth: number,
  title: string,
  index: number,
): string {
  return `group:${depth}:${title}:${index}`;
}

export type ContentsRow =
  | {
      kind: "ref";
      key: string;
      depth: number;
      node: Extract<WikiSidebarNode, { type: "ref" }>;
      hasChildren: boolean;
    }
  | {
      kind: "group";
      key: string;
      depth: number;
      title: string;
      hasChildren: boolean;
    }
  | {
      kind: "link";
      key: string;
      depth: number;
      label: string;
      href: string;
    };

/**
 * Flatten the sidebar tree into visible rows in visual order (respecting the
 * collapsed set). Depth is carried on the row so the tree can be painted as a
 * single flat list — nesting `<ul>` inside `<li>` makes dnd-kit measure
 * transformed ancestors and destroys the drag feel.
 */
export function flattenContentsRows(
  nodes: WikiSidebarNode[],
  collapsed: ReadonlySet<string>,
): ContentsRow[] {
  const out: ContentsRow[] = [];
  const walk = (list: WikiSidebarNode[], depth: number) => {
    for (let i = 0; i < list.length; i++) {
      const node = list[i]!;
      if (node.type === "ref") {
        const hasChildren = (node.children?.length ?? 0) > 0;
        out.push({ kind: "ref", key: node.id, depth, node, hasChildren });
        if (hasChildren && !collapsed.has(node.id)) {
          walk(node.children!, depth + 1);
        }
        continue;
      }
      if (node.type === "group") {
        const key = contentsGroupKey(depth, node.title, i);
        const hasChildren = node.children.length > 0;
        out.push({ kind: "group", key, depth, title: node.title, hasChildren });
        if (hasChildren && !collapsed.has(key)) {
          walk(node.children, depth + 1);
        }
        continue;
      }
      out.push({
        kind: "link",
        key: `link:${depth}:${i}:${node.href}`,
        depth,
        label: node.label,
        href: node.href,
      });
    }
  };
  walk(nodes, 0);
  return out;
}

/**
 * Ref ids to force-collapse while dragging `activeId`: every ref at the same
 * depth that has children. Hides peer subtrees so a sibling reorder is not
 * stolen by an expanded child row sitting between the two siblings.
 */
export function desiredContentsTempCollapseKeys(
  sidebar: WikiSidebarNode[],
  activeId: string,
): string[] {
  const rows = flattenContentsRows(sidebar, new Set<string>());
  const active = rows.find(
    (row) => row.kind === "ref" && row.key === activeId,
  );
  if (!active) {
    return [];
  }
  return rows
    .filter(
      (row) =>
        row.kind === "ref" && row.hasChildren && row.depth === active.depth,
    )
    .map((row) => row.key)
    .sort();
}

/** Flatten visible ref ids in visual order (respecting collapsed set). */
export function flattenVisibleRefIds(
  nodes: WikiSidebarNode[],
  collapsed: ReadonlySet<string>,
): string[] {
  return flattenContentsRows(nodes, collapsed)
    .filter((row) => row.kind === "ref")
    .map((row) => row.key);
}

export function resolveContentsDrop(
  sidebar: WikiSidebarNode[],
  activeId: string,
  overId: string,
  zone: DropZone,
): ContentsDropResult {
  if (activeId === overId) {
    return { ok: false, reason: "same row" };
  }
  const over = findRef(sidebar, overId);
  if (!over) {
    return { ok: false, reason: "drop target must be a page" };
  }
  const active = findRef(sidebar, activeId);
  if (!active) {
    return { ok: false, reason: "active not in Contents" };
  }
  if (collectDescendantRefIds(active).has(overId)) {
    return { ok: false, reason: "cannot drop into own subtree" };
  }

  if (zone === "into") {
    return {
      ok: true,
      placement: {
        parentId: overId,
        index: over.children?.length ?? 0,
      },
    };
  }

  const parentId = parentRefIdOf(sidebar, overId);
  if (parentId === undefined) {
    return { ok: false, reason: "over not found" };
  }
  const siblings = siblingListContaining(sidebar, overId);
  if (!siblings) {
    return { ok: false, reason: "over siblings missing" };
  }
  const overIndex = siblings.findIndex(
    (n) => n.type === "ref" && n.id === overId,
  );
  if (overIndex < 0) {
    return { ok: false, reason: "over index missing" };
  }
  return {
    ok: true,
    placement: {
      parentId,
      index: zone === "before" ? overIndex : overIndex + 1,
    },
  };
}

/**
 * Apply a Contents placement locally (mirrors core
 * `moveWikiNodeToSidebarPosition`). Used to update the sortable item list
 * synchronously on drop so dnd-kit does not animate the row back to its
 * pre-drop index while the IPC round-trip is in flight.
 */
export function applySidebarPlacement(
  sidebar: WikiSidebarNode[],
  id: string,
  placement: WikiSidebarPlacement,
): WikiSidebarNode[] {
  const next = JSON.parse(JSON.stringify(sidebar)) as WikiSidebarNode[];
  const loc = findRefSiblingLocation(next, id);
  if (!loc) {
    throw new Error(`Page not in sidebar: ${id}`);
  }
  const [node] = loc.siblings.splice(loc.index, 1);
  if (!node || node.type !== "ref") {
    throw new Error(`Page not in sidebar: ${id}`);
  }
  let targetList: WikiSidebarNode[];
  if (placement.parentId === null) {
    targetList = next;
  } else {
    const parent = findRef(next, placement.parentId);
    if (!parent) {
      throw new Error(`Contents parent not found: ${placement.parentId}`);
    }
    if (!parent.children) {
      parent.children = [];
    }
    targetList = parent.children;
  }
  const sameParentArray = loc.siblings === targetList;
  let finalIndex = Number.isFinite(placement.index)
    ? Math.floor(placement.index)
    : 0;
  if (sameParentArray && loc.index < placement.index) {
    finalIndex = placement.index - 1;
  }
  finalIndex = Math.max(0, Math.min(finalIndex, targetList.length));
  targetList.splice(finalIndex, 0, node);
  return next;
}

export type WikiSidebarMove = "up" | "down" | "indent" | "outdent";

export type RefSiblingLocation = {
  siblings: WikiSidebarNode[];
  index: number;
  /** Nearest enclosing ref id, or null at Contents root / under a root-level group. */
  parentRefId: string | null;
};

/** Locate a ref among its sibling list (mirrors core findPageLocation parent array). */
export function findRefSiblingLocation(
  nodes: WikiSidebarNode[],
  id: string,
  parentRefId: string | null = null,
): RefSiblingLocation | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "ref") {
      if (node.id === id) {
        return { siblings: nodes, index: i, parentRefId };
      }
      if (node.children?.length) {
        const hit = findRefSiblingLocation(node.children, id, node.id);
        if (hit) {
          return hit;
        }
      }
    } else if (node.type === "group") {
      const hit = findRefSiblingLocation(node.children, id, parentRefId);
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}

/**
 * Whether a discrete Contents move would change the tree (matches
 * `moveWikiNodeInSidebar` enablement: indent needs prev sibling ref;
 * outdent needs an enclosing parent ref).
 */
export function canSidebarMove(
  sidebar: WikiSidebarNode[],
  id: string,
  move: WikiSidebarMove,
): boolean {
  const loc = findRefSiblingLocation(sidebar, id);
  if (!loc) {
    return false;
  }
  const { siblings, index, parentRefId } = loc;
  if (move === "up") {
    return index > 0;
  }
  if (move === "down") {
    return index < siblings.length - 1;
  }
  if (move === "indent") {
    if (index <= 0) {
      return false;
    }
    return siblings[index - 1]!.type === "ref";
  }
  if (move === "outdent") {
    return parentRefId !== null;
  }
  return false;
}

/** Ref ids that share the sibling list containing `id` (for drop-group highlight). */
export function contentsSiblingRefIds(
  sidebar: WikiSidebarNode[],
  id: string,
): Set<string> {
  const loc = findRefSiblingLocation(sidebar, id);
  const out = new Set<string>();
  if (!loc) {
    return out;
  }
  for (const node of loc.siblings) {
    if (node.type === "ref") {
      out.add(node.id);
    }
  }
  return out;
}
