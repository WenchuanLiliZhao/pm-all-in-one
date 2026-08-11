/**
 * Dirty/save controller for AutosaveDoc hosts (Issue / Project / Workspace;
 * Wiki / Member when on this controller).
 * Not for ExplicitForm (custom props) / roadmap dates / view-order.
 *
 * Dirty is content-based (draft ≠ baseline), not a sticky onChange flag.
 * Debounced autosave via @pm-core/autosave-policy; explicit flush for blur /
 * Cmd+S / navigation / beforeunload.
 *
 * ↔ dogfood @wiki-n8_7zg25NlxwdV6nIBVcD — AutosaveDoc vs ExplicitForm
 * ↔ app/src/lib/workspace/active-save-host.ts — Cmd+S dispatch
 */

import {
  AUTOSAVE_IDLE_MS,
  AUTOSAVE_MAX_WAIT_MS,
  decideAutosave,
} from "@pm-core/autosave-policy";

export type DetailSaveStatus =
  | "clean"
  | "dirty"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

export type DetailSaveTarget =
  | { kind: "issue"; projectId: string; issueId: string }
  | { kind: "project"; projectId: string }
  | { kind: "workspace" }
  | { kind: "wiki"; wikiNodeId: string }
  | { kind: "member"; memberId: string }
  | { kind: "handoff"; handoffId: string };

export type PersistFn = (
  target: DetailSaveTarget,
  generation: number,
) => Promise<void>;

export type StatusListener = (
  status: DetailSaveStatus,
  errorMessage: string | null,
  conflictPaths: string[],
) => void;

export type TitleBlankFn = () => boolean;

export class DetailSaveController {
  private readonly persist: PersistFn;
  private readonly onStatus: StatusListener;
  private readonly getTitleIsBlank: TitleBlankFn;
  private generation = 0;
  private target: DetailSaveTarget | null = null;
  private status: DetailSaveStatus = "clean";
  private errorMessage: string | null = null;
  private conflictPaths: string[] = [];
  /** True when draft editable slice differs from baseline. */
  private contentDirty = false;
  private chain: Promise<boolean> = Promise.resolve(true);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastEditAt = 0;
  private firstDirtyAt: number | null = null;

  constructor(opts: {
    persist: PersistFn;
    onStatus: StatusListener;
    getTitleIsBlank: TitleBlankFn;
  }) {
    this.persist = opts.persist;
    this.onStatus = opts.onStatus;
    this.getTitleIsBlank = opts.getTitleIsBlank;
  }

  getStatus(): DetailSaveStatus {
    return this.status;
  }

  getErrorMessage(): string | null {
    return this.errorMessage;
  }

  getConflictPaths(): string[] {
    return this.conflictPaths;
  }

  getTarget(): DetailSaveTarget | null {
    return this.target;
  }

  getGeneration(): number {
    return this.generation;
  }

  /**
   * Local edits exist that are not confirmed on disk.
   * Error alone does not count — only contentDirty / saving / conflict.
   */
  hasUnsavedWork(): boolean {
    if (this.status === "saving") {
      return true;
    }
    if (this.status === "conflict") {
      return true;
    }
    return this.contentDirty;
  }

  /**
   * Recompute status from whether draft differs from baseline.
   * Bumps generation (cancels in-flight save) — for user edits.
   * Schedules debounced autosave when dirty.
   */
  setContentDirty(target: DetailSaveTarget, dirty: boolean): void {
    this.target = target;
    this.generation += 1;
    this.contentDirty = dirty;
    const now = Date.now();
    this.lastEditAt = now;
    if (dirty) {
      if (this.firstDirtyAt === null) {
        this.firstDirtyAt = now;
      }
    } else {
      this.firstDirtyAt = null;
    }
    if (this.conflictPaths.length > 0) {
      this.errorMessage = null;
      this.setStatus("conflict");
      this.clearTimer();
      return;
    }
    this.errorMessage = null;
    this.setStatus(dirty ? "dirty" : "clean");
    this.reschedule();
  }

