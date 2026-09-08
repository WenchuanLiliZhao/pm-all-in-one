import type {
  WikiSidebarColumnKind,
  WikiSidebarColumnNode,
  WikiSidebarNode,
  WikiSidebarPlacement,
  WikiSidebarRootNode,
} from "@/lib/types";
import type { DropZone } from "@/lib/tree-dnd";

export type ContentsDropResult =
  | { ok: true; placement: WikiSidebarPlacement }
  | { ok: false; reason: string };

/** Collapse / droppable id for a root column. Stable across title edits. */
export function contentsColumnKey(kind: WikiSidebarColumnKind): string {
  return `column:${kind}`;
}

export function parseContentsColumnKey(
  key: string,
): WikiSidebarColumnKind | null {
  if (key === "column:standing") {
    return "standing";
  }
  if (key === "column:record") {
    return "record";
  }
  return null;
}

const DEFAULT_COLUMN_TITLE: Record<WikiSidebarColumnKind, string> = {
  standing: "Standing",
  record: "Records",
};

function findColumn(
  nodes: WikiSidebarRootNode[],
  kind: WikiSidebarColumnKind,
): WikiSidebarColumnNode | null {
  const hit = nodes.find(
    (node) => node.type === "column" && node.kind === kind,
  );
  return hit && hit.type === "column" ? hit : null;
}

function findRef(
  nodes: WikiSidebarRootNode[],
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
    } else if (node.type === "group" || node.type === "column") {
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
  const walk = (list: WikiSidebarRootNode[] | undefined) => {
    if (!list) {
      return;
    }
    for (const child of list) {
      if (child.type === "ref") {
        out.add(child.id);
        walk(child.children);
      } else if (child.type === "group" || child.type === "column") {
        walk(child.children);
      }
    }
  };
  walk(node.children);
  return out;
}

/** Parent ref id for `id`, or null when `id` sits at Contents root / column root. */
export function parentRefIdOf(
  nodes: WikiSidebarRootNode[],
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
    } else if (node.type === "group" || node.type === "column") {
      const hit = parentRefIdOf(node.children, id, parentRefId);
      if (hit !== undefined) {
        return hit;
      }
    }
  }
  return undefined;
}

/** Root column kind that contains `id`. Implicit standing when not inside a column. */
export function columnKindOfRef(
  nodes: WikiSidebarRootNode[],
  id: string,
  current: WikiSidebarColumnKind = "standing",
): WikiSidebarColumnKind | undefined {
  for (const node of nodes) {
    if (node.type === "column") {
      const hit = columnKindOfRef(node.children, id, node.kind);
      if (hit !== undefined) {
        return hit;
      }
    } else if (node.type === "ref") {
      if (node.id === id) {
        return current;
      }
      if (node.children) {
        const hit = columnKindOfRef(node.children, id, current);
        if (hit !== undefined) {
          return hit;
        }
      }
    } else if (node.type === "group") {
      const hit = columnKindOfRef(node.children, id, current);
      if (hit !== undefined) {
        return hit;
      }
    }
  }
  return undefined;
}

/**
 * `verticalListSortingStrategy` treats every Contents ref as one list.
 * Column headers are droppable but not sortable (`overIndex === -1`), which
 * shoves every row above the drag source. A hit in the other column
 * translates neighbors through the header. Freeze those transforms; drop-zone
 * chrome still shows the landing.
 */
export function contentsSortShouldFreeze(
  sidebar: WikiSidebarRootNode[],
  activeId: string,
  overId: string,
): boolean {
  if (parseContentsColumnKey(overId)) {
    return true;
  }
  const activeKind = columnKindOfRef(sidebar, activeId);
  const overKind = columnKindOfRef(sidebar, overId);
  if (activeKind === undefined || overKind === undefined) {
    return true;
  }
  return activeKind !== overKind;
}

