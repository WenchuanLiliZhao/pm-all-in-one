import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  materializeSiblingOrder,
  reorderSiblingInOrder,
  reparentInOrder,
  type ViewOrder,
} from "@pm-core/view-order-apply";
import type { Issue, IssueTree } from "@/lib/types";
import { issueRefKey } from "@/lib/types";
import type { IssueStatusId } from "@/lib/issue-status";
import type { Selection } from "@/lib/workspace/workspace-context";
import {
  applyCollapseRestore,
  applyForcedCollapseDiff,
  desiredTempCollapseKeys,
} from "@/lib/drag-collapse";
import {
  dropGroupMemberKeys,
  dropGroupParentKey,
  parentKeyOf,
  resolveDropIntent,
  zoneFromOverTarget,
  type DropZone,
} from "@/lib/tree-dnd";
import styles from "../styles.module.scss";
import { TreeRow, treeRowStyles } from "@/components/ui/tree-row";
import {
  issueKindIcon,
  issueKindKey,
} from "@/components/ui/tree-row/kind-icon";
import {
  issueStatusIcon,
  issueStatusLabel,
} from "@/components/ui/issue-status";
import { TreeCollapseControls } from "@/components/tree-collapse-controls";

interface HierarchyOutlineProps {
  tree: IssueTree;
  issues: Issue[];
  selection: Selection;
  onSelect: (sel: Selection) => void;
  order: ViewOrder;
  onPersistOrder: (order: ViewOrder) => Promise<void>;
  onMoveIssue: (input: {
    projectId: string;
    issueId: string;
    newParentIssueId: string | null;
  }) => Promise<void>;
  onPruneOtherViews: (movedKey: string) => Promise<void>;
}

type FlatRow = { nodeKey: string; depth: number };

function flattenVisible(tree: IssueTree, collapsed: Set<string>): FlatRow[] {
  const rows: FlatRow[] = [];
  const walk = (key: string, depth: number): void => {
    rows.push({ nodeKey: key, depth });
    if (collapsed.has(key)) {
      return;
    }
    for (const child of tree.children[key] ?? []) {
      walk(child, depth + 1);
    }
  };
  for (const root of tree.roots) {
    walk(root, 0);
  }
  return rows;
}