  /**
   * Apply watcher merge result without cancelling an in-flight save.
   */
  applySyncState(
    target: DetailSaveTarget,
    dirty: boolean,
    conflicts: string[],
  ): void {
    this.target = target;
    this.contentDirty = dirty;
    this.conflictPaths = [...conflicts];
    if (dirty) {
      const now = Date.now();
      this.lastEditAt = now;
      if (this.firstDirtyAt === null) {
        this.firstDirtyAt = now;
      }
    } else {
      this.firstDirtyAt = null;
    }
    if (this.status === "saving") {
      // Let runPersist finish; it will re-read contentDirty after return.
      return;
    }
    this.errorMessage = null;
    if (conflicts.length > 0) {
      this.setStatus("conflict");
      this.clearTimer();
    } else {
      this.setStatus(dirty ? "dirty" : "clean");
      this.reschedule();
    }
  }

  /** @deprecated Prefer setContentDirty — kept for transitional call sites. */
  markDirty(target: DetailSaveTarget): void {
    this.setContentDirty(target, true);
  }

  setConflicts(paths: string[]): void {
    this.conflictPaths = [...paths];
    if (paths.length > 0) {
      this.errorMessage = null;
      this.setStatus("conflict");
      this.clearTimer();
    } else if (this.contentDirty) {
      this.setStatus("dirty");
      this.reschedule();
    } else if (this.status === "conflict") {
      this.setStatus("clean");
      this.clearTimer();
    }
  }

  clearConflicts(): void {
    this.setConflicts([]);
  }

  /**
   * Persist now for navigation / blur / beforeunload.
   * Holds (returns false, no write) on conflict or blank title.
   */
  flush(): Promise<boolean> {
    this.clearTimer();
    if (this.conflictPaths.length > 0 || this.status === "conflict") {
      return Promise.resolve(false);
    }
    if (this.getTitleIsBlank()) {
      return Promise.resolve(false);
    }
    if (!this.hasUnsavedWork()) {
      return Promise.resolve(true);
    }
    return this.enqueuePersist({ allowConflict: false });
  }

  /**
   * Explicit Save / Cmd+S / Retry — may overwrite conflict (human decision).
   * Blank title still fails inside persist with a thrown error → status error.
   */
  save(): Promise<boolean> {
    this.clearTimer();
    if (!this.hasUnsavedWork() && this.conflictPaths.length === 0) {
      return Promise.resolve(true);
    }
    return this.enqueuePersist({ allowConflict: true });
  }

  /**
   * After a successful save: baseline is updated by caller; mark clean.
   */
  markSaved(): void {
    this.contentDirty = false;
    this.conflictPaths = [];
    this.errorMessage = null;
    this.firstDirtyAt = null;
    this.clearTimer();
    this.setStatus("saved");
  }

  /**
   * Drop pending work (e.g. after discard reload or structural delete).
   * Caller is responsible for resetting draft/baseline in state.
   */
  resetClean(): void {
    this.target = null;
    this.generation += 1;
    this.contentDirty = false;
    this.conflictPaths = [];
    this.errorMessage = null;
    this.firstDirtyAt = null;
    this.clearTimer();
    this.setStatus("clean");
  }

