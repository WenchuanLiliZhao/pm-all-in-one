/**
 * Create a new workspace by copying `electron/workspace-template/` then
 * patching only dynamic fields (title, views, optional seed project).
 * ↔ workspace-template.ts — path + asar-safe copy
 * ↔ DEVELOPMENT.md — § Workspace templates
 */
import fs from "node:fs";
import path from "node:path";

import { emptyCustomProps } from "./custom-props.js";
import { allocateProjectId } from "./ids.js";
import { writePropsTs } from "./props-load.js";
import { writeSchemaDts } from "./schema-dts.js";
import { defaultViewsFile, viewsPath } from "./views.js";
import {
  copyTemplateTree,
  projectTemplateDir,
  workspaceTemplateDir,
} from "./workspace-template.js";
import {
  defaultWorkspaceMeta,
  writeWorkspaceMeta,
} from "./workspace-meta.js";

export interface ScaffoldWorkspaceOptions {
  /** Display title written to workspace.ts (folder name stays separate). */
  title?: string;
  seedProject?: { title: string };
}

function looksLikeWorkspace(root: string): boolean {
  return (
    fs.existsSync(path.join(root, "issue-hierarchy")) &&
    fs.existsSync(path.join(root, ".pm"))
  );
}

function assertUsableTarget(root: string): void {
  if (looksLikeWorkspace(root)) {
    throw new Error(
      "Folder is already a workspace. Use Open Workspace instead.",
    );
  }
  if (fs.existsSync(path.join(root, ".pm"))) {
    throw new Error("Folder already has a .pm/ directory.");
  }
  if (fs.existsSync(root)) {
    const entries = fs.readdirSync(root);
    if (entries.length > 0) {
      throw new Error(
        "Folder is not empty. Choose an empty folder or a new name.",
      );
    }
  }
}

/**
 * Create a new workspace at `root`.
 * Missing directory is created; existing non-empty directories are rejected.
 */
export function scaffoldWorkspace(
  root: string,
  options: ScaffoldWorkspaceOptions = {},
): void {
  assertUsableTarget(root);

  copyTemplateTree(workspaceTemplateDir(), root);

  writeWorkspaceMeta(root, defaultWorkspaceMeta(root, options.title));
  fs.writeFileSync(
    viewsPath(root),
    `${JSON.stringify(defaultViewsFile(), null, 2)}\n`,
    "utf8",
  );

  const seed = options.seedProject;
  if (seed) {
    const projectId = allocateProjectId(root);
    const title = seed.title.trim() || "My Project";
    const projectDir = path.join(root, "issue-hierarchy", projectId);
    fs.mkdirSync(path.join(projectDir, ".pm"), { recursive: true });
    copyTemplateTree(projectTemplateDir(), projectDir);
    const now = new Date().toISOString();
    fs.writeFileSync(
      path.join(projectDir, "project.ts"),
      writePropsTs({
        title,
        created: now,
        updated: now,
      }),
      "utf8",
    );
    writeSchemaDts(projectDir, emptyCustomProps());
  }
}
