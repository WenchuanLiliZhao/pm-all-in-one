/**
 * Wiki Contents rail + main column for Home / wiki / members / settings.
 *
 * Fill contract: root `.shell` must fill the workspace Outlet box
 * (`.layoutFillViewport` on the workspace page). Rail scrolls locally;
 * `.main` takes remaining width; main column uses `PageWidth`
 * (`contentWidth="reading"` default, `"full"` for inventory tables).
 *
 * ↔ pages/channels/workspace-page/styles.module.scss — `.layoutFillViewport`
 * ↔ pages/channels/workspace-page/is-fill-viewport-path.ts — fill membership
 * ↔ components/wiki-shell/is-wiki-shell-path.ts — WikiShell route subset
 * ↔ components/wiki-all-pages — `contentWidth="full"` consumer
 * ↔ components/ui/page-width — reading / full column SoT
 * ↔ components/ui/dropdown-menu — Contents row / Add menus
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from "react";
import { useMatch, useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
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
import { TypeConfirmDialog } from "@/components/type-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Lucide } from "@/components/ui/lucide";
import { MaterialIcon } from "@/components/ui/material-icon";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { PageWidth } from "@/components/ui/page-width";
import { TreeRow, treeRowStyles } from "@/components/ui/tree-row";
import { getPm } from "@/lib/bridge";
import type { WikiSidebarNode, WikiSnapshot } from "@/lib/types";
import {
  canSidebarMove,
  contentsGroupKey,
  contentsSiblingRefIds,
  desiredContentsTempCollapseKeys,
  flattenContentsRows,
  applySidebarPlacement,
  resolveContentsDrop,
  type ContentsRow,
  type WikiSidebarMove,
} from "@/lib/wiki-contents-dnd";
import {
  applyCollapseRestore,
  applyForcedCollapseDiff,
  type CollapseBaseline,
} from "@/lib/drag-collapse";
import {
  collapsedKeysForExpandDepth,
  readWikiContentsCollapsed,
  readWikiContentsDefaultExpandDepth,
  writeWikiContentsCollapsed,
  WIKI_CONTENTS_DEPTH_CHANGED_EVENT,
} from "@/lib/wiki-contents-collapse";
import { adjustZoneForVerticalReorder, zoneFromOverTarget, type DropZone } from "@/lib/tree-dnd";
import { wikiContentsRefLabel } from "@/lib/wiki-sidebar-helpers";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import { useWiki } from "@/lib/workspace/wiki-context";
import styles from "./styles.module.scss";

const ROW_ICON_SIZE = 18;

/**
 * Contents nest step (rem). Applied as `--toc-indent` on the row chrome so
 * text/lead inset grows with depth while hover/active wash stays full-bleed.
 * Never put this on the `<li>` — that shrinks the wash (breaks rail-bleed).
 * ↔ styles.module.scss — `.tocRow` / `.tocRowStatic` pad-L uses `--toc-indent`
 * ↔ src/global-styles/seams.md — `rail-bleed↔cndt-wiki`
 */
const TOC_INDENT_STEP_REM = 0.85;

function tocIndentStyle(depth: number): CSSProperties {
  return { ["--toc-indent" as string]: `${depth * TOC_INDENT_STEP_REM}rem` };
}

function refLabel(
  node: Extract<WikiSidebarNode, { type: "ref" }>,
  wikiNodes: WikiSnapshot["nodes"],
): string {
  return wikiContentsRefLabel(node, wikiNodes);
}

function ancestorCollapseKeys(
  nodes: WikiSidebarNode[],
  pageId: string,
  depth = 0,
): string[] | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "ref") {
      if (node.id === pageId) {
        return [];
      }
      if (node.children?.length) {
        const nested = ancestorCollapseKeys(node.children, pageId, depth + 1);
        if (nested) {
          return [node.id, ...nested];
        }
      }
      continue;
    }
    if (node.type === "group") {
      const nested = ancestorCollapseKeys(node.children, pageId, depth + 1);
      if (nested) {
        return [contentsGroupKey(depth, node.title, i), ...nested];
      }
    }
  }
  return null;
}

