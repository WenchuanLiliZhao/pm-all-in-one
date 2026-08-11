import type { IssueTree } from "@/lib/types";
import type { Selection } from "@/lib/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { TreeNodeView } from "./sub-components/tree-node";
import styles from "./styles.module.scss";

interface HierarchyTreeProps {
  tree: IssueTree;
  selection: Selection;
  onSelect: (sel: Selection) => void;
  onCreateProject: () => void;
  onCreateChild: () => void;
  canAddChild: boolean;
}

export function HierarchyTree({
  tree,
  selection,
  onSelect,
  onCreateProject,
  onCreateChild,
  canAddChild,
}: HierarchyTreeProps) {
  return (
    <div>
      <div className={styles.paneHeader}>
        <span>Issues</span>
        <div className={styles.headerActions}>
          <Button type="button" variant="ghost" onClick={onCreateProject} title="New Project">
            + Project
          </Button>
          {canAddChild ? (
            <Button type="button" variant="ghost" onClick={onCreateChild} title="New child">
              + Child
            </Button>
          ) : null}
        </div>
      </div>
      <ul className={styles.treeList}>
        {tree.roots.map((key) => (
          <TreeNodeView
            key={key}
            nodeKey={key}
            depth={0}
            tree={tree}
            selection={selection}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}
