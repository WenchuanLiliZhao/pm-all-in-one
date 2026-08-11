/**
 * Pure geometry for Roadmap hard-dependency curves.
 * Edge semantics: blocker → blocked (blocked.blockedBy includes blocker).
 *
 * Paths leave the source on its **outside** (right of the bar end) and enter
 * the target on its **outside** (left of the bar start), then fold back in —
 * so overlapping / reverse-time bars loop around instead of cutting through.
 */

export interface DepBarAnchor {
  /** Issue id within a project. */
  id: string;
  /** Visible row index in the timeline rail (0-based). */
  rowIndex: number;
  leftPx: number;
  widthPx: number;
}

export interface DepEdgeInput {
  fromId: string;
  toId: string;
}

export interface DepEdgePath {
  fromId: string;
  toId: string;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Debug / tune dependency edge geometry here (single place).
 *
 * Absolute **screen pixels** — never scaled by zoom / unitPx / day width.
 *
 * - `outwardStubPx` — how far past each bar endpoint before the line turns
 * - `turnCurvature` — 0..1 elbow softness (0 = flatter exit/entry on row Y;
 *   1 = control points pull toward mid-row Y → rounder S)
 */
export const DEP_EDGE_TOKENS = {
  outwardStubPx: 48,
  turnCurvature: 0.35,
} as const;

/** @deprecated Use `DEP_EDGE_TOKENS.outwardStubPx`. */
export const DEP_OUTWARD_STUB_PX = DEP_EDGE_TOKENS.outwardStubPx;

export function rowCenterY(rowIndex: number, rowH: number): number {
  return rowIndex * rowH + rowH / 2;
}

/** Blocker bar: dependency leaves the right edge (outside). */
export function outboundLinkAnchor(
  anchor: DepBarAnchor,
  rowH: number,
): { x: number; y: number } {
  return {
    x: anchor.leftPx + anchor.widthPx,
    y: rowCenterY(anchor.rowIndex, rowH),
  };
}

/** Blocked bar: dependency enters the left edge (outside). */
export function inboundLinkAnchor(
  anchor: DepBarAnchor,
  rowH: number,
): { x: number; y: number } {
  return {
    x: anchor.leftPx,
    y: rowCenterY(anchor.rowIndex, rowH),
  };
}

/** Hit-test pointer over a drawable bar (not the source issue). */
export function findLinkDropTarget(
  anchors: readonly DepBarAnchor[],
  fromIssueId: string,
  pointerX: number,
  pointerY: number,
  rowH: number,
  hitPadX = 4,
): DepBarAnchor | null {
  for (const a of anchors) {
    if (a.id === fromIssueId) {
      continue;
    }
    const top = a.rowIndex * rowH;
    const bottom = top + rowH;
    const left = a.leftPx - hitPadX;
    const right = a.leftPx + a.widthPx + hitPadX;
    if (
      pointerX >= left &&
      pointerX <= right &&
      pointerY >= top &&
      pointerY <= bottom
    ) {
      return a;
    }
  }
  return null;
}

function clamp01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/**
 * Cubic from (x1,y1) → (x2,y2) that first heads outward on each side, then
 * folds back. Reads stub + curvature from `DEP_EDGE_TOKENS` unless overridden.
 */
export function outwardDepPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tokens: {
    outwardStubPx?: number;
    turnCurvature?: number;
  } = DEP_EDGE_TOKENS,
): string {
  const stub = Math.max(8, tokens.outwardStubPx ?? DEP_EDGE_TOKENS.outwardStubPx);
  const k = clamp01(tokens.turnCurvature ?? DEP_EDGE_TOKENS.turnCurvature);
  const c1x = x1 + stub;
  const c2x = x2 - stub;
  const midY = (y1 + y2) / 2;
  const c1y = y1 + (midY - y1) * k;
  const c2y = y2 + (midY - y2) * k;
  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

/** Alias — rubber-band preview uses the same outward path. */
export function cubicDepPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  return outwardDepPath(x1, y1, x2, y2);
}

/**
 * Build SVG path specs for visible dependency edges.
 * Skips edges whose endpoints lack a bar anchor (undated / collapsed / off-board).
 */
export function layoutDepEdges(
  anchors: readonly DepBarAnchor[],
  edges: readonly DepEdgeInput[],
  rowH: number,
  tokens: {
    outwardStubPx?: number;
    turnCurvature?: number;
  } = DEP_EDGE_TOKENS,
): DepEdgePath[] {
  const byId = new Map<string, DepBarAnchor>();
  for (const a of anchors) {
    byId.set(a.id, a);
  }
  const out: DepEdgePath[] = [];
  for (const e of edges) {
    const from = byId.get(e.fromId);
    const to = byId.get(e.toId);
    if (!from || !to) {
      continue;
    }
    const x1 = from.leftPx + from.widthPx;
    const y1 = rowCenterY(from.rowIndex, rowH);
    const x2 = to.leftPx;
    const y2 = rowCenterY(to.rowIndex, rowH);
    out.push({
      fromId: e.fromId,
      toId: e.toId,
      d: outwardDepPath(x1, y1, x2, y2, tokens),
      x1,
      y1,
      x2,
      y2,
    });
  }
  return out;
}

/** Collect blocker→blocked edges from issue.blockedBy lists (same-project ids). */
export function collectBlockedByEdges(
  issues: readonly { id: string; blockedBy: readonly string[] }[],
): DepEdgeInput[] {
  const out: DepEdgeInput[] = [];
  for (const issue of issues) {
    for (const blocker of issue.blockedBy) {
      out.push({ fromId: blocker, toId: issue.id });
    }
  }
  return out;
}