function ContentsRowMenu({
  pageId,
  sidebar,
  onMove,
  onAddChild,
  onDelete,
}: {
  pageId: string;
  sidebar: WikiSidebarNode[];
  onMove: (id: string, move: WikiSidebarMove) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const stopDrag = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  const moves: Array<{
    key: WikiSidebarMove;
    label: string;
    enabled: boolean;
  }> = [
    {
      key: "up",
      label: "Move up",
      enabled: canSidebarMove(sidebar, pageId, "up"),
    },
    {
      key: "down",
      label: "Move down",
      enabled: canSidebarMove(sidebar, pageId, "down"),
    },
    {
      key: "indent",
      label: "Indent (make child of previous)",
      enabled: canSidebarMove(sidebar, pageId, "indent"),
    },
    {
      key: "outdent",
      label: "Outdent (move to parent level)",
      enabled: canSidebarMove(sidebar, pageId, "outdent"),
    },
  ];

  return (
    <span className={styles.rowMenuWrap}>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="small"
            className={styles.rowMenuBtn}
            aria-label="Contents row actions"
            title="Row actions"
            onPointerDown={stopDrag}
            onClick={(e) => e.stopPropagation()}
            startIcon={<MaterialIcon.MoreHoriz aria-hidden />}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" side="bottom">
          <DropdownMenu.ItemButton
            label="Add child page"
            onSelect={() => onAddChild(pageId)}
          />
          <DropdownMenu.Separator />
          {moves.map((item) => (
            <DropdownMenu.ItemButton
              key={item.key}
              label={item.label}
              disabled={!item.enabled}
              onSelect={() => onMove(pageId, item.key)}
            />
          ))}
          <DropdownMenu.Separator />
          <DropdownMenu.ItemButton
            label="Delete"
            onSelect={() => onDelete(pageId)}
          />
        </DropdownMenu.Content>
      </DropdownMenu>
    </span>
  );
}

function SortableRefRow({
  row,
  wikiNodes,
  sidebar,
  broken,
  activeId,
  isCollapsed,
  onToggle,
  onMoveInSidebar,
  onRequestDelete,
  onAddChild,
  dropZone,
  overId,
  dropLegal,
  inDropGroup,
  dropFlash,
  twistLocked,
}: {
  row: Extract<ContentsRow, { kind: "ref" }>;
  wikiNodes: WikiSnapshot["nodes"];
  sidebar: WikiSidebarNode[];
  broken: string[];
  activeId?: string;
  isCollapsed: boolean;
  onToggle: (key: string) => void;
  onMoveInSidebar: (id: string, move: WikiSidebarMove) => void;
  onRequestDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  dropZone: DropZone | null;
  overId: string | null;
  dropLegal: boolean | null;
  inDropGroup: boolean;
  dropFlash: { kind: "ok" | "bad"; token: number } | null;
  twistLocked: boolean;
}) {
  const navigate = useNavigate();
  const { node, depth, hasChildren } = row;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    animateLayoutChanges: () => false,
  });
  const isBroken = broken.includes(node.id);
  const isActive = !isBroken && activeId === node.id;
  const label = refLabel(node, wikiNodes);
  const isOver = overId === node.id;
  const zoneClass =
    isOver && dropLegal !== false && dropZone === "into"
      ? ` ${styles.dropInto}`
      : isOver && dropLegal !== false && dropZone === "before"
        ? ` ${styles.dropBefore}`
        : isOver && dropLegal !== false && dropZone === "after"
          ? ` ${styles.dropAfter}`
          : "";
  const groupClass = inDropGroup
    ? dropLegal === true
      ? ` ${styles.dropGroupLegal}`
      : dropLegal === false
        ? ` ${styles.dropGroupIllegal}`
        : ` ${styles.dropGroup}`
    : isOver && dropLegal === false
      ? ` ${styles.dropGroupIllegal}`
      : "";

  return (
    <li
      ref={setNodeRef}
      className={styles.tocItem}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <div
        data-dnd-key={node.id}
        className={`${styles.tocRow} ${treeRowStyles.rowHoverRoot}${
          isActive ? ` ${styles.rowActive}` : ""
        }${zoneClass}${groupClass}`}
        style={tocIndentStyle(depth)}
        {...attributes}
        {...listeners}
      >
        {dropFlash ? (
          <span
            key={dropFlash.token}
            className={
              dropFlash.kind === "ok" ? styles.dropFlashOk : styles.dropFlashBad
            }
            aria-hidden
          />
        ) : null}
        <TreeRow
          icon={<Lucide.FileText size={ROW_ICON_SIZE} aria-hidden />}
          hasChildren={hasChildren}
          expanded={!isCollapsed}
          onToggle={() => onToggle(node.id)}
          twistLocked={twistLocked}
          title={isBroken ? `${label} (missing)` : label}
          titleClassName={isBroken ? styles.titleBroken : styles.title}
          className={styles.rowSelect}
          aria-current={isActive ? "page" : undefined}
          aria-label={label}
          disabled={isBroken}
          onClick={() => {
            if (isBroken) {
              return;
            }
            navigate(`/w/wiki/${node.id}`);
          }}
        />
        {/* Menu stays outside TreeRow select — nested buttons are invalid HTML. */}
        <span className={styles.tocActions}>
          <ContentsRowMenu
            pageId={node.id}
            sidebar={sidebar}
            onMove={onMoveInSidebar}
            onAddChild={onAddChild}
            onDelete={onRequestDelete}
          />
        </span>
      </div>
    </li>
  );
}

