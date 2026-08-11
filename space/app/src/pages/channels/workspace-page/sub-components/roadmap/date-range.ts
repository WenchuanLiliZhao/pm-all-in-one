/** Sliding virtual timeline window + zoom (Week / Month / Quarter). */

export type ZoomLevel = "week" | "month" | "quarter";

export const ZOOM_LEVELS: ZoomLevel[] = ["week", "month", "quarter"];

/** Equal column width per zoom (readable labels; ~90–160px band). */
export const ZOOM_UNIT_PX: Record<ZoomLevel, number> = {
  /** 22px/day × 7 — room for day ticks + day-of-month digits. */
  week: 154,
  month: 180,
  quarter: 160,
};

export const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export interface TimeUnit {
  key: string;
  /** Fine tick label (week day range / month abbr / Qn). */
  label: string;
  /** Coarse band label (MMM YYYY or YYYY). */
  coarseLabel: string;
  startMs: number;
  /** Exclusive end. */
  endMs: number;
}

export interface TimelineWindow {
  zoom: ZoomLevel;
  unitPx: number;
  units: TimeUnit[];
  startMs: number;
  endMs: number;
  totalWidthPx: number;
}

export interface BarGeometry {
  leftPx: number;
  widthPx: number;
  clippedStart: boolean;
  clippedEnd: boolean;
  kind: BarKind;
}

/** Open-ended fade span by zoom (Jira Timeline default-duration proxy). */
export const OPEN_SPAN_DAYS: Record<ZoomLevel, number> = {
  week: 7,
  month: 14,
  quarter: 30,
};

export type BarKind = "closed" | "open-start" | "open-end";

export interface ScheduleRange {
  startMs: number;
  /** Exclusive end (day after last inclusive day, UTC midnight). */
  endExclusiveMs: number;
  kind: BarKind;
}

/**
 * Resolve display schedule: closed range, or provisional open span for fade bars.
 */
export function resolveScheduleRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  zoom: ZoomLevel,
): ScheduleRange | null {
  const startRaw = startDate?.trim() || null;
  const endRaw = endDate?.trim() || null;
  if (!startRaw && !endRaw) {
    return null;
  }

  if (startRaw && endRaw) {
    let start = parseIsoDate(startRaw);
    let end = parseIsoDate(endRaw);
    if (start === null || end === null) {
      return null;
    }
    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }
    return {
      startMs: start,
      endExclusiveMs: end + DAY_MS,
      kind: "closed",
    };
  }

  const spanDays = OPEN_SPAN_DAYS[zoom];
  if (startRaw) {
    const start = parseIsoDate(startRaw);
    if (start === null) {
      return null;
    }
    return {
      startMs: start,
      endExclusiveMs: start + spanDays * DAY_MS,
      kind: "open-start",
    };
  }

  const end = parseIsoDate(endRaw!);
  if (end === null) {
    return null;
  }
  return {
    startMs: end - (spanDays - 1) * DAY_MS,
    endExclusiveMs: end + DAY_MS,
    kind: "open-end",
  };
}

export function parseIsoDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    return null;
  }
  return Date.UTC(y, mo - 1, d);
}

