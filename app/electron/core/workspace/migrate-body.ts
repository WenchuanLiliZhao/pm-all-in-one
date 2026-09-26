/**
 * One-shot: rename legacy `README.md` node bodies to `body.md`.
 *
 * Walks every node location — workspace root (Home), projects, issues,
 * wiki-nodes, members, handoffs — and renames `README.md` → `body.md` where
 * the new file does not exist yet. A directory that has both is left alone
 * and reported by doctor (`body-legacy-readme`); the person decides which
 * text wins. `README.md` under a node's `assets/` is ordinary Markdown and is
 * never touched.
 *
 * Runs on workspace open (app, server) and as `pm-all-in-one migrate body`.
 * ↔ ../identity/body-file.ts — the names
 * ↔ doctor.ts — reports what this did not rename
 */
import fs from "node:fs";
import path from "node:path";

import { BODY_FILE, LEGACY_BODY_FILE } from "../identity/body-file.js";
import { parseId } from "../identity/dir-id.js";
import { handoffsRoot, hierarchyRoot, membersRoot, wikiRoot } from "../identity/ids.js";

export interface BodyMigrationReport {
  /** Directories where README.md became body.md (relative to the workspace root). */
  renamed: string[];
  /** Directories that had both files; nothing was changed there. */
  conflicts: string[];
}

function idChildDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => parseId(name) !== null)
    .map((name) => path.join(dir, name))
    .filter((p) => fs.statSync(p).isDirectory())
    .sort();
}

/** Every directory that owns a body file. */
export function listNodeDirs(workspaceRoot: string): string[] {
  const out: string[] = [workspaceRoot];
  for (const projectDir of idChildDirs(hierarchyRoot(workspaceRoot))) {
    out.push(projectDir);
    out.push(...idChildDirs(projectDir));
  }
  out.push(...idChildDirs(wikiRoot(workspaceRoot)));
  out.push(...idChildDirs(membersRoot(workspaceRoot)));
  out.push(...idChildDirs(handoffsRoot(workspaceRoot)));
  return out;
}

/** Node directories that still carry a `README.md` body, with whether `body.md` also exists. */
export function listLegacyBodyFiles(
  workspaceRoot: string,
): Array<{ dir: string; hasBody: boolean }> {
  const out: Array<{ dir: string; hasBody: boolean }> = [];
  for (const dir of listNodeDirs(workspaceRoot)) {
    const legacy = path.join(dir, LEGACY_BODY_FILE);
    if (!fs.existsSync(legacy) || !fs.statSync(legacy).isFile()) {
      continue;
    }
    out.push({ dir, hasBody: fs.existsSync(path.join(dir, BODY_FILE)) });
  }
  return out;
}

export function migrateBodyFiles(workspaceRoot: string): BodyMigrationReport {
  const report: BodyMigrationReport = { renamed: [], conflicts: [] };
  for (const { dir, hasBody } of listLegacyBodyFiles(workspaceRoot)) {
    const rel = path.relative(workspaceRoot, dir) || ".";
    if (hasBody) {
      report.conflicts.push(rel);
      continue;
    }
    fs.renameSync(path.join(dir, LEGACY_BODY_FILE), path.join(dir, BODY_FILE));
    report.renamed.push(rel);
  }
  return report;
}