function TocRows({
  rows,
  wikiNodes,
  sidebar,
  broken,
  activeRouteId,
  collapsed,
  onToggle,
  onMoveInSidebar,
  onRequestDelete,
  onAddChild,
  dropZone,
  overId,
  dropLegal,
  dropGroupIds,
  dropFlash,
  activeDragId,
}: {
  rows: readonly ContentsRow[];
  wikiNodes: WikiSnapshot["nodes"];
  sidebar: WikiSidebarNode[];
  broken: string[];
  activeRouteId?: string;
  collapsed: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onMoveInSidebar: (id: string, move: WikiSidebarMove) => void;
  onRequestDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  dropZone: DropZone | null;
  overId: string | null;
  dropLegal: boolean | null;
  dropGroupIds: ReadonlySet<string> | null;
  dropFlash: { key: string; kind: "ok" | "bad"; token: number } | null;
  activeDragId: string | null;
}) {
  return (
    <ul className={styles.tocList}>
      {rows.map((row) => {
        if (row.kind === "group") {
          const isCollapsed = collapsed.has(row.key);
          return (
            <li key={row.key} className={styles.tocGroup}>
              <div
                className={`${styles.tocRowStatic} ${treeRowStyles.rowHoverRoot}`}
                style={tocIndentStyle(row.depth)}
              >
                <TreeRow
                  icon={<Lucide.Folder size={ROW_ICON_SIZE} aria-hidden />}
                  hasChildren={row.hasChildren}
                  expanded={!isCollapsed}
                  onToggle={() => onToggle(row.key)}
                  twistLocked={Boolean(activeDragId)}
                  title={row.title}
                  titleClassName={styles.groupTitle}
                  className={styles.rowSelect}
                  aria-label={row.title}
                  onClick={() => {
                    if (row.hasChildren && !activeDragId) {
                      onToggle(row.key);
                    }
                  }}
                />
              </div>
            </li>
          );
        }
        if (row.kind === "link") {
          const external = /^https?:\/\//i.test(row.href);
          return (
            <li key={row.key}>
              <div
                className={`${styles.tocRowStatic} ${treeRowStyles.rowHoverRoot}`}
                style={tocIndentStyle(row.depth)}
              >
                <TreeRow
                  icon={<Lucide.FileText size={ROW_ICON_SIZE} aria-hidden />}
                  title={row.label}
                  titleClassName={styles.title}
                  className={styles.rowSelect}
                  aria-label={row.label}
                  onClick={() => {
                    if (external) {
                      window.open(row.href, "_blank", "noreferrer");
                      return;
                    }
                    window.location.assign(row.href);
                  }}
                />
              </div>
            </li>
          );
        }
        return (
          <SortableRefRow
            key={row.key}
            row={row}
            wikiNodes={wikiNodes}
            sidebar={sidebar}
            broken={broken}
            activeId={activeRouteId}
            isCollapsed={collapsed.has(row.key)}
            onToggle={onToggle}
            onMoveInSidebar={onMoveInSidebar}
            onRequestDelete={onRequestDelete}
            onAddChild={onAddChild}
            dropZone={dropZone}
            overId={overId}
            dropLegal={dropLegal}
            inDropGroup={Boolean(dropGroupIds?.has(row.key))}
            dropFlash={
              dropFlash?.key === row.key
                ? { kind: dropFlash.kind, token: dropFlash.token }
                : null
            }
            twistLocked={
              // Only freeze the twists that are mid-drop; collapsing an
              // unrelated row while dragging is harmless.
              Boolean(activeDragId) &&
              (row.key === activeDragId ||
                (dropLegal === true && row.key === overId))
            }
          />
        );
      })}
    </ul>
  );
}