  /**
   * Enter conflict state after StaleWriteError or three-way classify.
   */
  markConflict(paths: string[], message?: string): void {
    this.conflictPaths = [...paths];
    this.errorMessage = message ?? null;
    this.clearTimer();
    this.setStatus("conflict");
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private reschedule(): void {
    this.clearTimer();
    const decision = decideAutosave({
      status: this.status,
      contentDirty: this.contentDirty,
      hasConflict: this.conflictPaths.length > 0,
      titleIsBlank: this.getTitleIsBlank(),
      now: Date.now(),
      lastEditAt: this.lastEditAt,
      firstDirtyAt: this.firstDirtyAt,
      idleMs: AUTOSAVE_IDLE_MS,
      maxWaitMs: AUTOSAVE_MAX_WAIT_MS,
    });
    if (decision.kind === "wait") {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.reschedule();
      }, decision.afterMs);
      return;
    }
    if (decision.kind === "save") {
      void this.enqueuePersist({ allowConflict: false });
    }
  }

  private enqueuePersist(opts: {
    allowConflict: boolean;
  }): Promise<boolean> {
    this.chain = this.chain.then(
      () => this.runPersist(opts),
      () => this.runPersist(opts),
    );
    return this.chain;
  }

  private async runPersist(opts: {
    allowConflict: boolean;
  }): Promise<boolean> {
    if (
      (this.status === "clean" || this.status === "saved") &&
      !this.contentDirty &&
      this.conflictPaths.length === 0
    ) {
      return true;
    }
    if (!this.target) {
      return true;
    }
    if (
      !opts.allowConflict &&
      (this.conflictPaths.length > 0 || this.status === "conflict")
    ) {
      return false;
    }
    if (this.getTitleIsBlank()) {
      // Autosave / flush hold; explicit save still reaches persist and throws.
      if (!opts.allowConflict) {
        return false;
      }
    }

    const myGen = this.generation;
    const myTarget = this.target;
    this.clearTimer();
    this.setStatus("saving");

    try {
      await this.persist(myTarget, myGen);
      if (myGen !== this.generation) {
        this.reschedule();
        return true;
      }
      this.contentDirty = false;
      this.conflictPaths = [];
      this.errorMessage = null;
      this.firstDirtyAt = null;
      this.setStatus("saved");
      return true;
    } catch (e) {
      if (myGen !== this.generation) {
        this.reschedule();
        return false;
      }
      // Prefer structured stale-write (IPC-encoded or native).
      const stale =
        typeof e === "object" && e !== null
          ? (() => {
              try {
                const msg = e instanceof Error ? e.message : String(e);
                if (
                  msg.startsWith("stale-write:") ||
                  (msg.includes("changed on disk") &&
                    msg.includes("Reload or keep editing"))
                ) {
                  return true;
                }
                return (e as { code?: string }).code === "stale-write";
              } catch {
                return false;
              }
            })()
          : false;
      if (stale) {
        let paths: string[] = [];
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.startsWith("stale-write:")) {
          const rest = msg.slice("stale-write:".length);
          if (rest.startsWith("[")) {
            const end = rest.indexOf("]:");
            if (end >= 0) {
              try {
                paths = JSON.parse(rest.slice(0, end + 1)) as string[];
                this.errorMessage = rest.slice(end + 2);
              } catch {
                this.errorMessage = msg;
              }
            } else {
              this.errorMessage = msg;
            }
          } else {
            this.errorMessage = msg;
          }
        } else {
          this.errorMessage = msg;
          if (Array.isArray((e as { conflictPaths?: unknown }).conflictPaths)) {
            paths = (e as { conflictPaths: string[] }).conflictPaths;
          }
        }
        this.conflictPaths = paths;
        this.setStatus("conflict");
        return false;
      }
      this.errorMessage = e instanceof Error ? e.message : String(e);
      this.setStatus("error");
      return false;
    }
  }

  private setStatus(status: DetailSaveStatus): void {
    this.status = status;
    this.onStatus(status, this.errorMessage, this.conflictPaths);
  }
}

/** @deprecated Use DetailSaveController. */
export const DetailAutosaveController = DetailSaveController;

export function targetsEqual(
  a: DetailSaveTarget | null,
  b: DetailSaveTarget | null,
): boolean {
  if (!a || !b) {
    return a === b;
  }
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === "workspace" && b.kind === "workspace") {
    return true;
  }
  if (a.kind === "project" && b.kind === "project") {
    return a.projectId === b.projectId;
  }
  if (a.kind === "issue" && b.kind === "issue") {
    return a.projectId === b.projectId && a.issueId === b.issueId;
  }
  if (a.kind === "wiki" && b.kind === "wiki") {
    return a.wikiNodeId === b.wikiNodeId;
  }
  if (a.kind === "member" && b.kind === "member") {
    return a.memberId === b.memberId;
  }
  if (a.kind === "handoff" && b.kind === "handoff") {
    return a.handoffId === b.handoffId;
  }
  return false;
}
