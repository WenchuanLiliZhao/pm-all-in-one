import { getPm } from "@/lib/bridge";
import { useViewOrderedTree } from "@/lib/workspace/use-view-ordered-tree";
import {
  useWorkspace,
  type Selection,
} from "@/lib/workspace/workspace-context";
import type { IssueTree } from "@/lib/types";
import { HierarchyOutline } from "./hierarchy-outline";

interface OrderedHierarchyProps {
  viewKey: string;
  tree: IssueTree;
  selection: Selection;
  onSelect: (sel: Selection) => void;
}

/** Applies per-view order and wires DnD persist + level-preserving reparent. */
export function OrderedHierarchyOutline({
  viewKey,
  tree,
  selection,
  onSelect,
}: OrderedHierarchyProps) {
  const { issues, moveIssueTo, setError } = useWorkspace();
  const { orderedTree, order, persistOrder } = useViewOrderedTree(viewKey, tree);

  if (!orderedTree) {
    return null;
  }

  return (
    <HierarchyOutline
      tree={orderedTree}
      issues={issues}
      selection={selection}
      onSelect={onSelect}
      order={order}
      onPersistOrder={async (next) => {
        try {
          await persistOrder(next);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }}
      onMoveIssue={async (input) => {
        await moveIssueTo(
          input.projectId,
          input.issueId,
          input.newParentIssueId,
        );
      }}
      onPruneOtherViews={async (movedKey) => {
        try {
          await getPm().pruneViewOrderKey(movedKey, viewKey);
        } catch {
          /* non-fatal: applyViewOrder ignores stale keys */
        }
      }}
    />
  );
}
