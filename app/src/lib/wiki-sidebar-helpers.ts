import type {
  WikiNodeMeta,
  WikiSidebarColumnKind,
  WikiSidebarColumnNode,
  WikiSidebarNode,
  WikiSidebarRootNode,
} from "@/lib/types";

/**
 * Contents display name for a sidebar `ref`: live wiki-node title first.
 * Sidebar `label` is a denormalized cache (may lag hand-edits); use only as
 * fallback when the node is missing from inventory.
 */
export function wikiContentsRefLabel(
  node: Extract<WikiSidebarNode, { type: "ref" }>,
  wikiNodes: ReadonlyArray<Pick<WikiNodeMeta, "id" | "title">>,
): string {
  const meta = wikiNodes.find((p) => p.id === node.id);
  return meta?.title?.trim() || node.label?.trim() || node.id;
}

/** Client-side mirror of core collectSidebarWikiNodeIds. */
export function collectSidebarWikiNodeIds(nodes: WikiSidebarRootNode[]): string[] {
  const out: string[] = [];
  const walk = (list: WikiSidebarRootNode[]) => {
    for (const node of list) {
      if (node.type === "column") {
        walk(node.children);
      } else if (node.type === "ref") {
        out.push(node.id);
        if (node.children) {
          walk(node.children);
        }
      } else if (node.type === "group") {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return out;
}

export const DEFAULT_WIKI_COLUMN_TITLE: Record<WikiSidebarColumnKind, string> = {
  standing: "Standing",
  record: "Records",
};

export function findWikiSidebarColumn(
  nodes: WikiSidebarRootNode[],
  kind: WikiSidebarColumnKind,
): WikiSidebarColumnNode | null {
  const hit = nodes.find(
    (node) => node.type === "column" && node.kind === kind,
  );
  return hit && hit.type === "column" ? hit : null;
}

export function wikiColumnTitle(
  nodes: WikiSidebarRootNode[],
  kind: WikiSidebarColumnKind,
): string {
  const title = findWikiSidebarColumn(nodes, kind)?.title?.trim();
  return title || DEFAULT_WIKI_COLUMN_TITLE[kind];
}

/**
 * Contents rail heading for the standing column.
 * Implicit standing keeps the product chrome "Contents"; an explicit column
 * uses its title. Settings must use this, not `wikiColumnTitle("standing")`
 * — that helper falls back to "Standing", which is not painted anywhere
 * until the column is materialized.
 */
export const IMPLICIT_STANDING_RAIL_TITLE = "Contents";

export function standingRailTitle(nodes: WikiSidebarRootNode[]): string {
  const title = findWikiSidebarColumn(nodes, "standing")?.title?.trim();
  return title || IMPLICIT_STANDING_RAIL_TITLE;
}

/** Rail paint order. Both kinds always appear, even with no disk column yet. */
export const WIKI_CONTENTS_COLUMN_KINDS = [
  "standing",
  "record",
] as const satisfies readonly WikiSidebarColumnKind[];

export function wikiRailTitle(
  nodes: WikiSidebarRootNode[],
  kind: WikiSidebarColumnKind,
): string {
  if (kind === "standing") {
    return standingRailTitle(nodes);
  }
  return wikiColumnTitle(nodes, kind);
}

function wikiRailColumnNodes(
  nodes: WikiSidebarRootNode[],
  kind: WikiSidebarColumnKind,
): WikiSidebarRootNode[] {
  const col = findWikiSidebarColumn(nodes, kind);
  if (col) {
    return [...col.children];
  }
  if (kind === "standing") {
    return nodes.filter((node) => node.type !== "column");
  }
  return [];
}

/** One Contents-rail section per root column. Implicit standing is always first. */
export type WikiContentsRailSection = {
  kind: WikiSidebarColumnKind;
  title: string;
  nodes: WikiSidebarRootNode[];
};

export function wikiContentsRailSections(
  nodes: WikiSidebarRootNode[],
): WikiContentsRailSection[] {
  return WIKI_CONTENTS_COLUMN_KINDS.map((kind) => ({
    kind,
    title: wikiRailTitle(nodes, kind),
    nodes: wikiRailColumnNodes(nodes, kind),
  }));
}

/**
 * Map each Contents ref id to the column that contains it.
 * Bare root refs (no explicit standing column) count as standing.
 */
export function wikiSidebarColumnByNodeId(
  nodes: WikiSidebarRootNode[],
): Map<string, { kind: WikiSidebarColumnKind; title: string }> {
  const standingTitle = wikiColumnTitle(nodes, "standing");
  const recordColumnTitle = wikiColumnTitle(nodes, "record");
  const titleOf = (kind: WikiSidebarColumnKind) =>
    kind === "record" ? recordColumnTitle : standingTitle;
  const out = new Map<string, { kind: WikiSidebarColumnKind; title: string }>();
  const walk = (
    list: WikiSidebarRootNode[],
    kind: WikiSidebarColumnKind,
  ) => {
    for (const node of list) {
      if (node.type === "column") {
        walk(node.children, node.kind);
      } else if (node.type === "ref") {
        out.set(node.id, { kind, title: titleOf(kind) });
        if (node.children) {
          walk(node.children, kind);
        }
      } else if (node.type === "group") {
        walk(node.children, kind);
      }
    }
  };
  walk(nodes, "standing");
  return out;
}

/**
 * Write one column title. Materializes that column if it is still implicit:
 * standing wraps current non-column root nodes; the record column is created empty.
 */
export function setWikiColumnTitle(
  nodes: WikiSidebarRootNode[],
  kind: WikiSidebarColumnKind,
  title: string,
): WikiSidebarRootNode[] {
  const nextTitle = title.trim() || DEFAULT_WIKI_COLUMN_TITLE[kind];
  const existing = findWikiSidebarColumn(nodes, kind);
  if (existing) {
    return nodes.map((node) =>
      node.type === "column" && node.kind === kind
        ? { ...node, title: nextTitle }
        : node,
    );
  }
  if (kind === "record") {
    return [
      ...nodes,
      {
        type: "column",
        kind: "record",
        title: nextTitle,
        children: [],
      },
    ];
  }
  const children = nodes.filter((node) => node.type !== "column");
  const rest = nodes.filter((node) => node.type === "column");
  return [
    {
      type: "column",
      kind: "standing",
      title: nextTitle,
      children,
    },
    ...rest,
  ];
}
