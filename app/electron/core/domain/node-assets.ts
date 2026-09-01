/**
 * Per-node optional `assets/` folder. No assets → no directory.
 * Nested files are allowed; cites use posix relative paths under `assets/`.
 */
import fs from "node:fs";
import path from "node:path";

import { isValidEntityId, type EntityId } from "../identity/dir-id.js";
import { memberDirPath } from "./members.js";
import { handoffDirPath } from "./handoffs.js";
import { issueDirPath, projectDirPath } from "./store.js";
import { wikiNodeDirPath } from "./wiki.js";

/** Reserved sibling directory name under a node (not an issue / wiki id). */
export const NODE_ASSETS_DIRNAME = "assets";

/** Nesting under a copied folder (the folder itself is not counted). */
export const MAX_ASSET_COPY_DEPTH = 8;

/** Files written in a single copy call (all sources combined). */
export const MAX_ASSET_COPY_FILES = 500;

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
  return path.join(nodeDir, NODE_ASSETS_DIRNAME);
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

/**
 * Posix relative paths under `assets/` (nested ok). Missing/empty → [].
 * Directories end with `/` (including empty folders); files have no trailing slash.
 * Junk names are omitted.
 */
export function listNodeAssets(
  workspaceRoot: string,
  ref: NodeRef,
): string[] {
  const dir = getNodeAssetsDir(workspaceRoot, ref);
  if (!dir) {
    return [];
  }
  const out: string[] = [];
  listFilesRecursive(dir, "", out);
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

/**
 * Copy source files or directories into the node's `assets/`. Creates the
 * directory on first write. Returns posix relative paths written (after
 * conflict renaming). Directories keep their relative tree under
 * `assets/<folder-name>/`.
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
  const counter = { files: 0 };
  for (const src of sourcePaths) {
    if (!fs.existsSync(src)) {
      throw new Error(`Not a readable file or directory: ${JSON.stringify(src)}`);
    }
    const st = fs.lstatSync(src);
    if (st.isSymbolicLink()) {
      throw new Error(`Symlinks are not copied into assets: ${JSON.stringify(src)}`);
    }
    if (st.isFile()) {
      bumpFileCount(counter);
      const base = sanitizeAssetBasename(path.basename(src));
      const destName = uniqueAssetName(assetsDir, base);
      fs.copyFileSync(src, path.join(assetsDir, destName));
      written.push(destName);
      continue;
    }
    if (st.isDirectory()) {
      const folderName = uniqueAssetFolderName(
        assetsDir,
        sanitizeAssetBasename(path.basename(src)),
      );
      const destDir = path.join(assetsDir, folderName);
      fs.mkdirSync(destDir, { recursive: true });
      copyDirTree(src, destDir, folderName, 1, written, counter);
      continue;
    }
    throw new Error(`Not a readable file or directory: ${JSON.stringify(src)}`);
  }
  return written;
}

export type NodeAssetBufferInput = {
  /** Suggested basename (sanitized + de-duped on write). */
  name: string;
  bytes: Uint8Array;
};

/**
 * Write in-memory buffers into the node's `assets/` (clipboard paste / no path).
 * Returns final basenames written (top-level only).
 */
export function writeBuffersIntoNodeAssets(
  workspaceRoot: string,
  ref: NodeRef,
  items: NodeAssetBufferInput[],
): string[] {
  if (items.length === 0) {
    return [];
  }
  const assetsDir = nodeAssetsDir(resolveNodeDir(workspaceRoot, ref));
  fs.mkdirSync(assetsDir, { recursive: true });

  const written: string[] = [];
  for (const item of items) {
    const base = sanitizeAssetBasename(item.name);
    const destName = uniqueAssetName(assetsDir, base);
    fs.writeFileSync(path.join(assetsDir, destName), item.bytes);
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

/**
 * Folder dest name: reuse an existing directory (merge); if a file already
 * uses the name, add `-2` / `-3` like files.
 */
export function uniqueAssetFolderName(
  assetsDir: string,
  basename: string,
): string {
  const safe = sanitizeAssetBasename(basename);
  const dest = path.join(assetsDir, safe);
  if (!fs.existsSync(dest)) {
    return safe;
  }
  const st = fs.lstatSync(dest);
  if (st.isDirectory() && !st.isSymbolicLink()) {
    return safe;
  }
  const parsed = path.parse(safe);
  const stem = parsed.name || "folder";
  const ext = parsed.ext;
  let n = 2;
  for (;;) {
    const candidate = `${stem}-${n}${ext}`;
    const candPath = path.join(assetsDir, candidate);
    if (!fs.existsSync(candPath)) {
      return candidate;
    }
    const cst = fs.lstatSync(candPath);
    if (cst.isDirectory() && !cst.isSymbolicLink()) {
      return candidate;
    }
    n += 1;
  }
}

function skipAssetEntry(name: string): boolean {
  if (!name || name === "." || name === "..") return true;
  if (name.startsWith(".")) return true;
  if (name === "Thumbs.db") return true;
  return false;
}

function posixJoin(prefix: string, name: string): string {
  return prefix ? `${prefix}/${name}` : name;
}

function bumpFileCount(counter: { files: number }): void {
  counter.files += 1;
  if (counter.files > MAX_ASSET_COPY_FILES) {
    throw new Error(
      `Asset copy exceeds max files (${MAX_ASSET_COPY_FILES})`,
    );
  }
}

function listFilesRecursive(dir: string, prefix: string, into: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of entries) {
    if (skipAssetEntry(d.name)) continue;
    if (d.isSymbolicLink()) continue;
    const rel = posixJoin(prefix, d.name);
    if (d.isDirectory()) {
      into.push(`${rel}/`);
      listFilesRecursive(path.join(dir, d.name), rel, into);
      continue;
    }
    if (d.isFile()) {
      into.push(rel);
    }
  }
}

function copyDirTree(
  srcDir: string,
  destDir: string,
  relPrefix: string,
  depth: number,
  written: string[],
  counter: { files: number },
): void {
  if (depth > MAX_ASSET_COPY_DEPTH) {
    throw new Error(`Asset folder exceeds max depth (${MAX_ASSET_COPY_DEPTH})`);
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    throw new Error(`Not a readable directory: ${JSON.stringify(srcDir)}`);
  }
  for (const d of entries) {
    if (skipAssetEntry(d.name)) continue;
    const srcPath = path.join(srcDir, d.name);
    let st: fs.Stats;
    try {
      st = fs.lstatSync(srcPath);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isFile()) {
      bumpFileCount(counter);
      const base = sanitizeAssetBasename(d.name);
      const destName = uniqueAssetName(destDir, base);
      fs.copyFileSync(srcPath, path.join(destDir, destName));
      written.push(posixJoin(relPrefix, destName));
      continue;
    }
    if (st.isDirectory()) {
      const folderName = uniqueAssetFolderName(
        destDir,
        sanitizeAssetBasename(d.name),
      );
      const nestedDest = path.join(destDir, folderName);
      fs.mkdirSync(nestedDest, { recursive: true });
      copyDirTree(
        srcPath,
        nestedDest,
        posixJoin(relPrefix, folderName),
        depth + 1,
        written,
        counter,
      );
    }
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
