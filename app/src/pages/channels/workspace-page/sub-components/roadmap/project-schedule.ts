/**
 * Frontend-only project span for the Roadmap bar. Not a project field.
 *
 * "Earliest" and "latest" are two different contests, not the ends of one sort:
 * - start candidate: the issue's start, or end − 7 days when it has no start
 * - end candidate: the issue's end, or start + 7 days when it has no end
 *
 * Project start is the minimum start candidate (the earliest issue's start,
 * with the week used only if that issue has no start). Project end is the
 * maximum end candidate. Those issues are often not the same one.
 *
 * The week is never applied to a side the issue already has, so a closed
 * span shorter than seven days does not pull the project outward. An inverted
 * start/end pair is ordered before either candidate is taken.
 */

import { DAY_MS, formatIsoDate, parseIsoDate } from "./date-range.ts";

/** Days substituted for a missing start or end on the winning issue. */
export const PROJECT_MISSING_SIDE_DAYS = 7;

export interface ProjectSchedule {
  startDate: string;
  endDate: string;
}

export interface ProjectScheduleIssue {
  projectId: string;
  id: string;
  startDate: string | null;
  endDate: string | null;
}

/** In-progress bar drag: replace one issue's dates before the span is taken. */
export interface ProjectSchedulePreview {
  projectId: string;
  issueId: string;
  startDate: string | null;
  endDate: string | null;
}

interface IssueDates {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
}

interface Candidates {
  startMs: number;
  endMs: number;
}

function candidatesForIssue(issue: IssueDates): Candidates | null {
  const startRaw = issue.startDate?.trim() || null;
  const endRaw = issue.endDate?.trim() || null;
  let startMs = startRaw ? parseIsoDate(startRaw) : null;
  let endMs = endRaw ? parseIsoDate(endRaw) : null;

  if (startMs !== null && endMs !== null) {
    if (endMs < startMs) {
      const orderedStart = endMs;
      endMs = startMs;
      startMs = orderedStart;
    }
    return { startMs, endMs };
  }
  if (startMs !== null) {
    return {
      startMs,
      endMs: startMs + PROJECT_MISSING_SIDE_DAYS * DAY_MS,
    };
  }
  if (endMs !== null) {
    return {
      startMs: endMs - PROJECT_MISSING_SIDE_DAYS * DAY_MS,
      endMs,
    };
  }
  return null;
}

/** Span of one project's issues. Null when none of them has a usable date. */
export function projectScheduleFromIssues(
  issues: readonly IssueDates[],
): ProjectSchedule | null {
  let startMs: number | null = null;
  let endMs: number | null = null;
  for (const issue of issues) {
    const candidates = candidatesForIssue(issue);
    if (!candidates) {
      continue;
    }
    if (startMs === null || candidates.startMs < startMs) {
      startMs = candidates.startMs;
    }
    if (endMs === null || candidates.endMs > endMs) {
      endMs = candidates.endMs;
    }
  }
  if (startMs === null || endMs === null) {
    return null;
  }
  return {
    startDate: formatIsoDate(startMs),
    endDate: formatIsoDate(endMs),
  };
}

/** One derived span per project. Issues in other projects do not leak across. */
export function projectSchedulesFromIssues(
  issues: readonly ProjectScheduleIssue[],
  preview: ProjectSchedulePreview | null = null,
): Map<string, ProjectSchedule> {
  const grouped = new Map<string, IssueDates[]>();
  for (const issue of issues) {
    const dates: IssueDates =
      preview &&
      issue.projectId === preview.projectId &&
      issue.id === preview.issueId
        ? { startDate: preview.startDate, endDate: preview.endDate }
        : { startDate: issue.startDate, endDate: issue.endDate };
    const bucket = grouped.get(issue.projectId);
    if (bucket) {
      bucket.push(dates);
    } else {
      grouped.set(issue.projectId, [dates]);
    }
  }

  const out = new Map<string, ProjectSchedule>();
  for (const [projectId, dated] of grouped) {
    const schedule = projectScheduleFromIssues(dated);
    if (schedule) {
      out.set(projectId, schedule);
    }
  }
  return out;
}