/** Rail nav: pad on this hover wrapper, not on TreeRow select (styles.module.scss prompt). */
function RailNavRow({
  to,
  end,
  icon,
  title,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  title: string;
}) {
  const navigate = useNavigate();
  const match = useMatch({ path: to, end: end ?? false });
  const active = Boolean(match);

  return (
    <div
      className={`${styles.railNavRow} ${treeRowStyles.rowHoverRoot}${
        active ? ` ${styles.rowActive}` : ""
      }`}
    >
      <TreeRow
        icon={icon}
        title={title}
        titleClassName={styles.title}
        className={styles.rowSelect}
        aria-current={active ? "page" : undefined}
        aria-label={title}
        onClick={() => navigate(to)}
      />
    </div>
  );
}

export { isWikiShellPath } from "./is-wiki-shell-path";

export type WikiShellContentWidth = "reading" | "full";

export function WikiShell({
  children,
  contentWidth = "reading",
}: {
  children: ReactNode;
  /** `full` = no reading-width cap; main column does not scroll (child owns overflow). */
  contentWidth?: WikiShellContentWidth;
}) {
  const navigate = useNavigate();
  const { createWikiNode } = useWorkspace();
  const { wiki, error: wikiError, setWiki } = useWiki();
  const { wikiNodeId: routeId } = useParams<{ wikiNodeId?: string }>();
  const [error, setError] = useState<string | null>(null);
  // Prefer sync localStorage so remounts (Settings ↔ wiki pages) never flash fully-expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    return readWikiContentsCollapsed() ?? new Set();
  });
  const [foldReady, setFoldReady] = useState(
    () => readWikiContentsCollapsed() !== null,
  );
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    detail: string[];
  } | null>(null);
  const lastExpandedRouteRef = useRef<string | null>(null);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [zone, setZone] = useState<DropZone>("into");
  const pointerY = useRef(0);
  const dragStartY = useRef(0);
  const [dropFlash, setDropFlash] = useState<{
    key: string;
    kind: "ok" | "bad";
    token: number;
  } | null>(null);
  const dropFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropFlashTokenRef = useRef(0);
  const forcedCollapseRef = useRef(new Set<string>());
  const collapseBaselineRef = useRef<CollapseBaseline>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const contentsCollision: CollisionDetection = useCallback((args) => {
    const hits = pointerWithin(args);
    if (hits.length > 0) {
      return hits;
    }
    return closestCenter(args);
  }, []);

  const rows = useMemo(
    () => (wiki ? flattenContentsRows(wiki.sidebar, collapsed) : []),
    [wiki, collapsed],
  );

  const sortableIds = useMemo(
    () => rows.filter((row) => row.kind === "ref").map((row) => row.key),
    [rows],
  );

  const dropLegal = useMemo(() => {
    if (!wiki || !activeDragId || !overId || activeDragId === overId) {
      return null;
    }
    return resolveContentsDrop(wiki.sidebar, activeDragId, overId, zone).ok;
  }, [wiki, activeDragId, overId, zone]);

  const dropGroupIds = useMemo(() => {
    if (!wiki || !activeDragId) {
      return null;
    }
    const anchor =
      overId && overId !== activeDragId ? overId : activeDragId;
    return contentsSiblingRefIds(wiki.sidebar, anchor);
  }, [wiki, activeDragId, overId]);

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

  useEffect(() => {
    return () => {
      if (dropFlashTimerRef.current !== null) {
        clearTimeout(dropFlashTimerRef.current);
      }
    };
  }, []);

  // Hydrate from default expand depth before paint when nothing was persisted yet.
  useLayoutEffect(() => {
    if (!wiki || foldReady) {
      return;
    }
    setCollapsed(
      collapsedKeysForExpandDepth(
        wiki.sidebar,
        readWikiContentsDefaultExpandDepth(),
      ),
    );
    setFoldReady(true);
  }, [wiki, foldReady]);

  // Settings changed default depth → re-derive collapsed and persist.
  useEffect(() => {
    const onDepth = (ev: Event) => {
      if (!wiki) {
        return;
      }
      const detail = (ev as CustomEvent<number>).detail;
      const depth =
        typeof detail === "number" && Number.isFinite(detail)
          ? detail
          : readWikiContentsDefaultExpandDepth();
      const next = collapsedKeysForExpandDepth(wiki.sidebar, depth);
      setCollapsed(next);
      writeWikiContentsCollapsed(next);
      setFoldReady(true);
    };
    window.addEventListener(WIKI_CONTENTS_DEPTH_CHANGED_EVENT, onDepth);
    return () =>
      window.removeEventListener(WIKI_CONTENTS_DEPTH_CHANGED_EVENT, onDepth);
  }, [wiki]);

  // Persist fold preference; skip while drag forces temporary collapses.
  useEffect(() => {
    if (!foldReady || activeDragId !== null) {
      return;
    }
    writeWikiContentsCollapsed(collapsed);
  }, [collapsed, activeDragId, foldReady]);

  useEffect(() => {
    if (!routeId || !wiki) {
      return;
    }
    if (lastExpandedRouteRef.current === routeId) {
      return;
    }
    lastExpandedRouteRef.current = routeId;
    const path = ancestorCollapseKeys(wiki.sidebar, routeId);
    if (!path?.length) {
      return;
    }
    setCollapsed((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const key of path) {
        if (next.delete(key)) {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [routeId, wiki]);

  const onToggle = useCallback((key: string) => {
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
    setCollapsed((prev) => applyCollapseRestore(prev, forcedKeys, baselineSnap));
  }, []);

  useEffect(() => {
    if (!wiki || !activeDragId) {
      return;
    }
    setCollapsed((prev) =>
      applyForcedCollapseDiff(
        prev,
        forcedCollapseRef.current,
        collapseBaselineRef.current,
        desiredContentsTempCollapseKeys(wiki.sidebar, activeDragId),
      ),
    );
  }, [activeDragId, wiki]);

  const addNewToContents = async () => {
    await createWikiNode();
  };

  const onAddChildPage = useCallback(
    (parentId: string) => {
      // Ensure the new child is visible under this parent in Contents.
      setCollapsed((prev) => {
        if (!prev.has(parentId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
      void createWikiNode({ parentId });
    },
    [createWikiNode],
  );

  const onRequestDelete = (id: string) => {
    setPendingDelete({
      id,
      detail: [
        "This cannot be undone.",
        "It will also be removed from Contents (nested Contents items are promoted).",
      ],
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    const { id } = pendingDelete;
    setPendingDelete(null);
    try {
      await getPm().deleteWikiNode(id, { removeFile: true });
      setWiki(await getPm().getWiki());
      if (routeId === id) {
        navigate("/w/wiki");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onMoveInSidebar = async (id: string, move: WikiSidebarMove) => {
    try {
      setWiki(await getPm().moveWikiNodeInSidebar(id, move));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
    dragStartY.current = pointerY.current;
  };

  // PointerSensor uses setPointerCapture, so moves may not hit the rail wrapper.
  // Track on window so zoneFromOverTarget sees the live clientY.
  useEffect(() => {
    if (!activeDragId) {
      return;
    }
    const onMove = (e: PointerEvent) => {
      pointerY.current = e.clientY;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [activeDragId]);

  const resolveDropZone = (
    active: string,
    over: string,
    fallback: { top: number; height: number },
  ): DropZone => {
    const raw = zoneFromOverTarget(pointerY.current, over, fallback);
    return adjustZoneForVerticalReorder(
      raw,
      active,
      over,
      pointerY.current - dragStartY.current,
      sortableIds,
    );
  };

  const onDragOver = (event: DragOverEvent) => {
    const over = event.over;
    if (!over) {
      setOverId(null);
      return;
    }
    const id = String(over.id);
    setOverId(id);
    setZone(
      resolveDropZone(
        String(event.active.id),
        id,
        over.rect ?? { top: 0, height: 0 },
      ),
    );
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    // Recompute from live pointerY — zone state may be stale if capture
    // skipped early move events.
    const dropZone =
      over != null
        ? resolveDropZone(
            active,
            over,
            event.over?.rect ?? { top: 0, height: 0 },
          )
        : zone;
    const finishDrag = () => {
      restoreTempCollapse();
      setActiveDragId(null);
      setOverId(null);
    };
    if (!wiki || !over) {
      finishDrag();
      return;
    }
    const result = resolveContentsDrop(wiki.sidebar, active, over, dropZone);
    if (!result.ok) {
      flashDrop(active, "bad");
      finishDrag();
      return;
    }
    const previous = wiki;
    try {
      // Update the sortable list synchronously before clearing drag / awaiting
      // IPC. Otherwise dnd-kit snaps the row back to its pre-drop index while
      // the round-trip is in flight, then it jumps to the real target.
      setWiki({
        ...wiki,
        sidebar: applySidebarPlacement(
          wiki.sidebar,
          active,
          result.placement,
        ),
      });
      finishDrag();
      flashDrop(active, "ok");
      setWiki(
        await getPm().moveWikiNodeToSidebarPosition(active, result.placement),
      );
    } catch (e) {
      setWiki(previous);
      flashDrop(active, "bad");
      finishDrag();
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const dragLabel = activeDragId
    ? wiki?.nodes.find((n) => n.id === activeDragId)?.title ?? activeDragId
    : "";

  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        {/* Rail section order: Workspace → Contents.
         * Stack gap is `.rail` gap only (seams `rail-section-stack`). */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Workspace</div>
          <RailNavRow
            to="/w/home"
            end
            icon={<Lucide.Home size={ROW_ICON_SIZE} aria-hidden />}
            title="Overview"
          />
          <RailNavRow
            to="/w/wiki"
            end
            icon={<Lucide.Layers size={ROW_ICON_SIZE} aria-hidden />}
            title="All pages"
          />
          <RailNavRow
            to="/w/members"
            end
            icon={<Lucide.Users size={ROW_ICON_SIZE} aria-hidden />}
            title="Members"
          />
          {/* Single Settings entry (route still `/w/settings/general`). Put new
           * workspace settings on that same page unless the page gets too long —
           * only then split into sibling rail rows / routes.
           * ↔ pages/channels/workspace-page/route.tsx — SettingsGeneralView */}
          <RailNavRow
            to="/w/settings/general"
            icon={<Lucide.CircleDot size={ROW_ICON_SIZE} aria-hidden />}
            title="Settings"
          />
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Contents</div>
            <div className={styles.addWrap}>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button
                    variant="outlined"
                    size="small"
                    endIcon={<Lucide.ChevronDown />}
                  >
                    Add
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" side="bottom">
                  <DropdownMenu.ItemButton
                    label="New page"
                    onSelect={() => void addNewToContents()}
                  />
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          </div>
          {wiki && foldReady ? (
            <>
              <div
                onPointerMove={(e) => {
                  pointerY.current = e.clientY;
                }}
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={contentsCollision}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDragEnd={(e) => {
                    void onDragEnd(e);
                  }}
                  onDragCancel={() => {
                    restoreTempCollapse();
                    setActiveDragId(null);
                    setOverId(null);
                  }}
                >
                  <SortableContext
                    items={sortableIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <TocRows
                      rows={rows}
                      wikiNodes={wiki.nodes}
                      sidebar={wiki.sidebar}
                      broken={wiki.broken}
                      activeRouteId={routeId}
                      collapsed={collapsed}
                      onToggle={onToggle}
                      onMoveInSidebar={(id, move) => void onMoveInSidebar(id, move)}
                      onRequestDelete={onRequestDelete}
                      onAddChild={onAddChildPage}
                      dropZone={activeDragId ? zone : null}
                      overId={overId}
                      dropLegal={dropLegal}
                      dropGroupIds={dropGroupIds}
                      dropFlash={dropFlash}
                      activeDragId={activeDragId}
                    />
                  </SortableContext>
                  <DragOverlay dropAnimation={null}>
                    {activeDragId ? (
                      <div
                        className={`${styles.dragOverlay}${
                          dropLegal === true
                            ? ` ${styles.dragOverlayLegal}`
                            : dropLegal === false
                              ? ` ${styles.dragOverlayIllegal}`
                              : ""
                        }`}
                      >
                        {dragLabel}
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
              {wiki.sidebar.length === 0 ? (
                <p className={styles.emptyHint}>
                  Contents is empty. Use Add to create a page, or open{" "}
                  <button
                    type="button"
                    className={styles.inlineLink}
                    onClick={() => navigate("/w/wiki")}
                  >
                    All pages
                  </button>{" "}
                  to manage the inventory.
                </p>
              ) : null}
            </>
          ) : (
            <p className={styles.emptyHint}>Loading…</p>
          )}
        </div>
        {error || wikiError ? (
          <p className={styles.railError}>{error ?? wikiError}</p>
        ) : null}
      </aside>
      <div
        className={[
          styles.main,
          contentWidth === "full" ? styles.mainFull : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <PageWidth
          width={contentWidth === "full" ? "full" : "reading"}
          padded
          className={contentWidth === "full" ? styles.mainBodyFull : undefined}
        >
          {children}
        </PageWidth>
      </div>
      <TypeConfirmDialog
        open={pendingDelete !== null}
        title="Delete wiki page?"
        lead={
          <>
            Delete disk directory <code>wiki/{pendingDelete?.id}/</code>{" "}
            permanently?
          </>
        }
        detail={pendingDelete?.detail}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
