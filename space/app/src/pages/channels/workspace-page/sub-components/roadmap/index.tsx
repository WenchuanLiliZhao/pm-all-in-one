import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
} from "@pm-core/view-order-apply";
import type { Issue, IssueTree, TreeNode } from "@/lib/types";
import { issueRefKey } from "@/lib/types";
import { getPm } from "@/lib/bridge";
import {
  useWorkspace,
  type Selection,
} from "@/lib/workspace/workspace-context";
import { useViewOrderedTree } from "@/lib/workspace/use-view-ordered-tree";
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
import {
  ZOOM_LEVELS,
  type OffViewportSide,
  type TimelineWindow,
  type ZoomLevel,
  barGeometry,
  centerMsFromScroll,
  dayDeltaFromRailPx,
  extendWindowLeft,
  extendWindowRight,
  formatHoverDateLabel,
  formatIsoDate,
  formatScheduleRangeLabel,
  ghostPreviewForIssue,
  applyBarDateDrag,
  msToPx,
  offViewportSide,
  parseIsoDate,
  pxToMs,
  reanchorWindow,
  scrollLeftForCenterMs,
  seedWindow,
  targetWindowUnitCount,
  timelineGridBackground,
  todayAnchorMs,
  DAY_MS,
} from "./date-range";
// ↔ date-range.ts `todayAnchorMs` — refresh init, Today button, and today line share one rail
import type { BarDragMode, GhostPreview } from "./date-range";
import {
  collectParentProjectionBands,
  PARENT_PROJECTION_INSET_Y,
} from "./projection-bands";
import {
  collectBlockedByEdges,
  DEP_EDGE_TOKENS,
  findLinkDropTarget,
  inboundLinkAnchor,
  outwardDepPath,
  layoutDepEdges,
  rowCenterY,
  type DepBarAnchor,
} from "./dep-edges";
import styles from "./styles.module.scss";
import { DropdownMenu } from "@/components/ui/dropdown-menu"; // ↔ Content `anchorPoint` date menu
import { TreeRow, treeRowStyles } from "@/components/ui/tree-row";
import {
  issueKindIcon,
  issueKindKey,
} from "@/components/ui/tree-row/kind-icon";
import {
  issueStatusCssColor,
  issueStatusIcon,
  issueStatusLabel,
} from "@/components/ui/issue-status";
import {
  issuePriorityIcon,
  issuePriorityLabel,
} from "@/components/ui/issue-priority";
import { TreeCollapseControls } from "@/components/tree-collapse-controls";
import type { IssuePriorityId } from "@/lib/issue-priority";
import type { IssueStatusId } from "@/lib/issue-status";

const LABEL_W = 280;
const DEFAULT_VIEWPORT = 800;
/** Coarse 22 + fine 28 (month/quarter). Week fine is taller — see headerHeight(). */
const HEADER_H_DEFAULT = 50;
const HEADER_H_WEEK = 62;

/** Roadmap tree fold preference (browser UI state — not product / member storage). */
const ROADMAP_COLLAPSED_KEY = "pm.roadmap.collapsed";
/** Roadmap Week / Month / Quarter preference (browser UI state). */
const ROADMAP_ZOOM_KEY = "pm.roadmap.zoom-level";
const DEFAULT_ZOOM: ZoomLevel = "month";

function readRoadmapCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(ROADMAP_COLLAPSED_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(
      parsed.filter((k): k is string => typeof k === "string" && k.length > 0),
    );
  } catch {
    // privacy mode / storage disabled / corrupt JSON
  }
  return new Set();
}

function writeRoadmapCollapsed(collapsed: ReadonlySet<string>) {
  try {
    localStorage.setItem(
      ROADMAP_COLLAPSED_KEY,
      JSON.stringify([...collapsed]),
    );
  } catch {
    // privacy mode / storage disabled
  }
}

function readRoadmapZoom(): ZoomLevel {
  try {
    const raw = localStorage.getItem(ROADMAP_ZOOM_KEY);
    if (raw && (ZOOM_LEVELS as readonly string[]).includes(raw)) {
      return raw as ZoomLevel;
    }
  } catch {
    // privacy mode / storage disabled
  }
  return DEFAULT_ZOOM;
}

function writeRoadmapZoom(zoom: ZoomLevel) {
  try {
    localStorage.setItem(ROADMAP_ZOOM_KEY, zoom);
  } catch {
    // privacy mode / storage disabled
  }
}
const ROW_H = 36;

/**
 * Timeline date writes use ⌘-click on macOS and Ctrl-click elsewhere.
 * Mac must not treat Ctrl-click as a date write (native context-menu chord).
 */
