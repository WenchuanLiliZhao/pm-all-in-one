import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
  /** Soft failure (e.g. fetch network error) while still returning counts. */
  error?: string;
}

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

async function isDirty(root: string): Promise<boolean> {
  const result = await runGit(
    root,
    ["status", "--porcelain"],
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
 * Fetch (best-effort) and report ahead/behind vs upstream.
 * Never throws — failures become `kind` / `error` fields.
 */
export async function getGitSyncStatus(
  workspaceRoot: string,
): Promise<GitSyncStatus> {
  if (!(await isInsideWorkTree(workspaceRoot))) {
    return { kind: "not-repo", behind: 0, ahead: 0, dirty: false };
  }

  const dirty = await isDirty(workspaceRoot);

  if (!(await hasUpstream(workspaceRoot))) {
    return { kind: "no-upstream", behind: 0, ahead: 0, dirty };
  }

  let error: string | undefined;
  const fetchResult = await runGit(
    workspaceRoot,
    ["fetch", "--quiet"],
    NETWORK_TIMEOUT_MS,
  );
  if (!fetchResult.ok) {
    error = fetchResult.message || "git fetch failed";
  }

  const behind = await revCount(workspaceRoot, "HEAD..@{upstream}");
  const ahead = await revCount(workspaceRoot, "@{upstream}..HEAD");

  return {
    kind: "ok",
    behind,
    ahead,
    dirty,
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