export function HierarchyOutline({
  tree,
  issues,
  selection,
  onSelect,
  order,
  onPersistOrder,
  onMoveIssue,
  onPruneOtherViews,
}: HierarchyOutlineProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [zone, setZone] = useState<DropZone>("into");
  const [dropFlash, setDropFlash] = useState<{
    key: string;
    kind: "ok" | "bad";
    token: number;
  } | null>(null);
  const pointerY = useRef(0);
  const forcedCollapseRef = useRef(new Set<string>());
  const collapseBaselineRef = useRef(new Map<string, boolean>());
  const dropFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropFlashTokenRef = useRef(0);

  const flashDrop = useCallback((key: string, kind: "ok" | "bad") => {
    if (dropFlashTimerRef.current !== null) {
      clearTimeout(dropFlashTimerRef.current);
    }
    dropFlashTokenRef.current += 1;
    setDropFlash({ key, kind, token: dropFlashTokenRef.current });
    dropFlashTimerRef.current = setTimeout(() => {
      setDropFlash(null);
      dropFlashTimerRef.current = null;
    }, 950);
  }, []);

  const toggle = useCallback((key: string) => {
    if (forcedCollapseRef.current.has(key)) {
      return;
    }
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const restoreTempCollapse = useCallback(() => {
    const forcedKeys = [...forcedCollapseRef.current];
    const baselineSnap = new Map(collapseBaselineRef.current);
    forcedCollapseRef.current.clear();
    collapseBaselineRef.current.clear();
    if (forcedKeys.length === 0) {
      return;
    }
    setCollapsed((prev) =>
      applyCollapseRestore(prev, forcedKeys, baselineSnap),
    );
  }, []);

  useEffect(() => {
    return () => {
      if (dropFlashTimerRef.current !== null) {
        clearTimeout(dropFlashTimerRef.current);
      }
    };
  }, []);

  const rows = useMemo(
    () => flattenVisible(tree, collapsed),
    [tree, collapsed],
  );
  const ids = useMemo(() => rows.map((r) => r.nodeKey), [rows]);
  const issuesByKey = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues) {
      map.set(issueRefKey(issue.projectId, issue.id), issue);
    }
    return map;
  }, [issues]);

  const dropLegal = useMemo(() => {
    if (!activeId || !overId || activeId === overId) {
      return null;
    }
    return resolveDropIntent(tree, issues, activeId, overId, zone).kind !==
      "reject";
  }, [activeId, overId, zone, tree, issues]);

  const dropGroupKeys = useMemo(() => {
    if (!activeId) {
      return null;
    }
    if (overId && activeId !== overId) {
      return dropGroupMemberKeys(
        tree,
        dropGroupParentKey(tree, overId, zone),
      );
    }
    // No distinct over yet — highlight the active item's current sibling group.
    return dropGroupMemberKeys(tree, parentKeyOf(tree, activeId));
  }, [activeId, overId, zone, tree]);

  useEffect(() => {
    if (!activeId) {
      return;
    }
    setCollapsed((prev) =>
      applyForcedCollapseDiff(
        prev,
        forcedCollapseRef.current,
        collapseBaselineRef.current,
        desiredTempCollapseKeys(tree, activeId),
      ),
    );
  }, [activeId, tree]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragStart = (event: DragStartEvent): void => {
    setActiveId(String(event.active.id));
  };

  const onDragOver = (event: DragOverEvent): void => {
    const over = event.over;
    if (!over) {
      setOverId(null);
      return;
    }
    const id = String(over.id);
    setOverId(id);
    const rect = over.rect;
    setZone(
      zoneFromOverTarget(
        pointerY.current,
        id,
        rect ?? { top: 0, height: 0 },
      ),
    );
  };

  const onDragEnd = async (event: DragEndEvent): Promise<void> => {
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    const dropZone = zone;
    const finishDrag = (): void => {
      restoreTempCollapse();
      setActiveId(null);
      setOverId(null);
    };
    if (!over) {
      finishDrag();
      return;
    }
    const intent = resolveDropIntent(tree, issues, active, over, dropZone);
    if (intent.kind === "reject") {
      finishDrag();
      flashDrop(active, "bad");
      return;
    }
    try {
      if (intent.kind === "reorder") {
        let next = materializeSiblingOrder(tree, order, intent.parentKey);
        next = reorderSiblingInOrder(
          next,
          intent.parentKey,
          intent.activeId,
          intent.overId,
        );
        // Apply order before clearing drag so the row does not spring to the
        // pre-drop index (dnd-kit default snap-back).
        await onPersistOrder(next);
        finishDrag();
        flashDrop(active, "ok");
        return;
      }
      // reparent — keep drag overlay until tree + order reflect the move
      await onMoveIssue(intent.move);
      let next = materializeSiblingOrder(tree, order, intent.fromParentKey);
      next = materializeSiblingOrder(tree, next, intent.toParentKey);
      next = reparentInOrder(
        next,
        intent.activeId,
        intent.fromParentKey,
        intent.toParentKey,
        intent.beforeId,
      );
      await onPersistOrder(next);
      await onPruneOtherViews(intent.activeId);
      finishDrag();
      flashDrop(active, "ok");
    } catch {
      finishDrag();
      flashDrop(active, "bad");
    }
  };

  return (
    <div
      onPointerMove={(e) => {
        pointerY.current = e.clientY;
      }}
    >
      <div className={styles.outlineToolbar}>
        <TreeCollapseControls
          tree={tree}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          disabled={activeId !== null}
        />
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={(e) => {
          void onDragEnd(e);
        }}
        onDragCancel={() => {
          restoreTempCollapse();
          setActiveId(null);
          setOverId(null);
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className={styles.stubList}>
            {rows.map(({ nodeKey, depth }) => {
              const entry = tree.byId[nodeKey];
              const status =
                entry?.kind === "issue" && entry.issueId !== undefined
                  ? issuesByKey.get(
                      issueRefKey(entry.projectId, entry.issueId),
                    )?.status
                  : undefined;
              return (
              <SortableRow
                key={nodeKey}
                nodeKey={nodeKey}
                depth={depth}
                tree={tree}
                status={status}
                selection={selection}
                onSelect={onSelect}
                collapsed={collapsed}
                onToggle={toggle}
                twistLocked={
                  Boolean(activeId) &&
                  (nodeKey === activeId ||
                    (dropLegal === true && nodeKey === overId))
                }
                inDropGroup={dropGroupKeys?.has(nodeKey) ?? false}
                dropLegal={
                  dropGroupKeys?.has(nodeKey) ? dropLegal : null
                }
                dropFlash={
                  dropFlash?.key === nodeKey
                    ? { kind: dropFlash.kind, token: dropFlash.token }
                    : null
                }
              />
              );
            })}
          </ul>
        </SortableContext>
        <DragOverlay>
          {activeId && tree.byId[activeId] ? (
            <div
              className={`${styles.dragOverlay}${
                dropLegal === true
                  ? ` ${styles.dragOverlayLegal}`
                  : dropLegal === false
                    ? ` ${styles.dragOverlayIllegal}`
                    : ""
              }`}
            >
              {tree.byId[activeId]!.title || "(untitled)"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function SortableRow({
  nodeKey,
  depth,
  tree,
  status,
  selection,
  onSelect,
  collapsed,
  onToggle,
  twistLocked,
  inDropGroup,
  dropLegal,
  dropFlash,
}: {
  nodeKey: string;
  depth: number;
  tree: IssueTree;
  status?: IssueStatusId;
  selection: Selection;
  onSelect: (sel: Selection) => void;
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  twistLocked: boolean;
  inDropGroup: boolean;
  dropLegal: boolean | null;
  dropFlash: { kind: "ok" | "bad"; token: number } | null;
}) {
  const entry = tree.byId[nodeKey];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: nodeKey,
    // Avoid springing back to the pre-drop index when drag ends.
    animateLayoutChanges: () => false,
  });

  if (!entry) {
    return null;
  }

  const kids = tree.children[nodeKey] ?? [];
  const hasKids = kids.length > 0;
  const isCollapsed = collapsed.has(nodeKey);
  const selected =
    (selection?.kind === "project" &&
      entry.kind === "project" &&
      selection.projectId === entry.projectId) ||
    (selection?.kind === "issue" &&
      entry.kind === "issue" &&
      selection.projectId === entry.projectId &&
      selection.issueId === entry.issueId);

  const kindKey = issueKindKey(
    entry.kind === "project" ? "project" : "issue",
    entry.level,
  );
  const titleText = entry.title || "(untitled)";
  const statusText = status ? issueStatusLabel(status) : null;
  const ariaLabel = statusText
    ? `${kindKey}: ${titleText}, ${statusText}`
    : `${kindKey}: ${titleText}`;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: `${0.35 + depth * 1.15}rem`,
  };

  const groupClass = inDropGroup
    ? dropLegal === true
      ? ` ${styles.dropGroup} ${styles.dropGroupLegal}`
      : dropLegal === false
        ? ` ${styles.dropGroup} ${styles.dropGroupIllegal}`
        : ` ${styles.dropGroup}`
    : "";

  return (
    <li className={styles.stubItem} ref={setNodeRef} style={style}>
      <div
        data-dnd-key={nodeKey}
        className={`${styles.stubRow} ${treeRowStyles.rowHoverRoot}${selected ? ` ${styles.stubRowSelected}` : ""}${groupClass}`}
        {...attributes}
        {...listeners}
      >
        {dropFlash ? (
          <div
            key={dropFlash.token}
            className={
              dropFlash.kind === "ok" ? styles.dropFlashOk : styles.dropFlashBad
            }
            aria-hidden
          />
        ) : null}
        <TreeRow
          icon={issueKindIcon(kindKey)}
          hasChildren={hasKids}
          expanded={!isCollapsed}
          onToggle={() => onToggle(nodeKey)}
          twistLocked={twistLocked}
          title={titleText}
          titleClassName={styles.stubTitle}
          trailing={status ? issueStatusIcon(status) : undefined}
          className={styles.stubSelect}
          aria-label={ariaLabel}
          onClick={() => {
            if (entry.kind === "project") {
              onSelect({ kind: "project", projectId: entry.projectId });
            } else if (entry.issueId !== undefined) {
              onSelect({
                kind: "issue",
                projectId: entry.projectId,
                issueId: entry.issueId,
              });
            }
          }}
        />
      </div>
    </li>
  );
}