function isMacTimelineHost(): boolean {
  const platform = window.pm?.platform;
  if (platform === "darwin") {
    return true;
  }
  if (platform === "win32" || platform === "linux") {
    return false;
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function isSetDateModifier(e: {
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  return isMacTimelineHost() ? e.metaKey : e.ctrlKey;
}

function setDateChordLabel(): string {
  return isMacTimelineHost() ? "⌘-click" : "Ctrl-click";
}

function headerHeight(zoom: ZoomLevel): number {
  return zoom === "week" ? HEADER_H_WEEK : HEADER_H_DEFAULT;
}

function jumpSidesEqual(
  a: Record<string, OffViewportSide>,
  b: Record<string, OffViewportSide>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const k of aKeys) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
}

export interface RoadmapBoardProps {
  viewKey: string;
  tree: IssueTree;
  issues: Issue[];
  selection: Selection;
  onSelect: (sel: Selection) => void;
  onPersistIssueDates: (
    projectId: string,
    issueId: string,
    dates: { startDate?: string | null; endDate?: string | null },
  ) => Promise<void>;
  onPersistIssueBlockedBy: (
    projectId: string,
    issueId: string,
    blockedBy: string[],
  ) => Promise<void>;
}

interface FlatRow {
  nodeKey: string;
  depth: number;
  entry: TreeNode;
  issue: Issue | null;
}

function flattenVisible(
  tree: IssueTree,
  issuesByKey: Map<string, Issue>,
  collapsed: Set<string>,
): FlatRow[] {
  const rows: FlatRow[] = [];

  const walk = (nodeKey: string, depth: number) => {
    const entry = tree.byId[nodeKey];
    if (!entry) {
      return;
    }
    const issue =
      entry.kind === "issue" && entry.issueId !== undefined
        ? (issuesByKey.get(issueRefKey(entry.projectId, entry.issueId)) ?? null)
        : null;
    rows.push({ nodeKey, depth, entry, issue });
    const kids = tree.children[nodeKey] ?? [];
    if (kids.length === 0 || collapsed.has(nodeKey)) {
      return;
    }
    for (const cid of kids) {
      walk(cid, depth + 1);
    }
  };

  for (const root of tree.roots) {
    walk(root, 0);
  }
  return rows;
}

function zoomLabel(z: ZoomLevel): string {
  if (z === "week") {
    return "Week";
  }
  if (z === "month") {
    return "Month";
  }
  return "Quarter";
}

type PendingScroll =
  | { kind: "snap"; left: number }
  | { kind: "smooth"; to: number; from: "start" | "end" };

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

type DateContextMenu = {
  clientX: number;
  clientY: number;
  dateIso: string;
  projectId: string;
  issueId: string;
};

type BarDragState = {
  projectId: string;
  issueId: string;
  mode: BarDragMode;
  originStart: string | null;
  originEnd: string | null;
  /** Pointer X relative to timeline rail at pointerdown. */
  originRailPx: number;
  dayDelta: number;
  moved: boolean;
};

type LinkDragState = {
  projectId: string;
  fromIssueId: string;
  x1: number;
  y1: number;
  pointerX: number;
  pointerY: number;
};

/**
 * Menu disable relative to known dates only (not provisional fade span):
 * - right of end → disable Set start (when end exists)
 * - left of start → disable Set end (when start exists)
 * Clicks on/between the known dates leave both enabled.
 */
function menuDateDisableFlags(
  clickIso: string,
  startDate: string | null,
  endDate: string | null,
): { disableSetStart: boolean; disableSetEnd: boolean } {
  const click = parseIsoDate(clickIso);
  if (click === null) {
    return { disableSetStart: false, disableSetEnd: false };
  }
  const startMs = startDate ? parseIsoDate(startDate) : null;
  const endMs = endDate ? parseIsoDate(endDate) : null;
  return {
    disableSetStart: endMs !== null && click > endMs,
    disableSetEnd: startMs !== null && click < startMs,
  };
}

/** Bar / open-end fills use shared status tone. ↔ @/components/ui/issue-status/css-color */
function barFillStyle(
  kind: "closed" | "open-start" | "open-end",
  status: IssueStatusId | undefined,
): CSSProperties {
  const color = issueStatusCssColor(status);
  if (kind === "open-start") {
    return {
      backgroundColor: "transparent",
      backgroundImage: `linear-gradient(to right, ${color}, transparent)`,
    };
  }
  if (kind === "open-end") {
    return {
      backgroundColor: "transparent",
      backgroundImage: `linear-gradient(to right, transparent, ${color})`,
    };
  }
  return { backgroundColor: color };
}

function withOrderedDates(
  field: "start" | "end",
  dateIso: string,
  currentStart: string | null,
  currentEnd: string | null,
): { startDate: string | null; endDate: string | null } {
  const clicked = parseIsoDate(dateIso);
  if (clicked === null) {
    return { startDate: currentStart, endDate: currentEnd };
  }
  if (field === "start") {
    let endDate = currentEnd;
    if (endDate) {
      const endMs = parseIsoDate(endDate);
      if (endMs !== null && clicked > endMs) {
        endDate = dateIso;
      }
    }
    return { startDate: dateIso, endDate };
  }
  let startDate = currentStart;
  if (startDate) {
    const startMs = parseIsoDate(startDate);
    if (startMs !== null && clicked < startMs) {
      startDate = dateIso;
    }
  }
  return { startDate, endDate: dateIso };
}

export function RoadmapBoard({
  viewKey,
  tree: rawTree,
  issues,
  selection,
  onSelect,
  onPersistIssueDates,
  onPersistIssueBlockedBy,
}: RoadmapBoardProps) {
  const { moveIssueTo, setError } = useWorkspace();
  const { orderedTree, order, persistOrder } = useViewOrderedTree(
    viewKey,
    rawTree,
  );
  const tree = orderedTree ?? rawTree;

  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRailRef = useRef<HTMLDivElement>(null);
  const overlayInnerRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef(0);
  const extendingRef = useRef(false);
  const pendingScroll = useRef<PendingScroll | null>(null);
  const didInitScroll = useRef(false);
  const didMeasureViewport = useRef(false);
  const jumpRafRef = useRef<number | null>(null);
  const scrollAnimRafRef = useRef<number | null>(null);
  const animatingScrollRef = useRef(false);
  /** Blocks infinite-pan extend while Today/jump reseeds + eases (incl. pre-rAF gap). */
  const suppressPanExtendRef = useRef(false);
  const rowsRef = useRef<FlatRow[]>([]);
  const timelineRef = useRef<TimelineWindow | null>(null);
  const viewportPxRef = useRef(DEFAULT_VIEWPORT);
  const syncOverlayYRef = useRef<(scrollTop: number) => void>(() => {});
  const recomputeJumpSidesRef = useRef<() => void>(() => {});

  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    readRoadmapCollapsed(),
  );
  const forcedCollapseRef = useRef(new Set<string>());
  const collapseBaselineRef = useRef(new Map<string, boolean>());
  const dropFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropFlashTokenRef = useRef(0);
  const [dropFlash, setDropFlash] = useState<{
    key: string;
    kind: "ok" | "bad";
    token: number;
  } | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>(() => readRoadmapZoom());
  const [viewportPx, setViewportPx] = useState(DEFAULT_VIEWPORT);
  const [jumpSides, setJumpSides] = useState<Record<string, OffViewportSide>>(
    {},
  );
  const [timeline, setTimeline] = useState<TimelineWindow>(() =>
    seedWindow(readRoadmapZoom(), DEFAULT_VIEWPORT),
  );
  /**
   * Ghost / ⌘-preview only — not the visual hover line.
   * Visual line is DOM-imperative (see applyHoverPointer) so mousemove
   * does not re-render the whole board every frame.
   */
  const [hoverPx, setHoverPx] = useState<number | null>(null);
  const [hoverRowKey, setHoverRowKey] = useState<string | null>(null);
  /** ⌘ / Ctrl held — gates ghost preview and track date writes. */
  const [dateModHeld, setDateModHeld] = useState(false);
  const [dateMenu, setDateMenu] = useState<DateContextMenu | null>(null);
  const [barDrag, setBarDrag] = useState<BarDragState | null>(null);
  const [linkDrag, setLinkDrag] = useState<LinkDragState | null>(null);
  const linkDragRef = useRef<LinkDragState | null>(null);
  linkDragRef.current = linkDrag;
  const [barDragPointer, setBarDragPointer] = useState<{
    clientX: number;
    clientY: number;
  } | null>(null);
  /** Last pointer clientX while hovering the timeline — reapplied on scroll. */
  const hoverClientXRef = useRef<number | null>(null);
  /** Last pointer clientY while hovering the timeline — reapplied on scroll. */
  const hoverClientYRef = useRef<number | null>(null);
  /** Live hover X in rail coords — source of truth for pointer + clicks. */
  const hoverPxRef = useRef<number | null>(null);
  const hoverRowKeyRef = useRef<string | null>(null);
  /** ISO day last pushed into hoverPx state (⌘ ghost); skip same-day setState. */
  const hoverGhostDayRef = useRef<string | null>(null);
  const hoverPointerRef = useRef<HTMLDivElement>(null);
  const hoverChipRef = useRef<HTMLSpanElement>(null);
  /** Suppress track click after a real bar drag. */
  const barDragMovedRef = useRef(false);
  const barDragRef = useRef<BarDragState | null>(null);
  barDragRef.current = barDrag;

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
    setCollapsed((prev) => applyCollapseRestore(prev, forcedKeys, baselineSnap));
  }, []);

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

  const issuesByKey = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues) {
      map.set(issueRefKey(issue.projectId, issue.id), issue);
    }
    return map;
  }, [issues]);

  const rows = useMemo(
    () => flattenVisible(tree, issuesByKey, collapsed),
    [tree, issuesByKey, collapsed],
  );
  const rowIds = useMemo(() => rows.map((r) => r.nodeKey), [rows]);

  const projectionBands = useMemo(() => {
    const dragPreview =
      barDrag !== null
        ? applyBarDateDrag(
            barDrag.mode,
            barDrag.originStart,
            barDrag.originEnd,
            barDrag.dayDelta,
          )
        : null;
    const inputs = rows.map((row) => {
      let startDate = row.issue?.startDate ?? null;
      let endDate = row.issue?.endDate ?? null;
      if (
        dragPreview &&
        barDrag &&
        row.entry.kind === "issue" &&
        row.entry.issueId !== undefined &&
        barDrag.projectId === row.entry.projectId &&
        barDrag.issueId === row.entry.issueId
      ) {
        startDate = dragPreview.startDate;
        endDate = dragPreview.endDate;
      }
      return {
        nodeKey: row.nodeKey,
        depth: row.depth,
        startDate,
        endDate,
        status: row.issue?.status,
      };
    });
    return collectParentProjectionBands(
      inputs,
      timeline,
      ROW_H,
      PARENT_PROJECTION_INSET_Y,
    );
  }, [rows, timeline, barDrag]);

  const { depAnchors, depPaths } = useMemo(() => {
    const dragPreview =
      barDrag !== null
        ? applyBarDateDrag(
            barDrag.mode,
            barDrag.originStart,
            barDrag.originEnd,
            barDrag.dayDelta,
          )
        : null;
    const anchors: DepBarAnchor[] = [];
    const issueRows: { id: string; blockedBy: readonly string[] }[] = [];
    rows.forEach((row, rowIndex) => {
      if (row.entry.kind !== "issue" || !row.issue || !row.entry.issueId) {
        return;
      }
      let startDate = row.issue.startDate;
      let endDate = row.issue.endDate;
      if (
        dragPreview &&
        barDrag &&
        barDrag.projectId === row.entry.projectId &&
        barDrag.issueId === row.entry.issueId
      ) {
        startDate = dragPreview.startDate;
        endDate = dragPreview.endDate;
      }
      const geo = barGeometry(startDate, endDate, timeline);
      if (!geo) {
        return;
      }
      anchors.push({
        id: row.entry.issueId,
        rowIndex,
        leftPx: geo.leftPx,
        widthPx: geo.widthPx,
      });
      issueRows.push({
        id: row.entry.issueId,
        blockedBy: row.issue.blockedBy ?? [],
      });
    });
    // Edges only among issues that appear in this visible board (any project).
    // Cross-project edges are invalid on disk; filter same-project pairs via issue map.
    const edges = collectBlockedByEdges(issueRows).filter((e) => {
      const from = issues.find((i) => i.id === e.fromId);
      const to = issues.find((i) => i.id === e.toId);
      return Boolean(from && to && from.projectId === to.projectId);
    });
    return {
      depAnchors: anchors,
      depPaths: layoutDepEdges(anchors, edges, ROW_H, DEP_EDGE_TOKENS),
    };
  }, [
    rows,
    timeline,
    barDrag,
    issues,
    // Token primitives so editing DEP_EDGE_TOKENS invalidates this memo on HMR.
    DEP_EDGE_TOKENS.outwardStubPx,
    DEP_EDGE_TOKENS.turnCurvature,
  ]);

  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragZone, setDragZone] = useState<DropZone>("into");
  const pointerY = useRef(0);
  /** Track label DnD so we can freeze horizontal timeline pan. */
  const dragActiveIdRef = useRef<string | null>(null);
  const lastScrollLeftDuringDragRef = useRef<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const dropLegal = useMemo(() => {
    if (!dragActiveId || !dragOverId || dragActiveId === dragOverId) {
      return null;
    }
    return (
      resolveDropIntent(tree, issues, dragActiveId, dragOverId, dragZone)
        .kind !== "reject"
    );
  }, [dragActiveId, dragOverId, dragZone, tree, issues]);

  const dropGroupKeys = useMemo(() => {
    if (!dragActiveId) {
      return null;
    }
    if (dragOverId && dragActiveId !== dragOverId) {
      return dropGroupMemberKeys(
        tree,
        dropGroupParentKey(tree, dragOverId, dragZone),
      );
    }
    return dropGroupMemberKeys(tree, parentKeyOf(tree, dragActiveId));
  }, [dragActiveId, dragOverId, dragZone, tree]);

  useEffect(() => {
    if (!dragActiveId) {
      return;
    }
    setCollapsed((prev) =>
      applyForcedCollapseDiff(
        prev,
        forcedCollapseRef.current,
        collapseBaselineRef.current,
        desiredTempCollapseKeys(tree, dragActiveId),
      ),
    );
  }, [dragActiveId, tree]);

  /** Persist fold preference; skip while drag forces temporary collapses. */
  useEffect(() => {
    if (dragActiveId !== null) {
      return;
    }
    writeRoadmapCollapsed(collapsed);
  }, [collapsed, dragActiveId]);

  const handleLabelDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const active = String(event.active.id);
      const over = event.over ? String(event.over.id) : null;
      const zone = dragZone;
      const finishDrag = (): void => {
        restoreTempCollapse();
        setDragActiveId(null);
        setDragOverId(null);
      };
      if (!over) {
        finishDrag();
        return;
      }
      const intent = resolveDropIntent(tree, issues, active, over, zone);
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
        let next = materializeSiblingOrder(tree, order, intent.fromParentKey);
        next = materializeSiblingOrder(tree, next, intent.toParentKey);
        next = reparentInOrder(
          next,
          intent.activeId,
          intent.fromParentKey,
          intent.toParentKey,
          intent.beforeId,
        );
        await persistOrder(next);
        await getPm().pruneViewOrderKey(intent.activeId, viewKey);
        finishDrag();
        flashDrop(active, "ok");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        finishDrag();
        flashDrop(active, "bad");
      }
    },
    [
      dragZone,
      tree,
      issues,
      order,
      persistOrder,
      moveIssueTo,
      viewKey,
      setError,
      restoreTempCollapse,
      flashDrop,
    ],
  );

  rowsRef.current = rows;
  timelineRef.current = timeline;
  viewportPxRef.current = viewportPx;

  const recomputeJumpSides = useCallback(() => {
    const tl = timelineRef.current;
    if (!tl) {
      return;
    }
    const left = scrollLeftRef.current;
    const V = viewportPxRef.current;
    const next: Record<string, OffViewportSide> = {};
    for (const row of rowsRef.current) {
      if (row.entry.kind !== "issue" || !row.issue) {
        continue;
      }
      const side = offViewportSide(
        row.issue.startDate,
        row.issue.endDate,
        tl,
        left,
        V,
      );
      if (side) {
        next[row.nodeKey] = side;
      }
    }
    setJumpSides((prev) => (jumpSidesEqual(prev, next) ? prev : next));
  }, []);

  const syncOverlayY = useCallback((scrollTop: number) => {
    const inner = overlayInnerRef.current;
    if (inner) {
      inner.style.transform = `translate3d(0, ${-scrollTop}px, 0)`;
    }
  }, []);

  /** Move hover line + chip without React (mousemove must stay off the React path). */
  const applyHoverPointer = useCallback((px: number | null) => {
    hoverPxRef.current = px;
    const el = hoverPointerRef.current;
    if (!el) {
      return;
    }
    if (px === null) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    el.style.left = `${px}px`;
    const chip = hoverChipRef.current;
    const tl = timelineRef.current;
    if (chip && tl) {
      chip.textContent = formatHoverDateLabel(pxToMs(px, tl));
    }
  }, []);

  syncOverlayYRef.current = syncOverlayY;
  recomputeJumpSidesRef.current = recomputeJumpSides;

  const cancelScrollAnim = useCallback(() => {
    if (scrollAnimRafRef.current !== null) {
      cancelAnimationFrame(scrollAnimRafRef.current);
      scrollAnimRafRef.current = null;
    }
    animatingScrollRef.current = false;
    suppressPanExtendRef.current = false;
  }, []);

  const animateScrollLeft = useCallback(
    (el: HTMLElement, to: number) => {
      if (scrollAnimRafRef.current !== null) {
        cancelAnimationFrame(scrollAnimRafRef.current);
        scrollAnimRafRef.current = null;
      }
      const from = el.scrollLeft;
      const dist = to - from;
      if (Math.abs(dist) < 1) {
        el.scrollLeft = to;
        scrollLeftRef.current = to;
        animatingScrollRef.current = false;
        suppressPanExtendRef.current = false;
        recomputeJumpSidesRef.current();
        return;
      }
      // Longer travel → slightly longer ease; cap so it stays snappy.
      const duration = Math.min(560, Math.max(280, Math.abs(dist) * 0.4));
      animatingScrollRef.current = true;
      suppressPanExtendRef.current = true;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const left = from + dist * easeOutCubic(t);
        el.scrollLeft = left;
        scrollLeftRef.current = left;
        syncOverlayYRef.current(el.scrollTop);
        if (t < 1) {
          scrollAnimRafRef.current = requestAnimationFrame(step);
        } else {
          scrollAnimRafRef.current = null;
          animatingScrollRef.current = false;
          suppressPanExtendRef.current = false;
          recomputeJumpSidesRef.current();
        }
      };
      scrollAnimRafRef.current = requestAnimationFrame(step);
    },
    [],
  );

  // Measure timeline viewport (scrollport minus sticky label column).
  // When the detail panel opens/closes, clientWidth changes but scrollLeft does not —
  // keep the same center *date* so refresh+Today stay aligned (Today remeasures live;
  // init alone would stay wrong after the panel settles).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const next = Math.max(200, el.clientWidth - LABEL_W);
      const prev = viewportPxRef.current;
      didMeasureViewport.current = true;

      if (
        didInitScroll.current &&
        next !== prev &&
        timelineRef.current &&
        !animatingScrollRef.current &&
        !extendingRef.current
      ) {
        const centerMs = centerMsFromScroll(
          timelineRef.current,
          el.scrollLeft,
          prev,
        );
        const to = scrollLeftForCenterMs(timelineRef.current, centerMs, next);
        if (Math.abs(el.scrollLeft - to) >= 1) {
          suppressPanExtendRef.current = true;
          el.scrollLeft = to;
          scrollLeftRef.current = to;
          syncOverlayYRef.current(el.scrollTop);
          recomputeJumpSidesRef.current();
          // Release on next frame so the synthetic scroll event does not edge-extend.
          requestAnimationFrame(() => {
            suppressPanExtendRef.current = false;
          });
        }
      }

      viewportPxRef.current = next;
      setViewportPx(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Apply pending scroll after window mutation (pan extend / zoom / jump)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const pending = pendingScroll.current;
    if (!el || !pending) {
      return;
    }
    pendingScroll.current = null;
    extendingRef.current = false;

    if (pending.kind === "snap") {
      el.scrollLeft = pending.left;
      scrollLeftRef.current = pending.left;
      syncOverlayY(el.scrollTop);
      recomputeJumpSides();
      return;
    }

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const fromLeft = pending.from === "start" ? 0 : maxScroll;
    // Suppress pan-extend BEFORE writing scrollLeft=0/max — otherwise handleScroll
    // treats the jump-start as an edge pan and overwrites this smooth pending.
    suppressPanExtendRef.current = true;
    animatingScrollRef.current = true;
    el.scrollLeft = fromLeft;
    scrollLeftRef.current = fromLeft;
    syncOverlayY(el.scrollTop);
    // Paint the new window once, then ease to the target.
    requestAnimationFrame(() => {
      animateScrollLeft(el, pending.to);
    });
  }, [timeline, syncOverlayY, recomputeJumpSides, animateScrollLeft]);

  // Recompute arrows when rows / viewport / timeline change (not every scroll)
  useEffect(() => {
    recomputeJumpSides();
  }, [rows, timeline, viewportPx, recomputeJumpSides]);

  useEffect(() => {
    return () => cancelScrollAnim();
  }, [cancelScrollAnim]);

  const unitBg = useMemo(
    () => timelineGridBackground(timeline.zoom, timeline.unitPx),
    [timeline.zoom, timeline.unitPx],
  );

  // ↔ date-range.ts `todayAnchorMs` — same rail as Today / refresh (not raw Date.now / unit start)
  const todayLeftPx = useMemo(() => {
    const anchor = todayAnchorMs();
    if (anchor < timeline.startMs || anchor >= timeline.endMs) {
      return null;
    }
    return msToPx(anchor, timeline);
  }, [timeline]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    if (dragActiveIdRef.current) {
      const locked = lastScrollLeftDuringDragRef.current;
      // Freeze horizontal timeline pan while reordering labels (dnd-kit / edge scroll).
      if (locked !== null && el.scrollLeft !== locked) {
        el.scrollLeft = locked;
      }
    }

    // V-sync overlay immediately (no React) — kills H-jitter for arrows
    syncOverlayY(el.scrollTop);
    // Keep scrollLeftRef in sync, but do not overwrite the drag lock baseline.
    if (!dragActiveIdRef.current) {
      scrollLeftRef.current = el.scrollLeft;
    } else if (lastScrollLeftDuringDragRef.current !== null) {
      scrollLeftRef.current = lastScrollLeftDuringDragRef.current;
    } else {
      scrollLeftRef.current = el.scrollLeft;
    }

    // Keep hover pointer under the cursor while content scrolls (DOM, not React)
    const hoverClientX = hoverClientXRef.current;
    const hoverClientY = hoverClientYRef.current;
    if (hoverClientX !== null) {
      const rail = timelineRailRef.current;
      const tl = timelineRef.current;
      if (rail && tl) {
        const px = hoverClientX - rail.getBoundingClientRect().left;
        const nextPx = Math.max(0, Math.min(tl.totalWidthPx, px));
        applyHoverPointer(nextPx);
        if (hoverClientY !== null) {
          const y = hoverClientY - rail.getBoundingClientRect().top;
          const idx = Math.floor(y / ROW_H);
          const key =
            idx >= 0 && idx < rowsRef.current.length
              ? rowsRef.current[idx]!.nodeKey
              : null;
          if (key !== hoverRowKeyRef.current) {
            hoverRowKeyRef.current = key;
            setHoverRowKey(key);
          }
        }
      }
    }

    if (jumpRafRef.current !== null) {
      cancelAnimationFrame(jumpRafRef.current);
    }
    jumpRafRef.current = requestAnimationFrame(() => {
      jumpRafRef.current = null;
      recomputeJumpSides();
    });

    // Don't fight infinite-pan extend while a programmatic scroll is easing,
    // or in the gap after scrollLeft=0/max before rAF animation starts.
    if (
      extendingRef.current ||
      animatingScrollRef.current ||
      suppressPanExtendRef.current
    ) {
      return;
    }

    const V = Math.max(200, el.clientWidth - LABEL_W);
    const leftPx = el.scrollLeft;
    const rightPx = leftPx + V;
    const sheetW = timeline.totalWidthPx;
    const T = Math.max(2 * timeline.unitPx, V * 0.35);
    const nVis = Math.max(1, Math.ceil(V / timeline.unitPx));
    const extendBy = Math.max(
      nVis,
      Math.ceil(targetWindowUnitCount(timeline.zoom, V) / 7),
    );

    if (leftPx < T) {
      extendingRef.current = true;
      const { window: next, deltaPx } = extendWindowLeft(timeline, extendBy);
      pendingScroll.current = { kind: "snap", left: leftPx + deltaPx };
      setTimeline(next);
      return;
    }

    if (sheetW - rightPx < T) {
      extendingRef.current = true;
      const { window: next, trimmedLeftPx } = extendWindowRight(
        timeline,
        extendBy,
      );
      pendingScroll.current = {
        kind: "snap",
        left: Math.max(0, leftPx - trimmedLeftPx),
      };
      setTimeline(next);
    }
  }, [timeline, syncOverlayY, recomputeJumpSides, applyHoverPointer]);

  /**
   * Scroll so `ms` sits at the timeline viewport center.
   * In-window: only adjust scrollLeft (no-op if already there).
   * Out-of-window: reseed, then snap/ease — never rebuild when already on target.
   * ↔ date-range.ts `todayAnchorMs` / `scrollLeftForCenterMs`
   */
  const scrollToMs = useCallback(
    (ms: number, opts?: { instant?: boolean }) => {
      const el = scrollRef.current;
      const V = el ? Math.max(200, el.clientWidth - LABEL_W) : viewportPx;
      const instant = opts?.instant === true;
      const inWindow = ms >= timeline.startMs && ms < timeline.endMs;

      if (inWindow && el) {
        const to = scrollLeftForCenterMs(timeline, ms, V);
        if (Math.abs(el.scrollLeft - to) < 1) {
          return;
        }
        if (instant) {
          cancelScrollAnim();
          el.scrollLeft = to;
          scrollLeftRef.current = to;
          syncOverlayYRef.current(el.scrollTop);
          recomputeJumpSidesRef.current();
          return;
        }
        animateScrollLeft(el, to);
        return;
      }

      const oldCenter = el
        ? centerMsFromScroll(timeline, el.scrollLeft, V)
        : todayAnchorMs();
      const next = seedWindow(zoom, V, ms);
      const to = scrollLeftForCenterMs(next, ms, V);
      if (instant) {
        cancelScrollAnim();
        pendingScroll.current = { kind: "snap", left: to };
      } else {
        // Travel into the future → ease from the left of the new window; past → from right.
        suppressPanExtendRef.current = true;
        pendingScroll.current = {
          kind: "smooth",
          to,
          from: ms >= oldCenter ? "start" : "end",
        };
      }
      extendingRef.current = true;
      setTimeline(next);
    },
    [timeline, zoom, viewportPx, animateScrollLeft, cancelScrollAnim],
  );

  /** ↔ date-range.ts `todayAnchorMs` — same rail as the today line + refresh init. */
  const goToday = useCallback(() => {
    scrollToMs(todayAnchorMs());
  }, [scrollToMs]);

  /**
   * Center on today once after measure.
   * Reseed with measured V + pending snap in the next layout pass (React flushes that
   * before paint, so we do not flash scrollLeft=0). Do not set scrollLeft on a
   * visibility:hidden scroller — browsers may clamp it to 0.
   * ↔ goToday / date-range.ts `todayAnchorMs` / `scrollLeftForCenterMs`
   */
  useLayoutEffect(() => {
    if (didInitScroll.current || !didMeasureViewport.current) {
      return;
    }
    const el = scrollRef.current;
    if (!el || el.clientWidth <= 0) {
      return;
    }
    didInitScroll.current = true;
    const ms = todayAnchorMs();
    const V = Math.max(200, el.clientWidth - LABEL_W);
    const next = seedWindow(zoom, V, ms);
    pendingScroll.current = {
      kind: "snap",
      left: scrollLeftForCenterMs(next, ms, V),
    };
    setTimeline(next);
  }, [viewportPx, zoom]);

  const jumpToIssue = useCallback(
    (issue: Issue, _side: OffViewportSide) => {
      // Prefer start as the jump anchor (fallback to end for open-end bars).
      const raw = issue.startDate ?? issue.endDate;
      if (!raw) {
        return;
      }
      const target = parseIsoDate(raw);
      if (target === null) {
        return;
      }
      // End-only: land on the inclusive end day.
      const anchor =
        !issue.startDate && issue.endDate ? target + DAY_MS : target;
      scrollToMs(anchor);
      onSelect({
        kind: "issue",
        projectId: issue.projectId,
        issueId: issue.id,
      });
    },
    [scrollToMs, onSelect],
  );

  const changeZoom = useCallback(
    (nextZoom: ZoomLevel) => {
      if (nextZoom === zoom) {
        return;
      }
      const el = scrollRef.current;
      const V = el ? Math.max(200, el.clientWidth - LABEL_W) : viewportPx;
      const currentScroll = el?.scrollLeft ?? scrollLeftRef.current;
      const anchor = centerMsFromScroll(timeline, currentScroll, V);
      const next = reanchorWindow(nextZoom, V, anchor);
      pendingScroll.current = {
        kind: "snap",
        left: scrollLeftForCenterMs(next, anchor, V),
      };
      extendingRef.current = true;
      cancelScrollAnim();
      setZoom(nextZoom);
      writeRoadmapZoom(nextZoom);
      setTimeline(next);
    },
    [zoom, timeline, viewportPx, cancelScrollAnim],
  );

  const selectEntry = (entry: TreeNode) => {
    if (entry.kind === "project") {
      onSelect({ kind: "project", projectId: entry.projectId });
    } else if (entry.issueId !== undefined) {
      onSelect({
        kind: "issue",
        projectId: entry.projectId,
        issueId: entry.issueId,
      });
    }
  };

  const isSelected = (entry: TreeNode): boolean => {
    if (!selection) {
      return false;
    }
    if (selection.kind === "project" && entry.kind === "project") {
      return selection.projectId === entry.projectId;
    }
    if (selection.kind === "issue" && entry.kind === "issue") {
      return (
        selection.projectId === entry.projectId &&
        selection.issueId === entry.issueId
      );
    }
    return false;
  };

  const pxFromClientX = useCallback((clientX: number): number | null => {
    const rail = timelineRailRef.current;
    if (!rail) {
      return null;
    }
    return clientX - rail.getBoundingClientRect().left;
  }, []);

  const pyFromClientY = useCallback((clientY: number): number | null => {
    const rail = timelineRailRef.current;
    if (!rail) {
      return null;
    }
    return clientY - rail.getBoundingClientRect().top;
  }, []);

  const rowKeyFromClientY = useCallback((clientY: number): string | null => {
    const rail = timelineRailRef.current;
    if (!rail) {
      return null;
    }
    const y = clientY - rail.getBoundingClientRect().top;
    const idx = Math.floor(y / ROW_H);
    if (idx < 0 || idx >= rowsRef.current.length) {
      return null;
    }
    return rowsRef.current[idx]!.nodeKey;
  }, []);

  const onTimelineHoverMove = useCallback(
    (e: ReactMouseEvent) => {
      hoverClientXRef.current = e.clientX;
      hoverClientYRef.current = e.clientY;
      const modHeld = isSetDateModifier(e);
      setDateModHeld(modHeld);
      const px = pxFromClientX(e.clientX);
      if (px === null) {
        return;
      }
      const nextPx = Math.max(0, Math.min(timeline.totalWidthPx, px));
      applyHoverPointer(nextPx);

      const nextKey = rowKeyFromClientY(e.clientY);
      if (nextKey !== hoverRowKeyRef.current) {
        hoverRowKeyRef.current = nextKey;
        setHoverRowKey(nextKey);
      }

      // ⌘ ghost needs React only when the calendar day under the cursor changes.
      if (modHeld) {
        const tl = timelineRef.current;
        if (tl) {
          const dayIso = formatIsoDate(pxToMs(nextPx, tl));
          if (dayIso !== hoverGhostDayRef.current) {
            hoverGhostDayRef.current = dayIso;
            setHoverPx(nextPx);
          }
        }
      } else if (hoverGhostDayRef.current !== null) {
        hoverGhostDayRef.current = null;
        setHoverPx(null);
      }
    },
    [applyHoverPointer, pxFromClientX, rowKeyFromClientY, timeline.totalWidthPx],
  );

  const onTimelineHoverLeave = useCallback(() => {
    hoverClientXRef.current = null;
    hoverClientYRef.current = null;
    hoverRowKeyRef.current = null;
    hoverGhostDayRef.current = null;
    applyHoverPointer(null);
    setHoverPx(null);
    setHoverRowKey(null);
    setDateModHeld(false);
  }, [applyHoverPointer]);

  useEffect(() => {
    const syncMod = (e: KeyboardEvent) => {
      const held = isSetDateModifier(e);
      setDateModHeld(held);
      if (held && hoverPxRef.current !== null) {
        const tl = timelineRef.current;
        if (tl) {
          const dayIso = formatIsoDate(pxToMs(hoverPxRef.current, tl));
          hoverGhostDayRef.current = dayIso;
          setHoverPx(hoverPxRef.current);
        }
      } else if (!held) {
        hoverGhostDayRef.current = null;
        setHoverPx(null);
      }
    };
    const clearMod = () => {
      setDateModHeld(false);
      hoverGhostDayRef.current = null;
      setHoverPx(null);
    };
    window.addEventListener("keydown", syncMod);
    window.addEventListener("keyup", syncMod);
    window.addEventListener("blur", clearMod);
    return () => {
      window.removeEventListener("keydown", syncMod);
      window.removeEventListener("keyup", syncMod);
      window.removeEventListener("blur", clearMod);
    };
  }, []);

  const applyGhostDate = useCallback(
    async (
      projectId: string,
      issueId: string,
      ghost: GhostPreview,
      currentStart: string | null,
      currentEnd: string | null,
    ) => {
      const { startDate, endDate } = withOrderedDates(
        ghost.field,
        ghost.dateIso,
        currentStart,
        currentEnd,
      );
      try {
        await onPersistIssueDates(projectId, issueId, { startDate, endDate });
      } catch {
        // parent surfaces errors via workspace context when wired; ignore here
      }
    },
    [onPersistIssueDates],
  );

  const onTrackClick = (
    e: ReactMouseEvent,
    entry: TreeNode,
    issue: Issue | null,
  ) => {
    if (barDragMovedRef.current) {
      barDragMovedRef.current = false;
      return;
    }
    selectEntry(entry);
    // Plain click = select only. Date writes need ⌘/Ctrl+click (incl. empty→end).
    if (!isSetDateModifier(e)) {
      return;
    }
    if (
      entry.kind !== "issue" ||
      entry.issueId === undefined ||
      !issue ||
      hoverPxRef.current === null
    ) {
      return;
    }
    const clamped = Math.max(
      0,
      Math.min(timeline.totalWidthPx - 1, hoverPxRef.current),
    );
    const ghost = ghostPreviewForIssue(
      issue.startDate,
      issue.endDate,
      pxToMs(clamped, timeline),
      timeline,
    );
    if (!ghost) {
      return;
    }
    void applyGhostDate(
      entry.projectId,
      entry.issueId,
      ghost,
      issue.startDate,
      issue.endDate,
    );
  };

  const beginBarDrag = useCallback(
    (
      e: ReactPointerEvent,
      mode: BarDragMode,
      projectId: string,
      issueId: string,
      startDate: string | null,
      endDate: string | null,
    ) => {
      if (!startDate && !endDate) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const railPx = pxFromClientX(e.clientX);
      if (railPx === null) {
        return;
      }
      barDragMovedRef.current = false;
      const next: BarDragState = {
        projectId,
        issueId,
        mode,
        originStart: startDate,
        originEnd: endDate,
        originRailPx: railPx,
        dayDelta: 0,
        moved: false,
      };
      barDragRef.current = next;
      setBarDrag(next);
      setBarDragPointer({ clientX: e.clientX, clientY: e.clientY });
      setDateMenu(null);
    },
    [pxFromClientX],
  );

  const commitBarDrag = useCallback(async () => {
    const drag = barDragRef.current;
    barDragRef.current = null;
    setBarDrag(null);
    setBarDragPointer(null);
    if (!drag || !drag.moved || drag.dayDelta === 0) {
      return;
    }
    const { startDate, endDate } = applyBarDateDrag(
      drag.mode,
      drag.originStart,
      drag.originEnd,
      drag.dayDelta,
    );
    if (startDate === drag.originStart && endDate === drag.originEnd) {
      return;
    }
    try {
      await onPersistIssueDates(drag.projectId, drag.issueId, {
        startDate,
        endDate,
      });
    } catch {
      // parent surfaces errors via workspace context when wired; ignore here
    }
  }, [onPersistIssueDates]);

  const isBarDragging = barDrag !== null;

  useEffect(() => {
    if (!isBarDragging) {
      return;
    }
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const onMove = (e: PointerEvent) => {
      const drag = barDragRef.current;
      const tl = timelineRef.current;
      if (!drag || !tl) {
        return;
      }
      const railPx = pxFromClientX(e.clientX);
      if (railPx === null) {
        return;
      }
      const deltaPx = Math.abs(railPx - drag.originRailPx);
      const dayDelta = dayDeltaFromRailPx(
        drag.originRailPx,
        railPx,
        tl,
      );
      const moved = drag.moved || deltaPx >= 3 || dayDelta !== 0;
      if (dayDelta === drag.dayDelta && moved === drag.moved) {
        return;
      }
      if (moved) {
        barDragMovedRef.current = true;
      }
      const next = { ...drag, dayDelta, moved };
      barDragRef.current = next;
      setBarDrag(next);
      setBarDragPointer({ clientX: e.clientX, clientY: e.clientY });
    };
    const onUp = () => {
      void commitBarDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isBarDragging, pxFromClientX, commitBarDrag]);

  const beginLinkDrag = useCallback(
    (
      e: ReactPointerEvent,
      projectId: string,
      issueId: string,
      x1: number,
      y1: number,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const pointerX = pxFromClientX(e.clientX);
      const pointerY = pyFromClientY(e.clientY);
      if (pointerX === null || pointerY === null) {
        return;
      }
      const next: LinkDragState = {
        projectId,
        fromIssueId: issueId,
        x1,
        y1,
        pointerX,
        pointerY,
      };
      linkDragRef.current = next;
      setLinkDrag(next);
      setDateMenu(null);
    },
    [pxFromClientX, pyFromClientY],
  );

  const commitLinkDrag = useCallback(async () => {
    const drag = linkDragRef.current;
    linkDragRef.current = null;
    setLinkDrag(null);
    if (!drag) {
      return;
    }
    const hit = findLinkDropTarget(
      depAnchors,
      drag.fromIssueId,
      drag.pointerX,
      drag.pointerY,
      ROW_H,
    );
    if (!hit) {
      return;
    }
    const target = issues.find(
      (i) => i.projectId === drag.projectId && i.id === hit.id,
    );
    const source = issues.find(
      (i) => i.projectId === drag.projectId && i.id === drag.fromIssueId,
    );
    if (!target || !source) {
      setError("Dependencies must stay inside the same project.");
      return;
    }
    if (target.projectId !== source.projectId) {
      setError("Dependencies must stay inside the same project.");
      return;
    }
    if ((target.blockedBy ?? []).includes(source.id)) {
      return;
    }
    const next = [...new Set([...(target.blockedBy ?? []), source.id])];
    try {
      await onPersistIssueBlockedBy(target.projectId, target.id, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [depAnchors, issues, onPersistIssueBlockedBy, setError]);

  const removeDepEdge = useCallback(
    async (fromId: string, toId: string) => {
      const target = issues.find((i) => i.id === toId);
      const source = issues.find((i) => i.id === fromId);
      if (!target || !source || target.projectId !== source.projectId) {
        return;
      }
      if (
        !window.confirm(
          `Remove dependency?\n\n${source.title || "(untitled)"} → blocks → ${target.title || "(untitled)"}`,
        )
      ) {
        return;
      }
      const next = (target.blockedBy ?? []).filter((id) => id !== fromId);
      try {
        await onPersistIssueBlockedBy(target.projectId, target.id, next);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [issues, onPersistIssueBlockedBy, setError],
  );

  const isLinkDragging = linkDrag !== null;

  const linkPreviewEnd = useMemo(() => {
    if (!linkDrag) {
      return null;
    }
    const hit = findLinkDropTarget(
      depAnchors,
      linkDrag.fromIssueId,
      linkDrag.pointerX,
      linkDrag.pointerY,
      ROW_H,
    );
    if (hit) {
      const inbound = inboundLinkAnchor(hit, ROW_H);
      return { ...inbound, snapped: true, targetId: hit.id };
    }
    return {
      x: linkDrag.pointerX,
      y: linkDrag.pointerY,
      snapped: false,
      targetId: null,
    };
  }, [linkDrag, depAnchors]);

  useEffect(() => {
    if (!isLinkDragging) {
      return;
    }
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const onMove = (e: PointerEvent) => {
      const drag = linkDragRef.current;
      if (!drag) {
        return;
      }
      const pointerX = pxFromClientX(e.clientX);
      const pointerY = pyFromClientY(e.clientY);
      if (pointerX === null || pointerY === null) {
        return;
      }
      const next = { ...drag, pointerX, pointerY };
      linkDragRef.current = next;
      setLinkDrag(next);
    };
    const onUp = () => {
      void commitLinkDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isLinkDragging, pxFromClientX, pyFromClientY, commitLinkDrag]);

  const openDateMenu = useCallback(
    (e: ReactMouseEvent, entry: TreeNode) => {
      if (entry.kind !== "issue" || entry.issueId === undefined) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const px = pxFromClientX(e.clientX);
      if (px === null) {
        return;
      }
      const clamped = Math.max(0, Math.min(timeline.totalWidthPx - 1, px));
      const iso = formatIsoDate(pxToMs(clamped, timeline));
      setDateMenu({
        clientX: e.clientX,
        clientY: e.clientY,
        dateIso: iso,
        projectId: entry.projectId,
        issueId: entry.issueId,
      });
      onSelect({
        kind: "issue",
        projectId: entry.projectId,
        issueId: entry.issueId,
      });
    },
    [pxFromClientX, timeline, onSelect],
  );

  useEffect(() => {
    if (!dateMenu) {
      return;
    }
    // Escape + click-outside: DropdownMenu. Scroll on the timeline rail still closes.
    const onScrollClose = () => setDateMenu(null);
    scrollRef.current?.addEventListener("scroll", onScrollClose);
    return () => {
      scrollRef.current?.removeEventListener("scroll", onScrollClose);
    };
  }, [dateMenu]);

  const applyMenuDate = useCallback(
    async (field: "start" | "end") => {
      if (!dateMenu) {
        return;
      }
      const { projectId, issueId, dateIso } = dateMenu;
      const issue = issuesByKey.get(issueRefKey(projectId, issueId));
      if (!issue) {
        setDateMenu(null);
        return;
      }
      const flags = menuDateDisableFlags(
        dateIso,
        issue.startDate,
        issue.endDate,
      );
      if (field === "start" && flags.disableSetStart) {
        return;
      }
      if (field === "end" && flags.disableSetEnd) {
        return;
      }
      const { startDate, endDate } = withOrderedDates(
        field,
        dateIso,
        issue.startDate,
        issue.endDate,
      );
      setDateMenu(null);
      try {
        await onPersistIssueDates(projectId, issueId, { startDate, endDate });
      } catch {
        // parent surfaces errors via workspace context when wired; ignore here
      }
    },
    [dateMenu, issuesByKey, onPersistIssueDates],
  );

  const clearMenuDate = useCallback(
    async (field: "start" | "end") => {
      if (!dateMenu) {
        return;
      }
      const { projectId, issueId } = dateMenu;
      const issue = issuesByKey.get(issueRefKey(projectId, issueId));
      if (!issue) {
        setDateMenu(null);
        return;
      }
      if (field === "start" && !issue.startDate) {
        return;
      }
      if (field === "end" && !issue.endDate) {
        return;
      }
      setDateMenu(null);
      try {
        await onPersistIssueDates(
          projectId,
          issueId,
          field === "start" ? { startDate: null } : { endDate: null },
        );
      } catch {
        // parent surfaces errors via workspace context when wired; ignore here
      }
    },
    [dateMenu, issuesByKey, onPersistIssueDates],
  );

  const clearMenuDates = useCallback(async () => {
    if (!dateMenu) {
      return;
    }
    const { projectId, issueId } = dateMenu;
    const issue = issuesByKey.get(issueRefKey(projectId, issueId));
    if (!issue) {
      setDateMenu(null);
      return;
    }
    if (!issue.startDate && !issue.endDate) {
      return;
    }
    setDateMenu(null);
    try {
      await onPersistIssueDates(projectId, issueId, {
        startDate: null,
        endDate: null,
      });
    } catch {
      // parent surfaces errors via workspace context when wired; ignore here
    }
  }, [dateMenu, issuesByKey, onPersistIssueDates]);

  const menuIssue = dateMenu
    ? (issuesByKey.get(
        issueRefKey(dateMenu.projectId, dateMenu.issueId),
      ) ?? null)
    : null;
  const { disableSetStart, disableSetEnd } =
    dateMenu && menuIssue
      ? menuDateDisableFlags(
          dateMenu.dateIso,
          menuIssue.startDate,
          menuIssue.endDate,
        )
      : { disableSetStart: false, disableSetEnd: false };
  const canClearStart = Boolean(menuIssue?.startDate);
  const canClearEnd = Boolean(menuIssue?.endDate);
  const canClearDates = canClearStart || canClearEnd;

  const barDragPreview = barDrag
    ? applyBarDateDrag(
        barDrag.mode,
        barDrag.originStart,
        barDrag.originEnd,
        barDrag.dayDelta,
      )
    : null;
  const barDragLabel = barDragPreview
    ? formatScheduleRangeLabel(
        barDragPreview.startDate,
        barDragPreview.endDate,
      )
    : "";

  // Coarse header: group consecutive units with same coarseLabel
  const coarseBands = useMemo(() => {
    const bands: { key: string; label: string; widthPx: number }[] = [];
    for (const u of timeline.units) {
      const last = bands[bands.length - 1];
      if (last && last.label === u.coarseLabel) {
        last.widthPx += timeline.unitPx;
      } else {
        bands.push({
          key: `c-${u.key}`,
          label: u.coarseLabel,
          widthPx: timeline.unitPx,
        });
      }
    }
    return bands;
  }, [timeline]);

  return (
    <div className={styles.board}>
      <div className={styles.topChrome}>
        <TreeCollapseControls
          tree={tree}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          disabled={dragActiveId !== null}
        />
        <button type="button" className={styles.todayBtn} onClick={goToday}>
          Today
        </button>
      </div>

      <div className={styles.scrollShell}>
        <div
          ref={scrollRef}
          className={styles.scroll}
          onScroll={handleScroll}
        >
        <div
          className={styles.sheet}
          style={
            {
              "--label-w": `${LABEL_W}px`,
              "--unit-w": `${timeline.unitPx}px`,
              "--timeline-w": `${timeline.totalWidthPx}px`,
            } as CSSProperties
          }
        >
          <div className={styles.header}>
            <div className={styles.corner}>Issue</div>
            <div className={styles.rulerStack}>
              <div
                className={styles.coarseRow}
                style={{ width: timeline.totalWidthPx }}
              >
                {coarseBands.map((b) => (
                  <div
                    key={b.key}
                    className={styles.coarseCell}
                    style={{ width: b.widthPx }}
                  >
                    {b.label}
                  </div>
                ))}
              </div>
              <div
                className={`${styles.ruler}${timeline.zoom === "week" ? ` ${styles.rulerWeek}` : ""}`}
                style={{
                  width: timeline.totalWidthPx,
                  backgroundImage: unitBg,
                }}
              >
                {timeline.units.map((u) =>
                  timeline.zoom === "week" ? (
                    <div
                      key={u.key}
                      className={styles.weekCell}
                      style={{ width: timeline.unitPx }}
                    >
                      <div className={styles.weekLabel}>{u.label}</div>
                      <div className={styles.dayDigits}>
                        {Array.from({ length: 7 }, (_, i) => {
                          const day = new Date(
                            u.startMs + i * DAY_MS,
                          ).getUTCDate();
                          const isWeekend = i >= 5;
                          return (
                            <span
                              key={i}
                              className={
                                isWeekend
                                  ? styles.dayDigitWeekend
                                  : styles.dayDigit
                              }
                            >
                              {day}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={u.key}
                      className={styles.monthCell}
                      style={{ width: timeline.unitPx }}
                    >
                      {u.label}
                    </div>
                  ),
                )}
                {todayLeftPx !== null ? (
                  <div
                    className={styles.todayTick}
                    style={{ left: todayLeftPx }}
                    aria-hidden
                  >
                    <span className={styles.todayChip}>Today</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.body}>
            <div
              className={styles.labelRail}
              onPointerMove={(e) => {
                pointerY.current = e.clientY;
              }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                autoScroll={false}
                onDragStart={(e: DragStartEvent) => {
                  dragActiveIdRef.current = String(e.active.id);
                  lastScrollLeftDuringDragRef.current =
                    scrollRef.current?.scrollLeft ?? null;
                  setDragActiveId(String(e.active.id));
                }}
                onDragOver={(e: DragOverEvent) => {
                  if (!e.over) {
                    setDragOverId(null);
                    return;
                  }
                  const id = String(e.over.id);
                  setDragOverId(id);
                  const rect = e.over.rect;
                  setDragZone(
                    zoneFromOverTarget(
                      pointerY.current,
                      id,
                      rect ?? { top: 0, height: 0 },
                    ),
                  );
                }}
                onDragEnd={(e) => {
                  dragActiveIdRef.current = null;
                  lastScrollLeftDuringDragRef.current = null;
                  void handleLabelDragEnd(e);
                }}
                onDragCancel={() => {
                  dragActiveIdRef.current = null;
                  lastScrollLeftDuringDragRef.current = null;
                  restoreTempCollapse();
                  setDragActiveId(null);
                  setDragOverId(null);
                }}
              >
                <SortableContext
                  items={rowIds}
                  strategy={verticalListSortingStrategy}
                >
                  {rows.map(({ nodeKey, depth, entry, issue }) => {
                    const kids = tree.children[nodeKey] ?? [];
                    const hasKids = kids.length > 0;
                    const isCollapsed = collapsed.has(nodeKey);
                    const selected = isSelected(entry);
                    const inDropGroup = dropGroupKeys?.has(nodeKey) ?? false;
                    const rowDropLegal = inDropGroup ? dropLegal : null;
                    const twistLocked =
                      Boolean(dragActiveId) &&
                      (nodeKey === dragActiveId ||
                        (dropLegal === true && nodeKey === dragOverId));

                    return (
                      <RoadmapLabelRow
                        key={`label-${nodeKey}`}
                        nodeKey={nodeKey}
                        depth={depth}
                        entry={entry}
                        status={issue?.status}
                        priority={issue?.priority}
                        selected={selected}
                        hasKids={hasKids}
                        isCollapsed={isCollapsed}
                        inDropGroup={inDropGroup}
                        dropLegal={rowDropLegal}
                        twistLocked={twistLocked}
                        dropFlash={
                          dropFlash?.key === nodeKey
                            ? { kind: dropFlash.kind, token: dropFlash.token }
                            : null
                        }
                        onToggle={toggle}
                        onSelect={() => selectEntry(entry)}
                      />
                    );
                  })}
                </SortableContext>
                <DragOverlay>
                  {dragActiveId && tree.byId[dragActiveId] ? (
                    <div
                      className={`${styles.dragOverlay}${
                        dropLegal === true
                          ? ` ${styles.dragOverlayLegal}`
                          : dropLegal === false
                            ? ` ${styles.dragOverlayIllegal}`
                            : ""
                      }`}
                    >
                      {tree.byId[dragActiveId]!.title || "(untitled)"}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
              <div className={styles.sparsePad} aria-hidden />
            </div>

            <div
              ref={timelineRailRef}
              className={styles.timelineRail}
              style={{
                width: timeline.totalWidthPx,
                backgroundImage: unitBg,
              }}
              onMouseMove={onTimelineHoverMove}
              onMouseLeave={onTimelineHoverLeave}
            >
              {todayLeftPx !== null ? (
                <div
                  className={styles.todayLine}
                  style={{ left: todayLeftPx }}
                  aria-hidden
                />
              ) : null}
              {projectionBands.map((band) => (
                <div
                  key={`proj-${band.key}`}
                  className={styles.parentProjection}
                  style={
                    {
                      left: band.leftPx,
                      width: band.widthPx,
                      top: band.topPx,
                      height: band.heightPx,
                      "--parent-projection-color": issueStatusCssColor(
                        band.status,
                      ),
                    } as CSSProperties
                  }
                  aria-hidden
                />
              ))}
              <svg
                className={styles.depLayer}
                width={timeline.totalWidthPx}
                height={rows.length * ROW_H}
                aria-hidden
              >
                {depPaths.map((p) => (
                  <path
                    key={`${p.fromId}->${p.toId}`}
                    className={styles.depEdge}
                    d={p.d}
                    fill="none"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      void removeDepEdge(p.fromId, p.toId);
                    }}
                  />
                ))}
                {linkPreviewEnd ? (
                  <>
                    <path
                      className={styles.depEdgePreview}
                      d={outwardDepPath(
                        linkDrag!.x1,
                        linkDrag!.y1,
                        linkPreviewEnd.x,
                        linkPreviewEnd.y,
                      )}
                      fill="none"
                    />
                    {linkPreviewEnd.snapped ? (
                      <circle
                        className={styles.linkTargetDot}
                        cx={linkPreviewEnd.x}
                        cy={linkPreviewEnd.y}
                        r={5}
                      />
                    ) : null}
                  </>
                ) : null}
              </svg>
              <div
                ref={hoverPointerRef}
                className={styles.hoverPointer}
                style={{ display: "none", left: 0 }}
                aria-hidden
              >
                <span ref={hoverChipRef} className={styles.hoverChip} />
              </div>
              {rows.map(({ nodeKey, entry, issue }, rowIndex) => {
                const selected = isSelected(entry);
                const inDropGroup = dropGroupKeys?.has(nodeKey) ?? false;
                const groupClass = inDropGroup
                  ? dropLegal === true
                    ? ` ${styles.dropGroup} ${styles.dropGroupLegal}`
                    : dropLegal === false
                      ? ` ${styles.dropGroup} ${styles.dropGroupIllegal}`
                      : ` ${styles.dropGroup}`
                  : "";

                let displayStart = issue?.startDate ?? null;
                let displayEnd = issue?.endDate ?? null;
                const draggingThis =
                  barDrag !== null &&
                  entry.kind === "issue" &&
                  entry.issueId !== undefined &&
                  barDrag.projectId === entry.projectId &&
                  barDrag.issueId === entry.issueId;
                if (draggingThis && barDrag) {
                  const preview = applyBarDateDrag(
                    barDrag.mode,
                    barDrag.originStart,
                    barDrag.originEnd,
                    barDrag.dayDelta,
                  );
                  displayStart = preview.startDate;
                  displayEnd = preview.endDate;
                }

                const geo =
                  entry.kind === "issue" && issue
                    ? barGeometry(displayStart, displayEnd, timeline)
                    : null;
                const rowHovered = !barDrag && hoverRowKey === nodeKey;
                const ghost =
                  rowHovered &&
                  dateModHeld &&
                  entry.kind === "issue" &&
                  issue
                    ? ghostPreviewForIssue(
                        issue.startDate,
                        issue.endDate,
                        pxToMs(
                          Math.max(
                            0,
                            Math.min(timeline.totalWidthPx - 1, hoverPx),
                          ),
                          timeline,
                        ),
                        timeline,
                      )
                    : null;
                // Range ghost replaces the provisional open fade while previewing.
                const showBar =
                  geo && !(ghost && ghost.mode === "range") ? geo : null;
                const canDragBar = Boolean(
                  entry.kind === "issue" &&
                    entry.issueId !== undefined &&
                    issue &&
                    (issue.startDate || issue.endDate),
                );
                const canResizeBar = Boolean(
                  canDragBar && issue?.startDate && issue?.endDate,
                );

                return (
                  <div
                    key={`track-${nodeKey}`}
                    className={`${styles.trackRow}${entry.kind === "project" ? ` ${styles.projectRow}` : ""}${selected ? ` ${styles.rowSelected}` : ""}${ghost ? ` ${styles.trackRowSetDate}` : ""}${groupClass}`}
                    onClick={(e) => onTrackClick(e, entry, issue)}
                    onContextMenu={(e) => openDateMenu(e, entry)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectEntry(entry);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {showBar ? (
                      <div
                        className={`${styles.bar}${draggingThis ? ` ${styles.barDragging}` : ""}${canDragBar ? ` ${styles.barDraggable}` : ""}`}
                        style={{
                          left: showBar.leftPx,
                          width: showBar.widthPx,
                          ...barFillStyle(showBar.kind, issue?.status),
                        }}
                        title={
                          showBar.kind === "open-start"
                            ? `${displayStart ?? "?"} → ?`
                            : showBar.kind === "open-end"
                              ? `? → ${displayEnd ?? "?"}`
                              : `${displayStart ?? "?"} → ${displayEnd ?? "?"}`
                        }
                        onPointerDown={
                          canDragBar && entry.issueId !== undefined
                            ? (e) => {
                                selectEntry(entry);
                                beginBarDrag(
                                  e,
                                  "move",
                                  entry.projectId,
                                  entry.issueId!,
                                  issue!.startDate,
                                  issue!.endDate,
                                );
                              }
                            : undefined
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          selectEntry(entry);
                        }}
                      >
                        {canResizeBar && entry.issueId !== undefined ? (
                          <>
                            <span
                              className={`${styles.barHandle} ${styles.barHandleLeft}`}
                              onPointerDown={(e) => {
                                selectEntry(entry);
                                beginBarDrag(
                                  e,
                                  "resize-start",
                                  entry.projectId,
                                  entry.issueId!,
                                  issue!.startDate,
                                  issue!.endDate,
                                );
                              }}
                            />
                            <span
                              className={`${styles.barHandle} ${styles.barHandleRight}`}
                              onPointerDown={(e) => {
                                selectEntry(entry);
                                beginBarDrag(
                                  e,
                                  "resize-end",
                                  entry.projectId,
                                  entry.issueId!,
                                  issue!.startDate,
                                  issue!.endDate,
                                );
                              }}
                            />
                          </>
                        ) : null}
                        {canDragBar && entry.issueId !== undefined && showBar ? (
                          <span
                            className={styles.linkHandle}
                            title="Drag to another bar to add a dependency"
                            onPointerDown={(e) => {
                              selectEntry(entry);
                              beginLinkDrag(
                                e,
                                entry.projectId,
                                entry.issueId!,
                                showBar.leftPx + showBar.widthPx,
                                rowIndex * ROW_H + ROW_H / 2,
                              );
                            }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                    {ghost ? (
                      <div
                        className={`${styles.barGhost}${ghost.mode === "day" ? ` ${styles.barGhostDay}` : ""}`}
                        style={{
                          left: ghost.leftPx,
                          width: ghost.widthPx,
                        }}
                        title={
                          ghost.field === "start"
                            ? `${setDateChordLabel()} to set start ${ghost.dateIso}`
                            : `${setDateChordLabel()} to set end ${ghost.dateIso}`
                        }
                        aria-hidden
                      />
                    ) : null}
                  </div>
                );
              })}
              <div className={styles.sparsePad} aria-hidden />
            </div>
          </div>
        </div>
        </div>

        <div
          className={styles.jumpOverlay}
          style={{ left: LABEL_W, top: headerHeight(zoom) }}
          aria-hidden={Object.keys(jumpSides).length === 0}
        >
          <div ref={overlayInnerRef} className={styles.jumpOverlayInner}>
            {rows.map(({ nodeKey, issue }) => {
              const side = jumpSides[nodeKey];
              if (!side || !issue) {
                return (
                  <div
                    key={`jump-${nodeKey}`}
                    className={styles.jumpRow}
                    style={{ height: ROW_H }}
                  />
                );
              }
              return (
                <div
                  key={`jump-${nodeKey}`}
                  className={styles.jumpRow}
                  style={{ height: ROW_H }}
                >
                  <button
                    type="button"
                    className={
                      side === "left" ? styles.jumpLeft : styles.jumpRight
                    }
                    aria-label="Scroll to issue start"
                    onClick={() => jumpToIssue(issue, side)}
                  >
                    {side === "left" ? "←" : "→"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.zoomBar} role="group" aria-label="Timeline zoom">
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z}
            type="button"
            className={`${styles.zoomBtn}${zoom === z ? ` ${styles.zoomBtnActive}` : ""}`}
            onClick={() => changeZoom(z)}
          >
            {zoomLabel(z)}
          </button>
        ))}
      </div>

      <DropdownMenu
        open={!!dateMenu}
        onOpenChange={(open) => {
          if (!open) {
            setDateMenu(null);
          }
        }}
      >
        {dateMenu ? (
          <DropdownMenu.Content
            anchorPoint={{ x: dateMenu.clientX, y: dateMenu.clientY }}
            side="bottom"
            align="start"
          >
            <DropdownMenu.Label>{dateMenu.dateIso}</DropdownMenu.Label>
            <DropdownMenu.Group>
              <DropdownMenu.ItemButton
                label="Set start date"
                disabled={disableSetStart}
                onSelect={() => {
                  void applyMenuDate("start");
                }}
              />
              <DropdownMenu.ItemButton
                label="Clear start date"
                disabled={!canClearStart}
                onSelect={() => {
                  void clearMenuDate("start");
                }}
              />
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Group>
              <DropdownMenu.ItemButton
                label="Set end date"
                disabled={disableSetEnd}
                onSelect={() => {
                  void applyMenuDate("end");
                }}
              />
              <DropdownMenu.ItemButton
                label="Clear end date"
                disabled={!canClearEnd}
                onSelect={() => {
                  void clearMenuDate("end");
                }}
              />
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.ItemButton
              label="Clear dates"
              disabled={!canClearDates}
              onSelect={() => {
                void clearMenuDates();
              }}
            />
          </DropdownMenu.Content>
        ) : null}
      </DropdownMenu>

      {barDrag && barDragPointer && barDragLabel ? (
        <div
          className={styles.barDragTooltip}
          style={{
            left: barDragPointer.clientX,
            top: barDragPointer.clientY,
          }}
          role="status"
          aria-live="polite"
        >
          {barDragLabel}
        </div>
      ) : null}
    </div>
  );
}

function RoadmapLabelRow({
  nodeKey,
  depth,
  entry,
  status,
  priority,
  selected,
  hasKids,
  isCollapsed,
  inDropGroup,
  dropLegal,
  twistLocked,
  dropFlash,
  onToggle,
  onSelect,
}: {
  nodeKey: string;
  depth: number;
  entry: TreeNode;
  status?: IssueStatusId;
  priority?: IssuePriorityId;
  selected: boolean;
  hasKids: boolean;
  isCollapsed: boolean;
  inDropGroup: boolean;
  dropLegal: boolean | null;
  twistLocked: boolean;
  dropFlash: { kind: "ok" | "bad"; token: number } | null;
  onToggle: (key: string) => void;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: nodeKey,
    animateLayoutChanges: () => false,
  });

  const groupClass = inDropGroup
    ? dropLegal === true
      ? ` ${styles.dropGroup} ${styles.dropGroupLegal}`
      : dropLegal === false
        ? ` ${styles.dropGroup} ${styles.dropGroupIllegal}`
        : ` ${styles.dropGroup}`
    : "";

  const kindKey = issueKindKey(
    entry.kind === "project" ? "project" : "issue",
    entry.level,
  );
  const titleText = entry.title || "(untitled)";
  const statusText = status ? issueStatusLabel(status) : null;
  const priorityText = priority ? issuePriorityLabel(priority) : null;
  const ariaLabel = [`${kindKey}: ${titleText}`, priorityText, statusText]
    .filter(Boolean)
    .join(", ");

  const trailing =
    priority || status ? (
      <>
        {priority ? issuePriorityIcon(priority) : null}
        {status ? issueStatusIcon(status) : null}
      </>
    ) : undefined;

  return (
    <div
      ref={setNodeRef}
      data-dnd-key={nodeKey}
      className={`${styles.labelRow} ${treeRowStyles.rowHoverRoot}${entry.kind === "project" ? ` ${styles.projectRow}` : ""}${selected ? ` ${styles.rowSelected}` : ""}${groupClass}`}
      style={{
        paddingLeft: `${0.35 + depth * 0.9}rem`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: "relative",
      }}
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
        titleClassName={styles.title}
        trailing={trailing}
        className={styles.labelSelect}
        aria-label={ariaLabel}
        onClick={onSelect}
      />
    </div>
  );
}