/** Floor `ms` to UTC calendar day → `YYYY-MM-DD`. */
export function formatIsoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** UTC midnight of the calendar day containing `ms`. */
export function dayStartUtc(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Canonical "today" rail for the roadmap — UTC day midpoint (noon).
 * ↔ index.tsx — today line (`todayLeftPx`), Today button, and refresh init must share this
 * (never mix with raw `Date.now()` or `unitStartUtc`, or the centered baseline drifts).
 */
export function todayAnchorMs(now: number = Date.now()): number {
  return dayStartUtc(now) + DAY_MS / 2;
}

/** Short label for hover pointer, e.g. `Thu Jul 24`. */
export function formatHoverDateLabel(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Schedule / drag tip date, e.g. `Thu Jul 24`. */
export function formatScheduleDateLabel(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** `Thu Jul 24 → Wed Jul 30`, with `?` for a missing side. Empty if both missing. */
export function formatScheduleRangeLabel(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  const startRaw = startDate?.trim() || null;
  const endRaw = endDate?.trim() || null;
  if (!startRaw && !endRaw) {
    return "";
  }
  const startMs = startRaw ? parseIsoDate(startRaw) : null;
  const endMs = endRaw ? parseIsoDate(endRaw) : null;
  const startLabel =
    startMs !== null ? formatScheduleDateLabel(startMs) : "?";
  const endLabel = endMs !== null ? formatScheduleDateLabel(endMs) : "?";
  return `${startLabel} → ${endLabel}`;
}

/** Monday 00:00 UTC of the week containing `ms`. */
export function weekStartUtc(ms: number): number {
  const d = new Date(ms);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset);
}

export function monthStartUtc(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function quarterStartUtc(ms: number): number {
  const d = new Date(ms);
  const q = Math.floor(d.getUTCMonth() / 3) * 3;
  return Date.UTC(d.getUTCFullYear(), q, 1);
}

export function unitStartUtc(zoom: ZoomLevel, ms: number): number {
  if (zoom === "week") {
    return weekStartUtc(ms);
  }
  if (zoom === "month") {
    return monthStartUtc(ms);
  }
  return quarterStartUtc(ms);
}

export function addUnitsUtc(zoom: ZoomLevel, startMs: number, delta: number): number {
  const d = new Date(unitStartUtc(zoom, startMs));
  if (zoom === "week") {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + delta * 7);
  }
  if (zoom === "month") {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1);
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta * 3, 1);
}

function unitEndUtc(zoom: ZoomLevel, startMs: number): number {
  return addUnitsUtc(zoom, startMs, 1);
}

function isoWeekNumber(ms: number): number {
  // ISO week: Thursday of this week determines the year/week
  const monday = weekStartUtc(ms);
  const thursday = monday + 3 * DAY_MS;
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return Math.floor((thursday - yearStart) / (7 * DAY_MS)) + 1;
}

function makeUnit(zoom: ZoomLevel, startMs: number): TimeUnit {
  const endMs = unitEndUtc(zoom, startMs);
  const d = new Date(startMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();

  if (zoom === "week") {
    const coarseLabel = `${MONTH_SHORT[month]} ${year}`;
    const key = `w-${year}-${String(month + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    return {
      key,
      // Day-of-month digits live in the header strip; keep week id only.
      label: `W${isoWeekNumber(startMs)}`,
      coarseLabel,
      startMs,
      endMs,
    };
  }

  if (zoom === "month") {
    return {
      key: `m-${year}-${String(month + 1).padStart(2, "0")}`,
      label: MONTH_SHORT[month],
      coarseLabel: String(year),
      startMs,
      endMs,
    };
  }

  const q = Math.floor(month / 3) + 1;
  return {
    key: `q-${year}-Q${q}`,
    label: `Q${q}`,
    coarseLabel: String(year),
    startMs,
    endMs,
  };
}

export function buildUnits(
  zoom: ZoomLevel,
  startMs: number,
  count: number,
): TimeUnit[] {
  const units: TimeUnit[] = [];
  let cur = unitStartUtc(zoom, startMs);
  for (let i = 0; i < count; i++) {
    units.push(makeUnit(zoom, cur));
    cur = addUnitsUtc(zoom, cur, 1);
  }
  return units;
}

function maxWindowUnits(zoom: ZoomLevel): number {
  if (zoom === "week") {
    return 200;
  }
  if (zoom === "month") {
    return 120;
  }
  return 80;
}

export function targetWindowUnitCount(
  zoom: ZoomLevel,
  viewportTimelinePx: number,
): number {
  const unitPx = ZOOM_UNIT_PX[zoom];
  const nVis = Math.max(1, Math.ceil(viewportTimelinePx / unitPx));
  const target = Math.round(7 * nVis);
  const min = nVis + 8;
  return Math.min(maxWindowUnits(zoom), Math.max(min, target));
}

function fromUnits(zoom: ZoomLevel, units: TimeUnit[]): TimelineWindow {
  const unitPx = ZOOM_UNIT_PX[zoom];
  const startMs = units[0]?.startMs ?? 0;
  const endMs = units[units.length - 1]?.endMs ?? startMs;
  return {
    zoom,
    unitPx,
    units,
    startMs,
    endMs,
    totalWidthPx: units.length * unitPx,
  };
}

/**
 * Seed a window whose middle *unit* contains `centerMs` (default: today anchor).
 * Does not put `centerMs` at the viewport center by itself — callers scroll with
 * `scrollLeftForCenterMs` (↔ index.tsx Today / init). Prefer scroll-only when the
 * date is already in-window; do not rebuild the window just to “re-center.”
 */
export function seedWindow(
  zoom: ZoomLevel,
  viewportTimelinePx: number,
  centerMs: number = todayAnchorMs(),
): TimelineWindow {
  const count = targetWindowUnitCount(zoom, viewportTimelinePx);
  const centerUnit = unitStartUtc(zoom, centerMs);
  const start = addUnitsUtc(zoom, centerUnit, -Math.floor(count / 2));
  return fromUnits(zoom, buildUnits(zoom, start, count));
}

export function extendWindowLeft(
  window: TimelineWindow,
  count: number,
): { window: TimelineWindow; deltaPx: number } {
  if (count <= 0) {
    return { window, deltaPx: 0 };
  }
  const zoom = window.zoom;
  const newStart = addUnitsUtc(zoom, window.startMs, -count);
  let units = [...buildUnits(zoom, newStart, count), ...window.units];
  const max = maxWindowUnits(zoom);
  if (units.length > max) {
    units = units.slice(0, max);
  }
  return { window: fromUnits(zoom, units), deltaPx: count * window.unitPx };
}

export function extendWindowRight(
  window: TimelineWindow,
  count: number,
): { window: TimelineWindow; trimmedLeftPx: number } {
  if (count <= 0) {
    return { window, trimmedLeftPx: 0 };
  }
  const zoom = window.zoom;
  const appendStart = window.endMs;
  let units = [...window.units, ...buildUnits(zoom, appendStart, count)];
  let trimmedLeftPx = 0;
  const max = maxWindowUnits(zoom);
  if (units.length > max) {
    const trim = units.length - max;
    units = units.slice(trim);
    trimmedLeftPx = trim * window.unitPx;
  }
  return { window: fromUnits(zoom, units), trimmedLeftPx };
}

/**
 * Map absolute date → px within the window using equal-width units
 * (linear within each unit by time fraction).
 */
export function msToPx(ms: number, window: TimelineWindow): number {
  if (window.units.length === 0) {
    return 0;
  }
  if (ms <= window.startMs) {
    return 0;
  }
  if (ms >= window.endMs) {
    return window.totalWidthPx;
  }
  for (let i = 0; i < window.units.length; i++) {
    const u = window.units[i];
    if (ms < u.endMs) {
      const span = u.endMs - u.startMs;
      const frac = span > 0 ? (ms - u.startMs) / span : 0;
      return i * window.unitPx + frac * window.unitPx;
    }
  }
  return window.totalWidthPx;
}

export function barGeometry(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  window: TimelineWindow,
): BarGeometry | null {
  const range = resolveScheduleRange(startDate, endDate, window.zoom);
  if (!range) {
    return null;
  }
  const { startMs: start, endExclusiveMs: endExclusive, kind } = range;

  const clippedStart = start < window.startMs;
  const clippedEnd = endExclusive > window.endMs;
  const clampedStart = Math.max(start, window.startMs);
  const clampedEnd = Math.min(endExclusive, window.endMs);
  if (clampedEnd <= clampedStart) {
    return null;
  }

  const leftPx = msToPx(clampedStart, window);
  let widthPx = msToPx(clampedEnd, window) - leftPx;
  if (widthPx < 8) {
    widthPx = 8;
  }

  return { leftPx, widthPx, clippedStart, clippedEnd, kind };
}

export type GhostPreviewMode = "day" | "range";

export interface GhostPreview {
  leftPx: number;
  widthPx: number;
  /** Which field a click would write. */
  field: "start" | "end";
  mode: GhostPreviewMode;
  /** ISO date written into `field` on click. */
  dateIso: string;
}

/**
 * Hover ghost for incomplete schedules (shown only while ⌘/Ctrl is held;
 * the matching track click writes the date):
 * - neither date → single-day start mark at cursor
 * - start only → closed range start→cursor (cursor must be ≥ start)
 * - end only → closed range cursor→end (cursor must be ≤ end)
 * - both → null (bar already closed; use context menu / bar drag)
 */
export function ghostPreviewForIssue(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  hoverMs: number,
  window: TimelineWindow,
): GhostPreview | null {
  const hoverIso = formatIsoDate(hoverMs);
  const hoverDay = parseIsoDate(hoverIso);
  if (hoverDay === null) {
    return null;
  }

  const startRaw = startDate?.trim() || null;
  const endRaw = endDate?.trim() || null;

  if (!startRaw && !endRaw) {
    const leftPx = msToPx(hoverDay, window);
    let widthPx = msToPx(hoverDay + DAY_MS, window) - leftPx;
    if (widthPx < 8) {
      widthPx = 8;
    }
    return {
      leftPx,
      widthPx,
      field: "start",
      mode: "day",
      dateIso: hoverIso,
    };
  }

  if (startRaw && !endRaw) {
    const startMs = parseIsoDate(startRaw);
    if (startMs === null || hoverDay < startMs) {
      return null;
    }
    const geo = barGeometry(startRaw, hoverIso, window);
    if (!geo) {
      return null;
    }
    return {
      leftPx: geo.leftPx,
      widthPx: geo.widthPx,
      field: "end",
      mode: "range",
      dateIso: hoverIso,
    };
  }

  if (!startRaw && endRaw) {
    const endMs = parseIsoDate(endRaw);
    if (endMs === null || hoverDay > endMs) {
      return null;
    }
    const geo = barGeometry(hoverIso, endRaw, window);
    if (!geo) {
      return null;
    }
    return {
      leftPx: geo.leftPx,
      widthPx: geo.widthPx,
      field: "start",
      mode: "range",
      dateIso: hoverIso,
    };
  }

  return null;
}

/** Shift a `YYYY-MM-DD` by whole UTC days. */
export function shiftIsoByDays(iso: string, days: number): string | null {
  const ms = parseIsoDate(iso);
  if (ms === null) {
    return null;
  }
  return formatIsoDate(ms + days * DAY_MS);
}

export type BarDragMode = "move" | "resize-start" | "resize-end";

/**
 * Apply a bar drag to origin dates (day-snapped).
 * - move: shift every known date by `dayDelta`
 * - resize-*: only for closed ranges; clamp so start ≤ end
 */
export function applyBarDateDrag(
  mode: BarDragMode,
  originStart: string | null,
  originEnd: string | null,
  dayDelta: number,
): { startDate: string | null; endDate: string | null } {
  if (dayDelta === 0) {
    return { startDate: originStart, endDate: originEnd };
  }

  if (mode === "move") {
    return {
      startDate: originStart ? shiftIsoByDays(originStart, dayDelta) : null,
      endDate: originEnd ? shiftIsoByDays(originEnd, dayDelta) : null,
    };
  }

  if (!originStart || !originEnd) {
    return { startDate: originStart, endDate: originEnd };
  }

  const startMs = parseIsoDate(originStart);
  const endMs = parseIsoDate(originEnd);
  if (startMs === null || endMs === null) {
    return { startDate: originStart, endDate: originEnd };
  }

  if (mode === "resize-start") {
    let nextStart = startMs + dayDelta * DAY_MS;
    if (nextStart > endMs) {
      nextStart = endMs;
    }
    return { startDate: formatIsoDate(nextStart), endDate: originEnd };
  }

  let nextEnd = endMs + dayDelta * DAY_MS;
  if (nextEnd < startMs) {
    nextEnd = startMs;
  }
  return { startDate: originStart, endDate: formatIsoDate(nextEnd) };
}

/**
 * Day delta between two pointer X positions on the timeline rail
 * (maps each X → calendar day, then subtracts).
 */
export function dayDeltaFromRailPx(
  originPx: number,
  currentPx: number,
  window: TimelineWindow,
): number {
  const clamp = (px: number) =>
    Math.max(0, Math.min(window.totalWidthPx - 1, px));
  const originDay = parseIsoDate(formatIsoDate(pxToMs(clamp(originPx), window)));
  const currentDay = parseIsoDate(
    formatIsoDate(pxToMs(clamp(currentPx), window)),
  );
  if (originDay === null || currentDay === null) {
    return 0;
  }
  return Math.round((currentDay - originDay) / DAY_MS);
}

export type OffViewportSide = "left" | "right";

/**
 * Fully off-viewport schedule → jump arrow side.
 * ← if issue ends before viewport; → if issue starts after viewport.
 * null if no dates or bar intersects the visible time range.
 * Open-ended issues use the same provisional span as barGeometry.
 */
export function offViewportSide(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  window: TimelineWindow,
  scrollLeft: number,
  viewportTimelinePx: number,
): OffViewportSide | null {
  const range = resolveScheduleRange(startDate, endDate, window.zoom);
  if (!range) {
    return null;
  }
  const { startMs: start, endExclusiveMs: endExclusive } = range;

  const viewStartMs = pxToMs(scrollLeft, window);
  const viewEndMs = pxToMs(scrollLeft + viewportTimelinePx, window);

  if (endExclusive <= viewStartMs) {
    return "left";
  }
  if (start >= viewEndMs) {
    return "right";
  }
  return null;
}

/** Date under horizontal center of the timeline viewport. */
export function centerMsFromScroll(
  window: TimelineWindow,
  scrollLeft: number,
  viewportTimelinePx: number,
): number {
  const midPx = scrollLeft + viewportTimelinePx / 2;
  return pxToMs(midPx, window);
}

export function pxToMs(px: number, window: TimelineWindow): number {
  if (window.units.length === 0) {
    return window.startMs;
  }
  if (px <= 0) {
    return window.startMs;
  }
  if (px >= window.totalWidthPx) {
    return window.endMs;
  }
  const i = Math.min(
    window.units.length - 1,
    Math.floor(px / window.unitPx),
  );
  const u = window.units[i];
  const frac = (px - i * window.unitPx) / window.unitPx;
  return u.startMs + frac * (u.endMs - u.startMs);
}

/**
 * scrollLeft so timeline-local `ms` sits at the timeline viewport center (clamped).
 * Contract: `scrollLeft` is on the sheet that includes the sticky label column;
 * `viewportTimelinePx` is `clientWidth - LABEL_W` (↔ index.tsx measure / scrollToMs).
 * Invariant: `centerMsFromScroll(w, scrollLeftForCenterMs(w, ms, V), V)` ≈ `ms`
 * when `ms` is interior and unclamped.
 */
export function scrollLeftForCenterMs(
  window: TimelineWindow,
  ms: number,
  viewportTimelinePx: number,
): number {
  const px = msToPx(ms, window);
  const maxScroll = Math.max(0, window.totalWidthPx - viewportTimelinePx);
  return Math.min(maxScroll, Math.max(0, px - viewportTimelinePx / 2));
}

/** Rebuild window around anchor date at a new zoom. */
export function reanchorWindow(
  zoom: ZoomLevel,
  viewportTimelinePx: number,
  anchorMs: number,
): TimelineWindow {
  return seedWindow(zoom, viewportTimelinePx, anchorMs);
}

/**
 * Layered CSS backgrounds for the timeline / ruler.
 * Week: light day ticks + soft Sat–Sun band + week edges.
 * Month/Quarter: unit edges only.
 * Colors stay as `var(--color-use--grid-*)` so theme switches apply without recompute.
 */
export function timelineGridBackground(
  zoom: ZoomLevel,
  unitPx: number,
): string {
  const unitLine = "var(--color-use--grid-line)";
  const dayLine = "var(--color-use--grid-line-soft)";
  const weekend = "var(--color-use--grid-weekend)";

  const unitEdges = `repeating-linear-gradient(
    to right,
    transparent 0,
    transparent ${unitPx - 1}px,
    ${unitLine} ${unitPx - 1}px,
    ${unitLine} ${unitPx}px
  )`;

  if (zoom !== "week") {
    return unitEdges;
  }

  const dayPx = unitPx / 7;
  const weekendStart = (5 / 7) * unitPx; // Mon-start → Sat–Sun

  const weekendBand = `repeating-linear-gradient(
    to right,
    transparent 0,
    transparent ${weekendStart}px,
    ${weekend} ${weekendStart}px,
    ${weekend} ${unitPx}px
  )`;

  const dayEdges = `repeating-linear-gradient(
    to right,
    transparent 0,
    transparent ${dayPx - 1}px,
    ${dayLine} ${dayPx - 1}px,
    ${dayLine} ${dayPx}px
  )`;

  // Paint order: weekend under day ticks under week edges
  return `${weekendBand}, ${dayEdges}, ${unitEdges}`;
}
