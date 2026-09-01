/** Nested view of posix relative paths from `listNodeAssets`. */

export type AssetTreeNode = {
  name: string;
  relPath: string;
  kind: "file" | "dir";
  children: AssetTreeNode[];
};

type MutableNode = {
  name: string;
  relPath: string;
  kind: "file" | "dir";
  children: MutableNode[];
  childMap: Map<string, MutableNode>;
};

function sortNodes(nodes: MutableNode[]): AssetTreeNode[] {
  const dirs = nodes.filter((n) => n.kind === "dir");
  const files = nodes.filter((n) => n.kind === "file");
  const byName = (a: MutableNode, b: MutableNode) => a.name.localeCompare(b.name);
  dirs.sort(byName);
  files.sort(byName);
  return [...dirs, ...files].map((n) => ({
    name: n.name,
    relPath: n.relPath,
    kind: n.kind,
    children: n.kind === "dir" ? sortNodes(n.children) : [],
  }));
}

/** Build a directory tree from posix relative paths (`dir/` marks a folder). */
export function buildAssetTree(relPaths: string[]): AssetTreeNode[] {
  const root: MutableNode[] = [];
  const rootMap = new Map<string, MutableNode>();

  for (const rel of relPaths) {
    const isDir = rel.endsWith("/");
    const trimmed = rel.replace(/\/+$/, "");
    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let children = root;
    let map = rootMap;
    let prefix = "";
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!;
      prefix = prefix ? `${prefix}/${part}` : part;
      const isLast = i === parts.length - 1;
      if (isLast && !isDir) {
        if (!map.has(part)) {
          const file: MutableNode = {
            name: part,
            relPath: prefix,
            kind: "file",
            children: [],
            childMap: new Map(),
          };
          map.set(part, file);
          children.push(file);
        }
        continue;
      }
      let dir = map.get(part);
      if (!dir) {
        dir = {
          name: part,
          relPath: prefix,
          kind: "dir",
          children: [],
          childMap: new Map(),
        };
        map.set(part, dir);
        children.push(dir);
      } else if (dir.kind === "file") {
        dir.kind = "dir";
      }
      children = dir.children;
      map = dir.childMap;
    }
  }

  return sortNodes(root);
}
