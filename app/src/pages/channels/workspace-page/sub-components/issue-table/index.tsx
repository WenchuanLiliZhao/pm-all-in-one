/**
 * Workspace Issue Table (channel `/w/table`).
 * Layout contract lives in styles.module.scss + parent `.tablePage`.
 * ↔ styles.module.scss — fill / inner-scroll
 * ↔ ../../styles.module.scss — `.tablePage` / `.layoutFillViewport`
 * ↔ ../../is-fill-viewport-path.ts — `/w/table` membership
 */
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
import {
  materializeSiblingOrder,
  reorderSiblingInOrder,
  reparentInOrder,
} from "@pm-core/views/view-order-apply";
import { getPm } from "@/lib/bridge";
import type {
  CustomPropsSchema,
  Issue,
  IssueTree,
  Project,
} from "@/lib/types";
import { issueRefKey } from "@/lib/types";
import { useViewOrderedTree } from "@/lib/workspace/use-view-ordered-tree";
import {
  useWorkspace,
  type Selection,
} from "@/lib/workspace/workspace-context";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Lucide } from "@/components/ui/lucide";
import { TreeRow, treeRowStyles } from "@/components/ui/tree-row";
import {
  issueKindIcon,
  issueKindKey,
} from "@/components/ui/tree-row/kind-icon";
import { issueStatusLabel, issueStatusToneStyles } from "@/components/ui/issue-status";
import {
  BUILTIN_ISSUE_PRIORITIES,
  issuePriorityLabel,
} from "@/lib/issue-priority";
import { TreeCollapseControls } from "@/components/tree-collapse-controls";
import {
  buildCustomUnion,
  formatCreatedCell,
  formatCustomCell,
  formatDateCell,
  formatStatusCell,
  formatUpdatedCell,
  keysDeclaredForRow,
  rowLevelLabel,
  type CustomColumn,
} from "./columns";
import {
  collectKeptKeys,
  filterFlatRows,
  tableFilterState,
} from "./filter";
import styles from "./styles.module.scss";

interface IssueTableProps {
  viewKey: string;
  tree: IssueTree;
  selection: Selection;
  onSelect: (sel: Selection) => void;
}

