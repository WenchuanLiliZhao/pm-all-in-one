import type { WikiNodeMeta, WikiSidebarNode } from "@/lib/types";

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
export function collectSidebarWikiNodeIds(nodes: WikiSidebarNode[]): string[] {
  const out: string[] = [];
  const walk = (list: WikiSidebarNode[]) => {
    for (const node of list) {
      if (node.type === "ref") {
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
