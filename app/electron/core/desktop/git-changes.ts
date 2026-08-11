/**
 * Unsynced workspace changes aggregated by node (local git only — no fetch).
 *
 * ↔ git-sync.ts — shared status / dirty law
 * ↔ electron/main.ts — IPC getUnsyncedChanges
 * ↔ src/lib/bridge/pm-api.ts — PmApi contract
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { parseId } from "../identity/dir-id.js";
import type { NodeRef } from "../domain/node-assets.js";
import { evaluatePropsExport } from "../infra/props-load.js";
import { stripTimestampKeys } from "../infra/timestamps.js";

const execFileAsync = promisify(execFile);
const QUICK_TIMEOUT_MS = 5_000;

export type UnsyncedChangesKind = "not-repo" | "no-upstream" | "ok";

export type UnsyncedNodeState = "uncommitted" | "unpushed" | "both";

export interface UnsyncedNodeChange {
  ref: NodeRef;
  propsChanged: boolean;
  bodyChanged: boolean;
  /** Paths under the node that are neither props nor body (e.g. assets/). */
  otherPaths: string[];
  state: UnsyncedNodeState;
}

export interface UnsyncedChanges {
  kind: UnsyncedChangesKind;
  nodes: UnsyncedNodeChange[];
  /** Paths that do not map to a node (.pm/, custom-props.ts, etc.). */
  otherFiles: string[];
  error?: string;
}

type GitRunOk = { ok: true; stdout: string };
type GitRunFail = { ok: false; message: string };

async function runGit(
  cwd: string,
  args: string[],
): Promise<GitRunOk | GitRunFail> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      timeout: QUICK_TIMEOUT_MS,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout: typeof stdout === "string" ? stdout : "" };
  } catch (err: unknown) {
    const e = err as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const stderr =
      typeof e.stderr === "string"
        ? e.stderr
        : Buffer.isBuffer(e.stderr)
          ? e.stderr.toString("utf8")
          : "";
    const stdout =
      typeof e.stdout === "string"
        ? e.stdout
        : Buffer.isBuffer(e.stdout)
          ? e.stdout.toString("utf8")
          : "";
    return {
      ok: false,
      message: (stderr || stdout || e.message || "git failed").trim(),
    };
  }
}