export function IssueTable({
  viewKey,
  tree,
  selection,
  onSelect,
}: IssueTableProps) {
  const {
    issues,
    projects,
    moveIssueTo,
    setError,
    refreshCustomProps,
  } = useWorkspace();
  const { orderedTree, order, persistOrder } = useViewOrderedTree(
    viewKey,
    tree,
  );

  const [query, setQuery] = useState("");
  const [schemasByProject, setSchemasByProject] = useState(
    () => new Map<string, CustomPropsSchema>(),
  );
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
  const dropFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const dropFlashTokenRef = useRef(0);

  const projectIdsKey = projects.map((p) => p.id).join("|");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = new Map<string, CustomPropsSchema>();
      await Promise.all(
        projects.map(async (p) => {
          try {
            const schema = await refreshCustomProps(p.id);
            next.set(p.id, schema);
          } catch {
            /* leave missing — row shows no custom cells for that project */
          }
        }),
      );
      if (!cancelled) {
        setSchemasByProject(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectIdsKey, projects, refreshCustomProps]);

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

  const liveTree = orderedTree ?? tree;

  const issuesByKey = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues) {
      map.set(issueRefKey(issue.projectId, issue.id), issue);
    }
    return map;
  }, [issues]);

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) {
      map.set(p.id, p);
    }
    return map;
  }, [projects]);

  const customColumns = useMemo(
    () => buildCustomUnion(schemasByProject.values()),
    [schemasByProject],
  );

  const { queryActive, dndEnabled } = tableFilterState(query);

  const keptKeys = useMemo(
    () =>
      collectKeptKeys({
        tree: liveTree,
        issuesByKey,
        projectsById,
        query,
        customColumns,
        schemasByProject,
      }),
    [
      liveTree,
      issuesByKey,
      projectsById,
      query,
      customColumns,
      schemasByProject,
    ],
  );

  const rows = useMemo(
    () => filterFlatRows(liveTree, collapsed, keptKeys),
    [liveTree, collapsed, keptKeys],
  );
  const ids = useMemo(() => rows.map((r) => r.nodeKey), [rows]);

  const dropLegal = useMemo(() => {
    if (!dndEnabled || !activeId || !overId || activeId === overId) {
      return null;
    }
    return (
      resolveDropIntent(liveTree, issues, activeId, overId, zone).kind !==
      "reject"
    );
  }, [dndEnabled, activeId, overId, zone, liveTree, issues]);

  const dropGroupKeys = useMemo(() => {
    if (!dndEnabled || !activeId) {
      return null;
    }
    if (overId && activeId !== overId) {
      return dropGroupMemberKeys(
        liveTree,
        dropGroupParentKey(liveTree, overId, zone),
      );
    }
    return dropGroupMemberKeys(liveTree, parentKeyOf(liveTree, activeId));
  }, [dndEnabled, activeId, overId, zone, liveTree]);

  useEffect(() => {
    if (!dndEnabled) {
      if (activeId) {
        restoreTempCollapse();
        setActiveId(null);
        setOverId(null);
      }
      return;
    }
    if (!activeId) {
      return;
    }
    setCollapsed((prev) =>
      applyForcedCollapseDiff(
        prev,
        forcedCollapseRef.current,
        collapseBaselineRef.current,
        desiredTempCollapseKeys(liveTree, activeId),
      ),
    );
  }, [dndEnabled, activeId, liveTree, restoreTempCollapse]);

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
    const intent = resolveDropIntent(
      liveTree,
      issues,
      active,
      over,
      dropZone,
    );
    if (intent.kind === "reject") {
      finishDrag();
      flashDrop(active, "bad");
      return;
    }
    try {
      if (intent.kind === "reorder") {
        let next = materializeSiblingOrder(
          liveTree,
          order,
          intent.parentKey,
        );
        next = reorderSiblingInOrder(
          next,
          intent.parentKey,
          intent.activeId,
          intent.overId,
        );
        await persistOrder(next);
        finishDrag();
        flashDrop(active, "ok");
        return;
      }
      await moveIssueTo(
        intent.move.projectId,
        intent.move.issueId,
        intent.move.newParentIssueId,
      );
      let next = materializeSiblingOrder(
        liveTree,
        order,
        intent.fromParentKey,
      );
      next = materializeSiblingOrder(liveTree, next, intent.toParentKey);
      next = reparentInOrder(
        next,
        intent.activeId,
        intent.fromParentKey,
        intent.toParentKey,
        intent.beforeId,
      );
      await persistOrder(next);
      try {
        await getPm().pruneViewOrderKey(intent.activeId, viewKey);
      } catch {
        /* non-fatal */
      }
      finishDrag();
      flashDrop(active, "ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      finishDrag();
      flashDrop(active, "bad");
    }
  };

  if (!orderedTree) {
    return null;
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Input
          className={styles.filter}
          type="search"
          placeholder="Filter by title, status, priority, dates, props…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <TreeCollapseControls
          tree={liveTree}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          disabled={activeId !== null}
        />
        {queryActive ? (
          <p className={styles.hint}>
            Filtering — clear search to drag-reorder.
          </p>
        ) : (
          <p className={styles.hint}>
            Drag title to reorder siblings or reparent (same level).
          </p>
        )}
      </div>

      <div
        className={styles.tableWrap}
        onPointerMove={(e) => {
          pointerY.current = e.clientY;
        }}
      >
        <DndContext
          sensors={dndEnabled ? sensors : []}
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
          <SortableContext
            items={ids}
            strategy={verticalListSortingStrategy}
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.titleCol}>Title</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Created</th>
                  <th>Updated</th>
                  {customColumns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8 + customColumns.length}
                      className={styles.muted}
                    >
                      {queryActive
                        ? "No issues match this filter."
                        : "No projects yet."}
                    </td>
                  </tr>
                ) : (
                  rows.map(({ nodeKey, depth }) => (
                    <SortableTableRow
                      key={nodeKey}
                      nodeKey={nodeKey}
                      depth={depth}
                      tree={liveTree}
                      issuesByKey={issuesByKey}
                      projectsById={projectsById}
                      schemasByProject={schemasByProject}
                      customColumns={customColumns}
                      selection={selection}
                      onSelect={onSelect}
                      collapsed={collapsed}
                      onToggle={toggle}
                      dndEnabled={dndEnabled}
                      queryActive={queryActive}
                      twistLocked={
                        Boolean(activeId) &&
                        (nodeKey === activeId ||
                          (dropLegal === true && nodeKey === overId))
                      }
                      inDropGroup={
                        dropGroupKeys?.has(nodeKey) ?? false
                      }
                      dropLegal={
                        dropGroupKeys?.has(nodeKey) ? dropLegal : null
                      }
                      dropFlash={
                        dropFlash?.key === nodeKey
                          ? {
                              kind: dropFlash.kind,
                              token: dropFlash.token,
                            }
                          : null
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {dndEnabled && activeId && liveTree.byId[activeId] ? (
              <div
                className={`${styles.dragOverlay}${
                  dropLegal === true
                    ? ` ${styles.dragOverlayLegal}`
                    : dropLegal === false
                      ? ` ${styles.dragOverlayIllegal}`
                      : ""
                }`}
              >
                {liveTree.byId[activeId]!.title || "(untitled)"}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function SortableTableRow({
  nodeKey,
  depth,
  tree,
  issuesByKey,
  projectsById,
  schemasByProject,
  customColumns,
  selection,
  onSelect,
  collapsed,
  onToggle,
  dndEnabled,
  queryActive,
  twistLocked,
  inDropGroup,
  dropLegal,
  dropFlash,
}: {
  nodeKey: string;
  depth: number;
  tree: IssueTree;
  issuesByKey: Map<string, Issue>;
  projectsById: Map<string, Project>;
  schemasByProject: Map<string, CustomPropsSchema>;
  customColumns: readonly CustomColumn[];
  selection: Selection;
  onSelect: (sel: Selection) => void;
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  dndEnabled: boolean;
  queryActive: boolean;
  twistLocked: boolean;
  inDropGroup: boolean;
  dropLegal: boolean | null;
  dropFlash: { kind: "ok" | "bad"; token: number } | null;
}) {
  const entry = tree.byId[nodeKey];
  const { persistIssuePriority, setError } = useWorkspace();
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: nodeKey,
    disabled: !dndEnabled,
    animateLayoutChanges: () => false,
  });

  if (!entry) {
    return null;
  }

  const kids = tree.children[nodeKey] ?? [];
  const hasKids = kids.length > 0;
  const isCollapsed = !queryActive && collapsed.has(nodeKey);
  const issue =
    entry.kind === "issue" && entry.issueId !== undefined
      ? (issuesByKey.get(issueRefKey(entry.projectId, entry.issueId)) ??
        null)
      : null;
  const project = projectsById.get(entry.projectId) ?? null;
  const schema = schemasByProject.get(entry.projectId);
  const declaredKeys = keysDeclaredForRow(schema, entry.level);

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
  const statusText = issue ? issueStatusLabel(issue.status) : null;
  const ariaLabel = statusText
    ? `${kindKey}: ${titleText}, ${statusText}`
    : `${kindKey}: ${titleText}`;

  const groupClass = inDropGroup
    ? dropLegal === true
      ? ` ${styles.dropGroup} ${styles.dropGroupLegal}`
      : dropLegal === false
        ? ` ${styles.dropGroup} ${styles.dropGroupIllegal}`
        : ` ${styles.dropGroup}`
    : "";

  const rowClass = [
    styles.row,
    treeRowStyles.rowHoverRoot,
    selected ? styles.rowSelected : "",
    isDragging ? styles.rowDragging : "",
    groupClass,
  ]
    .filter(Boolean)
    .join(" ");

  const dragProps = dndEnabled
    ? { ...attributes, ...listeners }
    : {};

  return (
    <tr
      ref={setNodeRef}
      data-dnd-key={nodeKey}
      className={rowClass}
    >
      <td className={styles.titleCol}>
        {dropFlash ? (
          <div
            key={dropFlash.token}
            className={
              dropFlash.kind === "ok"
                ? styles.dropFlashOk
                : styles.dropFlashBad
            }
            aria-hidden
          />
        ) : null}
        <div
          className={`${styles.titleCellInner}${
            dndEnabled ? "" : ` ${styles.titleCellInnerNoDrag}`
          }`}
          style={{ paddingLeft: `${depth * 1.1}rem` }}
          {...dragProps}
        >
          <TreeRow
            icon={issueKindIcon(kindKey)}
            hasChildren={hasKids}
            expanded={!isCollapsed}
            onToggle={() => onToggle(nodeKey)}
            twistLocked={twistLocked || queryActive}
            title={titleText}
            titleClassName={styles.titleText}
            className={styles.titleSelect}
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
      </td>
      <td>{rowLevelLabel(entry)}</td>
      <td>
        {issue ? (
          <span
            className={`${styles.statusLabel} ${issueStatusToneStyles.tone}`}
            data-status={issue.status}
          >
            {formatStatusCell(issue)}
          </span>
        ) : (
          <span className={styles.muted}>—</span>
        )}
      </td>
      <td>
        {issue && entry.issueId !== undefined ? (
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button
                type="button"
                variant="outlined"
                size="small"
                className={styles.prioritySelect}
                endIcon={<Lucide.ChevronDown />}
                aria-label={`Priority for ${titleText}`}
                onClick={(e) => e.stopPropagation()}
              >
                {issuePriorityLabel(issue.priority)}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" side="bottom">
              {BUILTIN_ISSUE_PRIORITIES.map((p) => (
                <DropdownMenu.ItemButton
                  key={p.id}
                  label={p.label}
                  active={issue.priority === p.id}
                  onSelect={() => {
                    void (async () => {
                      try {
                        await persistIssuePriority(
                          entry.projectId,
                          entry.issueId!,
                          p.id,
                        );
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : String(err),
                        );
                      }
                    })();
                  }}
                />
              ))}
            </DropdownMenu.Content>
          </DropdownMenu>
        ) : (
          <span className={styles.muted}>—</span>
        )}
      </td>
      <td className={styles.mono}>
        {issue ? formatDateCell(issue.startDate) || (
          <span className={styles.muted}>—</span>
        ) : (
          <span className={styles.muted}>—</span>
        )}
      </td>
      <td className={styles.mono}>
        {issue ? formatDateCell(issue.endDate) || (
          <span className={styles.muted}>—</span>
        ) : (
          <span className={styles.muted}>—</span>
        )}
      </td>
      <td className={styles.mono}>
        {formatCreatedCell(entry, issue, project) || (
          <span className={styles.muted}>—</span>
        )}
      </td>
      <td className={styles.mono}>
        {formatUpdatedCell(entry, issue, project) || (
          <span className={styles.muted}>—</span>
        )}
      </td>
      {customColumns.map((col) => {
        const text = issue
          ? formatCustomCell(issue, col, declaredKeys)
          : "";
        return (
          <td key={col.key} className={col.type === "markdown" ? undefined : styles.mono}>
            {text || <span className={styles.muted}>—</span>}
          </td>
        );
      })}
    </tr>
  );
}
