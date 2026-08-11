/**
 * Per-node optional `assets/` folder. No assets → no directory.
 */
import fs from "node:fs";
import path from "node:path";

import { isValidEntityId, type EntityId } from "../identity/dir-id.js";
import { memberDirPath } from "./members.js";
import { handoffDirPath } from "./handoffs.js";
import { issueDirPath, projectDirPath } from "./store.js";
import { wikiNodeDirPath } from "./wiki.js";

export type NodeRef =
  | { kind: "workspace" }
  | { kind: "project"; projectId: string }
  | { kind: "issue"; projectId: string; issueId: string }
  | { kind: "wiki"; wikiNodeId: string }
  | { kind: "member"; memberId: string }
  | { kind: "handoff"; handoffId: string };

export function resolveNodeDir(workspaceRoot: string, ref: NodeRef): string {
  switch (ref.kind) {
    case "workspace":
      return workspaceRoot;
    case "project": {
      const projectId = assertEntityId(ref.projectId, "projectId");
      const dir = projectDirPath(workspaceRoot, projectId);
      assertNodeDir(dir, `project ${projectId}`);
      return dir;
    }
    case "issue": {
      const projectId = assertEntityId(ref.projectId, "projectId");
      const issueId = assertEntityId(ref.issueId, "issueId");
      const dir = issueDirPath(workspaceRoot, projectId, issueId);
      assertNodeDir(dir, `issue ${projectId}::${issueId}`);
      return dir;
    }
    case "wiki": {
      const wikiNodeId = assertEntityId(ref.wikiNodeId, "wikiNodeId");
      const dir = wikiNodeDirPath(workspaceRoot, wikiNodeId);
      assertNodeDir(dir, `wiki-node ${wikiNodeId}`);
      return dir;
    }
    case "member": {
      const memberId = assertEntityId(ref.memberId, "memberId");
      const dir = memberDirPath(workspaceRoot, memberId);
      assertNodeDir(dir, `member ${memberId}`);
      return dir;
    }
    case "handoff": {
      const handoffId = assertEntityId(ref.handoffId, "handoffId");
      const dir = handoffDirPath(workspaceRoot, handoffId);
      assertNodeDir(dir, `handoff ${handoffId}`);
      return dir;
    }
    default: {
      const _exhaustive: never = ref;
      throw new Error(`Unknown node ref: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function nodeAssetsDir(nodeDir: string): string {
  return path.join(nodeDir, "assets");
}

/** Absolute `assets/` path when the directory exists; otherwise null. */
export function getNodeAssetsDir(
  workspaceRoot: string,
  ref: NodeRef,
): string | null {
  const dir = nodeAssetsDir(resolveNodeDir(workspaceRoot, ref));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return null;
  }
  return dir;
}

/** Filenames under `assets/` (files only). Missing/empty dir → []. */
export function listNodeAssets(
  workspaceRoot: string,
  ref: NodeRef,
): string[] {
  const dir = getNodeAssetsDir(workspaceRoot, ref);
  if (!dir) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Copy source files into the node's `assets/`. Creates the directory on first
 * write. Returns the final basenames written (after conflict renaming).
 */
export function copyFilesIntoNodeAssets(
  workspaceRoot: string,
  ref: NodeRef,
  sourcePaths: string[],
): string[] {
  if (sourcePaths.length === 0) {
    return [];
  }
  const assetsDir = nodeAssetsDir(resolveNodeDir(workspaceRoot, ref));
  fs.mkdirSync(assetsDir, { recursive: true });

  const written: string[] = [];
  for (const src of sourcePaths) {
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
      throw new Error(`Not a readable file: ${JSON.stringify(src)}`);
    }
    const base = sanitizeAssetBasename(path.basename(src));
    const destName = uniqueAssetName(assetsDir, base);
    fs.copyFileSync(src, path.join(assetsDir, destName));
    written.push(destName);
  }
  return written;
}

/** Strip path segments; reject empty / `.` / `..`. */
export function sanitizeAssetBasename(name: string): string {
  // Normalize Windows separators so basename works on POSIX hosts too.
  const normalized = name.replace(/\\/g, "/");
  const base = path.basename(normalized).trim();
  if (!base || base === "." || base === "..") {
    throw new Error(`Invalid asset filename: ${JSON.stringify(name)}`);
  }
  if (base.includes("/") || base.includes("\\") || base.includes("\0")) {
    throw new Error(`Invalid asset filename: ${JSON.stringify(name)}`);
  }
  return base;
}

/** `diagram.png` → `diagram-2.png` when taken. */
export function uniqueAssetName(assetsDir: string, basename: string): string {
  const safe = sanitizeAssetBasename(basename);
  if (!fs.existsSync(path.join(assetsDir, safe))) {
    return safe;
  }
  const parsed = path.parse(safe);
  const stem = parsed.name || "file";
  const ext = parsed.ext;
  let n = 2;
  for (;;) {
    const candidate = `${stem}-${n}${ext}`;
    if (!fs.existsSync(path.join(assetsDir, candidate))) {
      return candidate;
    }
    n += 1;
  }
}

function assertEntityId(id: string, label: string): EntityId {
  if (!isValidEntityId(id)) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(id)}`);
  }
  return id;
}

function assertNodeDir(dir: string, label: string): void {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Node directory missing for ${label}`);
  }
}