function normalizeRel(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Inverse of resolveNodeDir path layout — map a workspace-relative path to a NodeRef.
 * Returns null when the path is not owned by a single node.
 */
export function nodeRefFromRelPath(relPath: string): NodeRef | null {
  const rel = normalizeRel(relPath);
  if (!rel || rel === ".") {
    return null;
  }

  const parts = rel.split("/").filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  // Workspace root files
  if (parts.length === 1) {
    const name = parts[0]!;
    if (name === "workspace.ts" || name === "README.md") {
      return { kind: "workspace" };
    }
    return null;
  }

  if (parts[0] === "issue-hierarchy") {
    if (parts.length < 2) {
      return null;
    }
    const projectId = parseId(parts[1]!);
    if (!projectId) {
      return null;
    }
    if (parts.length === 2) {
      // Bare project dir (unusual in path lists) — treat as project
      return { kind: "project", projectId };
    }
    const third = parts[2]!;
    // Project-level files (not an issue id)
    if (
      third === "project.ts" ||
      third === "README.md" ||
      third === "custom-props.ts" ||
      third === "schema.d.ts" ||
      third === "assets"
    ) {
      if (third === "custom-props.ts" || third === "schema.d.ts") {
        // Declared as not-a-node in product law — otherFiles
        return null;
      }
      return { kind: "project", projectId };
    }
    const issueId = parseId(third);
    if (!issueId) {
      return null;
    }
    return { kind: "issue", projectId, issueId };
  }

  if (parts[0] === "wiki") {
    if (parts.length < 2) {
      return null;
    }
    if (parts[1] === "sidebar.ts") {
      return null;
    }
    const wikiNodeId = parseId(parts[1]!);
    if (!wikiNodeId) {
      return null;
    }
    return { kind: "wiki", wikiNodeId };
  }

  if (parts[0] === "members") {
    if (parts.length < 2) {
      return null;
    }
    const memberId = parseId(parts[1]!);
    if (!memberId) {
      return null;
    }
    return { kind: "member", memberId };
  }

  if (parts[0] === "handoffs") {
    if (parts.length < 2) {
      return null;
    }
    const handoffId = parseId(parts[1]!);
    if (!handoffId) {
      return null;
    }
    return { kind: "handoff", handoffId };
  }

  return null;
}

function classifyPathUnderNode(
  relPath: string,
  ref: NodeRef,
): "props" | "body" | "other" {
  const rel = normalizeRel(relPath);
  const base = path.posix.basename(rel);

  if (ref.kind === "workspace") {
    if (base === "workspace.ts") {
      return "props";
    }
    if (base === "README.md") {
      return "body";
    }
    return "other";
  }

  if (ref.kind === "project") {
    if (base === "project.ts") {
      return "props";
    }
    if (base === "README.md") {
      return "body";
    }
    return "other";
  }

  // issue / wiki / member / handoff
  if (base === "props.ts") {
    return "props";
  }
  if (base === "README.md") {
    return "body";
  }
  if (base.endsWith(".md")) {
    return "body";
  }
  return "other";
}

function nodeKey(ref: NodeRef): string {
  switch (ref.kind) {
    case "workspace":
      return "workspace";
    case "project":
      return `project:${ref.projectId}`;
    case "issue":
      return `issue:${ref.projectId}::${ref.issueId}`;
    case "wiki":
      return `wiki:${ref.wikiNodeId}`;
    case "member":
      return `member:${ref.memberId}`;
    case "handoff":
      return `handoff:${ref.handoffId}`;
    default: {
      const _exhaustive: never = ref;
      return JSON.stringify(_exhaustive);
    }
  }
}

/**
 * Parse `git status --porcelain -z` / `git diff --name-status -z` path lists.
 * Status format: XY␠path␀  or  XY␠old␀new␀ for renames.
 * Name-status: X␠path␀  or  R###␀old␀new␀ for renames.
 */
export function parseNullSeparatedPaths(
  raw: string,
  mode: "status" | "name-status",
): string[] {
  if (!raw) {
    return [];
  }
  const tokens = raw.split("\0").filter((t) => t.length > 0);
  const paths: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i]!;
    if (mode === "status") {
      // First two chars are XY status; path follows (may include leading space stripped)
      if (tok.length < 3) {
        i += 1;
        continue;
      }
      const xy = tok.slice(0, 2);
      const rest = tok.slice(3); // skip XY + space
      const isRename =
        xy[0] === "R" || xy[1] === "R" || xy[0] === "C" || xy[1] === "C";
      if (isRename) {
        // porcelain -z rename: "R  old\0new\0" — first token has old path after XY
        if (rest) {
          paths.push(normalizeRel(rest));
        }
        i += 1;
        if (i < tokens.length) {
          paths.push(normalizeRel(tokens[i]!));
          i += 1;
        }
      } else {
        if (rest) {
          paths.push(normalizeRel(rest));
        }
        i += 1;
      }
    } else {
      // name-status -z: "A\0path\0" or "R100\0old\0new\0"
      const status = tok;
      i += 1;
      if (i >= tokens.length) {
        break;
      }
      const isRename = status.startsWith("R") || status.startsWith("C");
      if (isRename) {
        paths.push(normalizeRel(tokens[i]!));
        i += 1;
        if (i < tokens.length) {
          paths.push(normalizeRel(tokens[i]!));
          i += 1;
        }
      } else {
        paths.push(normalizeRel(tokens[i]!));
        i += 1;
      }
    }
  }
  return paths;
}

type Agg = {
  ref: NodeRef;
  propsChanged: boolean;
  bodyChanged: boolean;
  otherPaths: Set<string>;
  uncommitted: boolean;
  unpushed: boolean;
};

function applyPaths(
  map: Map<string, Agg>,
  otherFiles: Set<string>,
  paths: string[],
  layer: "uncommitted" | "unpushed",
): void {
  for (const p of paths) {
    const ref = nodeRefFromRelPath(p);
    if (!ref) {
      otherFiles.add(p);
      continue;
    }
    const key = nodeKey(ref);
    let agg = map.get(key);
    if (!agg) {
      agg = {
        ref,
        propsChanged: false,
        bodyChanged: false,
        otherPaths: new Set(),
        uncommitted: false,
        unpushed: false,
      };
      map.set(key, agg);
    }
    if (layer === "uncommitted") {
      agg.uncommitted = true;
    } else {
      agg.unpushed = true;
    }
    const kind = classifyPathUnderNode(p, ref);
    if (kind === "props") {
      agg.propsChanged = true;
    } else if (kind === "body") {
      agg.bodyChanged = true;
    } else {
      agg.otherPaths.add(p);
    }
  }
}

