/**
 * Desktop git status / FF pull via shell-out.
 *
 * ↔ git-changes.ts — unsynced node aggregation (local only)
 * ↔ electron/main.ts — IPC getGitSyncStatus / pullWorkspace
 * ↔ src/lib/bridge/pm-api.ts — PmApi contract
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { nowIsoUtcZ } from "../infra/timestamps.js";

const execFileAsync = promisify(execFile);

/** Quick local checks (rev-parse, status, rev-list). */
const QUICK_TIMEOUT_MS = 5_000;
/** Network-facing fetch / pull. */
const NETWORK_TIMEOUT_MS = 60_000;

export type GitSyncStatusKind = "not-repo" | "no-upstream" | "ok";

export interface GitSyncStatus {
  kind: GitSyncStatusKind;
  behind: number;
  ahead: number;
  dirty: boolean;
  /** ISO-8601 UTC …Z — when this status was computed. */
  checkedAt: string;
  /**
   * Whether this call actually ran `git fetch`.
   * False when `fetch: false` was requested, or when fetch failed / was skipped.
   */
  fetched: boolean;
  /** Soft failure (e.g. fetch network error) while still returning counts. */
  error?: string;
}

export type GitSyncStatusOptions = {
  /** Default true. When false, skip network fetch (local rev-list / status only). */
  fetch?: boolean;
};

export type GitPullFailReason =
  | "dirty"
  | "not-ff"
  | "no-upstream"
  | "not-repo"
  | "git-error";

export type GitPullResult =
  | { ok: true }
  | { ok: false; reason: GitPullFailReason; message: string };

type GitRunOk = { ok: true; stdout: string; stderr: string };
type GitRunFail = {
  ok: false;
  stdout: string;
  stderr: string;
  message: string;
  code: number | null;
};

async function runGit(
  cwd: string,
  args: string[],
  timeoutMs: number,
): Promise<GitRunOk | GitRunFail> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      timeout: timeoutMs,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      ok: true,
      stdout: typeof stdout === "string" ? stdout : "",
      stderr: typeof stderr === "string" ? stderr : "",
    };
  } catch (err: unknown) {
    const e = err as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
      code?: number | string | null;
    };
    const stdout =
      typeof e.stdout === "string"
        ? e.stdout
        : Buffer.isBuffer(e.stdout)
          ? e.stdout.toString("utf8")
          : "";
    const stderr =
      typeof e.stderr === "string"
        ? e.stderr
        : Buffer.isBuffer(e.stderr)
          ? e.stderr.toString("utf8")
          : "";
    const code =
      typeof e.code === "number"
        ? e.code
        : typeof e.code === "string" && /^\d+$/.test(e.code)
          ? Number(e.code)
          : null;
    return {
      ok: false,
      stdout,
      stderr,
      message: (stderr || stdout || e.message || "git failed").trim(),
      code,
    };
  }
}

async function isInsideWorkTree(root: string): Promise<boolean> {
  const result = await runGit(
    root,
    ["rev-parse", "--is-inside-work-tree"],
    QUICK_TIMEOUT_MS,
  );
  return result.ok && result.stdout.trim() === "true";
}

async function hasUpstream(root: string): Promise<boolean> {
  const result = await runGit(
    root,
    ["rev-parse", "--abbrev-ref", "@{upstream}"],
    QUICK_TIMEOUT_MS,
  );
  return result.ok && result.stdout.trim().length > 0;
}

/**
 * Dirty scoped to the workspace root (cwd).
 * `-uall` so untracked node directories list files, not just the directory name.
 */
async function isDirty(root: string): Promise<boolean> {
  const result = await runGit(
    root,
    ["status", "--porcelain", "-uall", "--", "."],
    QUICK_TIMEOUT_MS,
  );
  if (!result.ok) {
    return false;
  }
  return result.stdout.trim().length > 0;
}

async function revCount(root: string, range: string): Promise<number> {
  const result = await runGit(
    root,
    ["rev-list", "--count", range],
    QUICK_TIMEOUT_MS,
  );
  if (!result.ok) {
    return 0;
  }
  const n = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Report ahead/behind vs upstream. Optionally fetch first.
 * Never throws — failures become `kind` / `error` fields.
 */
export async function getGitSyncStatus(
  workspaceRoot: string,
  options?: GitSyncStatusOptions,
): Promise<GitSyncStatus> {
  const checkedAt = nowIsoUtcZ();
  const doFetch = options?.fetch !== false;

  if (!(await isInsideWorkTree(workspaceRoot))) {
    return {
      kind: "not-repo",
      behind: 0,
      ahead: 0,
      dirty: false,
      checkedAt,
      fetched: false,
    };
  }

  const dirty = await isDirty(workspaceRoot);

  if (!(await hasUpstream(workspaceRoot))) {
    return {
      kind: "no-upstream",
      behind: 0,
      ahead: 0,
      dirty,
      checkedAt,
      fetched: false,
    };
  }

  let error: string | undefined;
  let fetched = false;
  if (doFetch) {
    const fetchResult = await runGit(
      workspaceRoot,
      ["fetch", "--quiet"],
      NETWORK_TIMEOUT_MS,
    );
    if (fetchResult.ok) {
      fetched = true;
    } else {
      error = fetchResult.message || "git fetch failed";
      fetched = false;
    }
  }

  const behind = await revCount(workspaceRoot, "HEAD..@{upstream}");
  const ahead = await revCount(workspaceRoot, "@{upstream}..HEAD");

  return {
    kind: "ok",
    behind,
    ahead,
    dirty,
    checkedAt,
    fetched,
    ...(error ? { error } : {}),
  };
}

/**
 * Fast-forward only pull. Refuses dirty trees. Never throws.
 */
export async function pullFastForward(
  workspaceRoot: string,
): Promise<GitPullResult> {
  if (!(await isInsideWorkTree(workspaceRoot))) {
    return {
      ok: false,
      reason: "not-repo",
      message: "This workspace is not a git repository.",
    };
  }

  if (await isDirty(workspaceRoot)) {
    return {
      ok: false,
      reason: "dirty",
      message:
        "Uncommitted changes — commit or stash in a terminal, then Sync.",
    };
  }

  if (!(await hasUpstream(workspaceRoot))) {
    return {
      ok: false,
      reason: "no-upstream",
      message: "No upstream branch is configured for this workspace.",
    };
  }

  const result = await runGit(
    workspaceRoot,
    ["pull", "--ff-only"],
    NETWORK_TIMEOUT_MS,
  );

  if (result.ok) {
    return { ok: true };
  }

  const combined = `${result.stderr}\n${result.stdout}\n${result.message}`.toLowerCase();
  if (
    combined.includes("not possible to fast-forward") ||
    combined.includes("diverging branches") ||
    combined.includes("cannot fast-forward") ||
    combined.includes("refusing to merge unrelated histories")
  ) {
    return {
      ok: false,
      reason: "not-ff",
      message: "Cannot fast-forward — resolve in a terminal.",
    };
  }

  return {
    ok: false,
    reason: "git-error",
    message: result.message || "git pull --ff-only failed",
  };
}
