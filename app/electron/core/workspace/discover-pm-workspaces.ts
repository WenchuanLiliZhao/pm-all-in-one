/**
 * Outermost valid PM workspace roots under an arbitrary folder.
 * ↔ watch-ignore.ts — same skip names for junk / assets / dotdirs
 * ↔ scaffold-workspace.ts — `.pmws` marker
 * ↔ ../domain/store.ts — isValidWorkspace
 */
import fs from "node:fs";
import path from "node:path";

import { isValidWorkspace } from "../domain/store.js";
import { pmwsMarkerPath } from "./scaffold-workspace.js";
import { isIgnoredWatchDirName } from "./watch-ignore.js";

/** Max directory depth below `scanRoot` (the root itself is depth 0). */
export const MAX_PM_WORKSPACE_DISCOVER_DEPTH = 12;

function isPmWorkspaceRoot(dir: string): boolean {
  return fs.existsSync(pmwsMarkerPath(dir)) && isValidWorkspace(dir);
}

function hasPmwsMarker(dir: string): boolean {
  return fs.existsSync(pmwsMarkerPath(dir));
}

function walk(
  dir: string,
  depth: number,
  found: string[],
  seen: Set<string>,
): void {
  const resolved = path.resolve(dir);
  if (seen.has(resolved)) {
    return;
  }
  seen.add(resolved);
  if (isPmWorkspaceRoot(dir)) {
    found.push(resolved);
    return;
  }
  if (hasPmwsMarker(dir)) {
    return;
  }
  if (depth >= MAX_PM_WORKSPACE_DISCOVER_DEPTH) {
    return;
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    if (isIgnoredWatchDirName(entry.name)) {
      continue;
    }
    const child = path.join(dir, entry.name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(child);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) {
      continue;
    }
    walk(child, depth + 1, found, seen);
  }
}

/**
 * Resolved paths of outermost folders that have `.pmws` and pass
 * `isValidWorkspace`. Does not use VS Code `findFiles` (dotfiles are skipped).
 * The scan root itself is never skipped by name, so a walk that starts on
 * `assets/` can still find a child library.
 */
export function discoverPmWorkspaces(scanRoot: string): string[] {
  const root = path.resolve(scanRoot);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(root);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) {
    return [];
  }
  const found: string[] = [];
  walk(root, 0, found, new Set());
  return found;
}