function toState(agg: Agg): UnsyncedNodeState {
  if (agg.uncommitted && agg.unpushed) {
    return "both";
  }
  if (agg.uncommitted) {
    return "uncommitted";
  }
  return "unpushed";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/**
 * True when worktree props/project.ts matches HEAD after stripping
 * system `created` / `updated` (stampOnWrite noise after undo).
 */
export async function isTimestampOnlyPropsDiff(
  workspaceRoot: string,
  relPath: string,
): Promise<boolean> {
  const rel = normalizeRel(relPath);
  const base = path.posix.basename(rel);
  if (base !== "props.ts" && base !== "project.ts") {
    return false;
  }

  const head = await runGit(workspaceRoot, ["show", `HEAD:${rel}`]);
  if (!head.ok) {
    return false;
  }

  let disk: string;
  try {
    disk = fs.readFileSync(path.join(workspaceRoot, ...rel.split("/")), "utf8");
  } catch {
    return false;
  }

  try {
    const headRaw = await evaluatePropsExport(head.stdout);
    const diskRaw = await evaluatePropsExport(disk);
    if (
      !headRaw ||
      typeof headRaw !== "object" ||
      Array.isArray(headRaw) ||
      !diskRaw ||
      typeof diskRaw !== "object" ||
      Array.isArray(diskRaw)
    ) {
      return false;
    }
    const headSlice = stripTimestampKeys({
      ...(headRaw as Record<string, unknown>),
    });
    const diskSlice = stripTimestampKeys({
      ...(diskRaw as Record<string, unknown>),
    });
    return stableStringify(headSlice) === stableStringify(diskSlice);
  } catch {
    return false;
  }
}

async function filterTimestampOnlyPropsNoise(
  workspaceRoot: string,
  paths: string[],
): Promise<string[]> {
  const kept: string[] = [];
  for (const p of paths) {
    if (!(await isTimestampOnlyPropsDiff(workspaceRoot, p))) {
      kept.push(p);
    }
  }
  return kept;
}

/**
 * Local-only aggregation of uncommitted + unpushed paths by node.
 * Never throws; never runs `git fetch`.
 */
export async function getUnsyncedChanges(
  workspaceRoot: string,
): Promise<UnsyncedChanges> {
  const inside = await runGit(workspaceRoot, [
    "rev-parse",
    "--is-inside-work-tree",
  ]);
  if (!inside.ok || inside.stdout.trim() !== "true") {
    return { kind: "not-repo", nodes: [], otherFiles: [] };
  }

  const upstream = await runGit(workspaceRoot, [
    "rev-parse",
    "--abbrev-ref",
    "@{upstream}",
  ]);
  const hasUp = upstream.ok && upstream.stdout.trim().length > 0;

  const statusResult = await runGit(workspaceRoot, [
    "status",
    "--porcelain",
    "-z",
    "-uall",
    "--",
    ".",
  ]);
  if (!statusResult.ok) {
    return {
      kind: hasUp ? "ok" : "no-upstream",
      nodes: [],
      otherFiles: [],
      error: statusResult.message,
    };
  }

  const map = new Map<string, Agg>();
  const otherFiles = new Set<string>();

  const uncommittedPaths = parseNullSeparatedPaths(
    statusResult.stdout,
    "status",
  );
  const meaningfulUncommitted = await filterTimestampOnlyPropsNoise(
    workspaceRoot,
    uncommittedPaths,
  );
  applyPaths(map, otherFiles, meaningfulUncommitted, "uncommitted");

  if (hasUp) {
    const diffResult = await runGit(workspaceRoot, [
      "diff",
      "--name-status",
      "-z",
      "@{upstream}..HEAD",
      "--",
      ".",
    ]);
    if (!diffResult.ok) {
      return {
        kind: "ok",
        nodes: finalize(map),
        otherFiles: [...otherFiles].sort(),
        error: diffResult.message,
      };
    }
    const unpushedPaths = parseNullSeparatedPaths(
      diffResult.stdout,
      "name-status",
    );
    applyPaths(map, otherFiles, unpushedPaths, "unpushed");
    return {
      kind: "ok",
      nodes: finalize(map),
      otherFiles: [...otherFiles].sort(),
    };
  }

  return {
    kind: "no-upstream",
    nodes: finalize(map),
    otherFiles: [...otherFiles].sort(),
  };
}

function finalize(map: Map<string, Agg>): UnsyncedNodeChange[] {
  return [...map.values()]
    .map((agg) => ({
      ref: agg.ref,
      propsChanged: agg.propsChanged,
      bodyChanged: agg.bodyChanged,
      otherPaths: [...agg.otherPaths].sort(),
      state: toState(agg),
    }))
    .sort((a, b) => nodeKey(a.ref).localeCompare(nodeKey(b.ref)));
}
