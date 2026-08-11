/**
 * Resolve on-disk workspace / project template folders shipped beside compiled core.
 * ↔ scaffold-workspace.ts — copies these at create time
 * ↔ scripts/copy-templates.mjs — build step that places templates next to dist
 * ↔ agent-md.ts — factory `.pm/agent.md` for drift check
 * ↔ DEVELOPMENT.md — § Workspace templates
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKIP_NAMES = new Set([".gitkeep"]);

/**
 * Absolute path to `workspace-template/` (source or compiled sibling).
 * Override with `LOCAL_PM_WORKSPACE_TEMPLATE` for tests pointing at source.
 */
export function workspaceTemplateDir(): string {
  const override = process.env.LOCAL_PM_WORKSPACE_TEMPLATE?.trim();
  if (override) {
    return path.resolve(override);
  }
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "workspace-template",
  );
}

/**
 * Absolute path to `project-template/` (seed project files without id dir).
 * Override with `LOCAL_PM_PROJECT_TEMPLATE` for tests.
 */
export function projectTemplateDir(): string {
  const override = process.env.LOCAL_PM_PROJECT_TEMPLATE?.trim();
  if (override) {
    return path.resolve(override);
  }
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "project-template",
  );
}

/**
 * Asar-safe recursive copy. Skips `.gitkeep` (git placeholders only).
 * Prefer classic read/write over `fs.cpSync` for Electron asar reliability.
 */
export function copyTemplateTree(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Template folder missing: ${srcDir}`);
  }
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (SKIP_NAMES.has(entry.name)) {
      continue;
    }
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTemplateTree(from, to);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, fs.readFileSync(from));
    }
  }
}
