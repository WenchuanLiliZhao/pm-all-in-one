/**
 * Pure autosave policy for detail doc hosts (Home / Issue / Project).
 * No timers, no React, no src/ imports — decisions only.
 *
 * Timer lives in src/lib/workspace/detail-save.ts.
 * ↔ src/lib/workspace/detail-save.ts — schedules decideAutosave
 */

export type DetailSaveStatusLike =
  | "clean"
  | "dirty"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

export type AutosaveInput = {
  status: DetailSaveStatusLike;
  contentDirty: boolean;
  hasConflict: boolean;
  titleIsBlank: boolean;
  now: number;
  lastEditAt: number;
  firstDirtyAt: number | null;
  idleMs: number;
  maxWaitMs: number;
};

export type AutosaveDecision =
  | { kind: "idle" }
  | { kind: "hold"; reason: "blank-title" | "conflict" | "saving" | "error" }
  | { kind: "wait"; afterMs: number }
  | { kind: "save" };

export const AUTOSAVE_IDLE_MS = 800;
export const AUTOSAVE_MAX_WAIT_MS = 5000;

/**
 * Decide whether to idle, hold, wait, or save.
 * Caller owns timers; this function is side-effect free.
 */
export function decideAutosave(input: AutosaveInput): AutosaveDecision {
  if (input.hasConflict || input.status === "conflict") {
    return { kind: "hold", reason: "conflict" };
  }
  if (input.status === "saving") {
    return { kind: "hold", reason: "saving" };
  }
  if (input.status === "error") {
    // No auto-retry after non-conflict error — wait for next edit or flush.
    return { kind: "hold", reason: "error" };
  }
  if (!input.contentDirty) {
    return { kind: "idle" };
  }
  if (input.titleIsBlank) {
    return { kind: "hold", reason: "blank-title" };
  }

  const idleElapsed = input.now - input.lastEditAt;
  if (idleElapsed >= input.idleMs) {
    return { kind: "save" };
  }

  if (input.firstDirtyAt !== null) {
    const sinceFirst = input.now - input.firstDirtyAt;
    if (sinceFirst >= input.maxWaitMs) {
      return { kind: "save" };
    }
  }

  const untilIdle = input.idleMs - idleElapsed;
  let untilMax = Number.POSITIVE_INFINITY;
  if (input.firstDirtyAt !== null) {
    untilMax = input.maxWaitMs - (input.now - input.firstDirtyAt);
  }
  const afterMs = Math.max(1, Math.min(untilIdle, untilMax));
  return { kind: "wait", afterMs };
}