/** Index of `id` among siblings in its parent list; -1 if missing. */
export function indexAmongSiblings(
  nodes: WikiSidebarRootNode[],
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
    } else if (node.type === "group" || node.type === "column") {
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
  nodes: WikiSidebarRootNode[],
  id: string,
): WikiSidebarRootNode[] | null {
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
    } else if (node.type === "group" || node.type === "column") {
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
 *
 * Root columns are not toc rows. Standing and record both paint as Contents
 * section chrome; their children stay at the same depth as implicit standing.
 */
export function flattenContentsRows(
  nodes: WikiSidebarRootNode[],
  collapsed: ReadonlySet<string>,
): ContentsRow[] {
  const out: ContentsRow[] = [];
  const walk = (list: WikiSidebarRootNode[], depth: number) => {
    for (let i = 0; i < list.length; i++) {
      const node = list[i]!;
      if (node.type === "column") {
        walk(node.children, depth);
        continue;
      }
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
      if (node.type !== "link") {
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
  sidebar: WikiSidebarRootNode[],
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
  nodes: WikiSidebarRootNode[],
  collapsed: ReadonlySet<string>,
): string[] {
  return flattenContentsRows(nodes, collapsed)
    .filter((row) => row.kind === "ref")
    .map((row) => row.key);
}

function placementForColumn(
  sidebar: WikiSidebarRootNode[],
  kind: WikiSidebarColumnKind,
  zone: DropZone,
): WikiSidebarPlacement {
  const col = findColumn(sidebar, kind);
  const children = col?.children ?? [];
  const index = zone === "before" ? 0 : children.length;
  return { parentId: null, index, column: kind };
}

function rootPlacement(
  sidebar: WikiSidebarRootNode[],
  overId: string,
  zone: DropZone,
  parentId: string | null,
  overIndex: number,
): WikiSidebarPlacement {
  const index = zone === "before" ? overIndex : overIndex + 1;
  if (parentId !== null) {
    return { parentId, index };
  }
  const column = columnKindOfRef(sidebar, overId) ?? "standing";
  return { parentId: null, index, column };
}

export function resolveContentsDrop(
  sidebar: WikiSidebarRootNode[],
  activeId: string,
  overId: string,
  zone: DropZone,
): ContentsDropResult {
  if (activeId === overId) {
    return { ok: false, reason: "same row" };
  }
  const active = findRef(sidebar, activeId);
  if (!active) {
    return { ok: false, reason: "active not in Contents" };
  }

  const overColumn = parseContentsColumnKey(overId);
  if (overColumn) {
    return { ok: true, placement: placementForColumn(sidebar, overColumn, zone) };
  }

  const over = findRef(sidebar, overId);
  if (!over) {
    return { ok: false, reason: "drop target must be a page" };
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
    placement: rootPlacement(sidebar, overId, zone, parentId, overIndex),
  };
}

function ensureColumn(
  nodes: WikiSidebarRootNode[],
  kind: WikiSidebarColumnKind,
): WikiSidebarColumnNode {
  const existing = findColumn(nodes, kind);
  if (existing) {
    return existing;
  }
  const created: WikiSidebarColumnNode = {
    type: "column",
    kind,
    title: DEFAULT_COLUMN_TITLE[kind],
    children: [],
  };
  nodes.push(created);
  return created;
}

/** Mirror of core `resolveTargetList` for optimistic Contents updates. */
function resolveTargetList(
  sidebar: WikiSidebarRootNode[],
  parentId: string | null,
  column?: WikiSidebarColumnKind,
): WikiSidebarRootNode[] {
  if (parentId !== null) {
    const parent = findRef(sidebar, parentId);
    if (!parent) {
      throw new Error(`Contents parent not found: ${parentId}`);
    }
    if (!parent.children) {
      parent.children = [];
    }
    return parent.children;
  }
  const kind = column ?? "standing";
  if (kind === "record") {
    return ensureColumn(sidebar, "record").children;
  }
  const standing = findColumn(sidebar, "standing");
  if (standing) {
    return standing.children;
  }
  return sidebar;
}

/**
 * Apply a Contents placement locally (mirrors core
 * `moveWikiNodeToSidebarPosition`). Used to update the sortable item list
 * synchronously on drop so dnd-kit does not animate the row back to its
 * pre-drop index while the IPC round-trip is in flight.
 */
export function applySidebarPlacement(
  sidebar: WikiSidebarRootNode[],
  id: string,
  placement: WikiSidebarPlacement,
): WikiSidebarRootNode[] {
  const next = JSON.parse(JSON.stringify(sidebar)) as WikiSidebarRootNode[];
  const loc = findRefSiblingLocation(next, id);
  if (!loc) {
    throw new Error(`Page not in sidebar: ${id}`);
  }
  const [node] = loc.siblings.splice(loc.index, 1);
  if (!node || node.type !== "ref") {
    throw new Error(`Page not in sidebar: ${id}`);
  }
  const targetList = resolveTargetList(
    next,
    placement.parentId,
    placement.column,
  );
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
  siblings: WikiSidebarRootNode[];
  index: number;
  /** Nearest enclosing ref id, or null at Contents root / under a root-level group. */
  parentRefId: string | null;
};

/** Locate a ref among its sibling list (mirrors core findPageLocation parent array). */
export function findRefSiblingLocation(
  nodes: WikiSidebarRootNode[],
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
    } else if (node.type === "group" || node.type === "column") {
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
  sidebar: WikiSidebarRootNode[],
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
  sidebar: WikiSidebarRootNode[],
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

/** Direct child ref ids of a root column (drop-group when over a column header). */
export function contentsColumnChildRefIds(
  sidebar: WikiSidebarRootNode[],
  kind: WikiSidebarColumnKind,
): Set<string> {
  const out = new Set<string>();
  const col = findColumn(sidebar, kind);
  const list = col
    ? col.children
    : kind === "standing"
      ? sidebar.filter((node) => node.type !== "column")
      : [];
  for (const node of list) {
    if (node.type === "ref") {
      out.add(node.id);
    }
  }
  return out;
}
