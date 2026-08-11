import { barGeometry, type TimelineWindow } from "./date-range";
import type { IssueStatusId } from "@/lib/issue-status";

/**
 * Y inset into the parent row where the projection band starts.
 * Must match `.bar` chrome: `top: 8px` + `height: 20px` → bottom at 28px.
 */
export const PARENT_PROJECTION_INSET_Y = 28;

export type ProjectionBand = {
  /** Parent nodeKey */
  key: string;
  leftPx: number;
  widthPx: number;
  topPx: number;
  heightPx: number;
  /** Parent issue status — drives band tint (same palette as bars). */
  status: IssueStatusId | undefined;
};

export type ProjectionRowInput = {
  nodeKey: string;
  depth: number;
  /** Resolved display dates (include bar-drag preview when applicable). */
  startDate: string | null;
  endDate: string | null;
  status: IssueStatusId | undefined;
};

/**
 * For each expanded parent with a schedule and visible descendants, emit a
 * continuous band from under the parent bar through the last descendant row.
 */
export function collectParentProjectionBands(
  rows: readonly ProjectionRowInput[],
  timeline: TimelineWindow,
  rowH: number,
  insetY: number = PARENT_PROJECTION_INSET_Y,
): ProjectionBand[] {
  const bands: ProjectionBand[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parent = rows[i]!;
    let lastDesc = -1;
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j]!.depth <= parent.depth) {
        break;
      }
      lastDesc = j;
    }
    if (lastDesc < 0) {
      continue;
    }

    const geo = barGeometry(parent.startDate, parent.endDate, timeline);
    if (!geo) {
      continue;
    }

    const topPx = i * rowH + insetY;
    const heightPx = (lastDesc + 1) * rowH - topPx;
    if (heightPx <= 0) {
      continue;
    }

    bands.push({
      key: parent.nodeKey,
      leftPx: geo.leftPx,
      widthPx: geo.widthPx,
      topPx,
      heightPx,
      status: parent.status,
    });
  }

  return bands;
}
