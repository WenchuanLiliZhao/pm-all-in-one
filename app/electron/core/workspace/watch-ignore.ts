/**
 * Paths the workspace watcher must not descend into.
 * ↔ watch.ts — chokidar `ignored`
 * ↔ fence-validators.ts — `skipName` (same junk trees; fence also skips `assets/`)
 * ↔ discover-pm-workspaces.ts — same dir-name skip when walking for `.pmws`
 * ↔ ../domain/node-assets.ts — `NODE_ASSETS_DIRNAME`
 */
import path from "node:path";

import { NODE_ASSETS_DIRNAME } from "../domain/node-assets.js";

/**
 * Directory names that are never PM source. Nested checkouts under `assets/`
 * (node_modules, .next, .git) blow macOS `maxfiles` (Finder soft limit 256)
 * and make open hang with EMFILE.
 */
const IGNORED_WATCH_DIR_NAMES = new Set([
  ".pm",
  "node_modules",
  NODE_ASSETS_DIRNAME,
  "dist",
  "dist-electron",
  "dist-server",
  "coverage",
  "build",
]);

/** True for junk / attachment directory names and any dot-directory. */
export function isIgnoredWatchDirName(name: string): boolean {
  return IGNORED_WATCH_DIR_NAMES.has(name) || name.startsWith(".");
}

/**
 * True when `watchedPath` is under `workspaceRoot` and any path segment is a
 * junk / attachment directory, or a dot-directory (`.git`, `.next`, …).
 * Paths outside the workspace are not ignored here (chokidar should not emit them).
 */
export function isIgnoredWatchPath(
  workspaceRoot: string,
  watchedPath: string,
): boolean {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(watchedPath);
  const rel = path.relative(root, target);
  if (rel === "") {
    return false;
  }
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return false;
  }
  return rel.split(path.sep).some((part) => isIgnoredWatchDirName(part));
}
