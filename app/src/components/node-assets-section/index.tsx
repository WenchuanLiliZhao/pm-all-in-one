import { useCallback, useEffect, useMemo, useState } from "react";
import { getPm, isWebPm } from "@/lib/bridge";
import type { NodeRef } from "@/lib/bridge/pm-api";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Lucide } from "@/components/ui/lucide";
import { TreeRow, treeRowStyles } from "@/components/ui/tree-row";
import { buildAssetTree, type AssetTreeNode } from "./tree";
import styles from "./styles.module.scss";

interface NodeAssetsSectionProps {
  nodeRef: NodeRef;
}

const ROW_ICON_SIZE = 18;
const INDENT_STEP_PX = 16;

export function NodeAssetsSection({ nodeRef }: NodeAssetsSectionProps) {
  const [names, setNames] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refKey = nodeRefKey(nodeRef);

  const refresh = useCallback(async () => {
    try {
      const next = await getPm().listNodeAssets(nodeRef);
      setNames(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [refKey]);

  useEffect(() => {
    setExpanded(new Set());
  }, [refKey]);

  useEffect(() => {
    if (isWebPm()) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const next = await getPm().listNodeAssets(nodeRef);
        if (!cancelled) {
          setNames(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    };
    void run();
    const unsub = getPm().onChanged(() => {
      void run();
    });
    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [refKey]);

  const tree = useMemo(() => buildAssetTree(names), [names]);

  const onToggle = useCallback((relPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  }, []);

  if (isWebPm()) {
    return null;
  }

  async function onAdd() {
    setBusy(true);
    setError(null);
    try {
      await getPm().addNodeAssets(nodeRef);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReveal() {
    setError(null);
    try {
      const dir = await getPm().getNodeAssetsDir(nodeRef);
      if (!dir) {
        return;
      }
      await getPm().revealPath(dir);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Assets</h2>
        <div className={styles.actions}>
          {names.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void onReveal()}
            >
              Reveal
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outlined"
            disabled={busy}
            onClick={() => void onAdd()}
          >
            {busy ? "Adding…" : "Add"}
          </Button>
        </div>
      </div>
      <p className={styles.hint}>
        Files live in this node&apos;s <code>assets/</code> folder. Add files
        or folders (folders keep their relative tree). Paste or drop files into
        the body to add and cite automatically. Dropping a folder copies it
        without inserting cites. Or type{" "}
        <code>![](assets/</code> / <code>[](assets/</code> to pick a file
        (same menu as <code>@</code>).
      </p>
      {error ? (
        <Banner tone="error" className={styles.error}>
          {error}
        </Banner>
      ) : null}
      {names.length === 0 ? (
        <p className={styles.empty}>No assets yet.</p>
      ) : (
        <ul className={styles.list} aria-label="Asset files">
          <AssetTreeItems
            nodes={tree}
            depth={0}
            expanded={expanded}
            onToggle={onToggle}
          />
        </ul>
      )}
    </section>
  );
}

function AssetTreeItems({
  nodes,
  depth,
  expanded,
  onToggle,
}: {
  nodes: AssetTreeNode[];
  depth: number;
  expanded: ReadonlySet<string>;
  onToggle: (relPath: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isDir = node.kind === "dir";
        const isExpanded = isDir && expanded.has(node.relPath);
        const showKids = isDir && isExpanded && node.children.length > 0;
        return (
          <li key={node.relPath}>
            <div
              className={`${styles.row} ${treeRowStyles.rowHoverRoot}`}
              style={{ ["--asset-indent" as string]: `${depth * INDENT_STEP_PX}px` }}
            >
              <TreeRow
                icon={
                  isDir ? (
                    isExpanded ? (
                      <Lucide.FolderOpen size={ROW_ICON_SIZE} aria-hidden />
                    ) : (
                      <Lucide.Folder size={ROW_ICON_SIZE} aria-hidden />
                    )
                  ) : (
                    <Lucide.FileText size={ROW_ICON_SIZE} aria-hidden />
                  )
                }
                hasChildren={isDir && node.children.length > 0}
                expanded={isExpanded}
                onToggle={
                  isDir && node.children.length > 0
                    ? () => onToggle(node.relPath)
                    : undefined
                }
                title={node.name}
                titleClassName={styles.rowTitle}
                className={styles.rowSelect}
                aria-label={
                  isDir
                    ? `${node.name} folder, ${isExpanded ? "expanded" : "collapsed"}`
                    : node.name
                }
                onClick={
                  isDir && node.children.length > 0
                    ? () => {
                        onToggle(node.relPath);
                      }
                    : undefined
                }
              />
            </div>
            {showKids ? (
              <ul className={styles.list}>
                <AssetTreeItems
                  nodes={node.children}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                />
              </ul>
            ) : null}
          </li>
        );
      })}
    </>
  );
}

function nodeRefKey(ref: NodeRef): string {
  switch (ref.kind) {
    case "workspace":
      return "workspace";
    case "project":
      return `project:${ref.projectId}`;
    case "issue":
      return `issue:${ref.projectId}::${ref.issueId}`;
    case "wiki":
      return `wiki:${ref.wikiNodeId}`;
    case "member":
      return `member:${ref.memberId}`;
    case "handoff":
      return `handoff:${ref.handoffId}`;
  }
}
