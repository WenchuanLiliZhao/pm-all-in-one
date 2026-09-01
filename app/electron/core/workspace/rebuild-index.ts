// ↔ electron/main.ts / server/main.ts — rebuildIndex consumers over dual bridge
// Zone 3 core entry for derived .pm/index.json (not a PmApi landing)
import fs from "node:fs";
import path from "node:path";

import { loadCustomProps } from "../domain/custom-props.js";
import { loadWikiCustomProps } from "../domain/wiki-custom-props.js";
import { ensureDirWithGitkeep, hierarchyRoot } from "../identity/ids.js";
import { writeSchemaDts, writeWikiSchemaDts } from "../infra/schema-dts.js";
import { listIssues, listProjects } from "../domain/store.js";
import {
  issueRefKey,
  type IssueTree,
  type TreeNode,
} from "../identity/types.js";

export function indexPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".pm", "index.json");
}

/** Leftover from when rebuild wrote a derived agent map. Not a source of truth. */
export function legacyAgentTreePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".pm", "tree.md");
}

export async function buildTree(workspaceRoot: string): Promise<IssueTree> {
  const projects = await listProjects(workspaceRoot);
  const issues = await listIssues(workspaceRoot);
  const byId: Record<string, TreeNode> = {};
  const children: Record<string, string[]> = {};
  const roots: string[] = [];

  for (const p of projects) {
    const key = String(p.id);
    byId[key] = {
      kind: "project",
      key,
      projectId: p.id,
      title: p.title,
    };
    children[key] = [];
    roots.push(key);
  }

  for (const issue of issues) {
    const key = issueRefKey(issue.projectId, issue.id);
    byId[key] = {
      kind: "issue",
      key,
      projectId: issue.projectId,
      issueId: issue.id,
      level: issue.level,
      title: issue.title,
      hasViolation: issue.violations.length > 0,
    };
    children[key] = children[key] ?? [];
  }

  for (const issue of issues) {
    const key = issueRefKey(issue.projectId, issue.id);
    const projectKey = String(issue.projectId);
    const statedParent =
      issue.parentId === null
        ? projectKey
        : issueRefKey(issue.projectId, issue.parentId);
    // An issue whose parent is missing still has to be reachable, or its
    // violation badge would be invisible; park it under its project.
    const parentKey = byId[statedParent] ? statedParent : projectKey;
    if (byId[parentKey]) {
      children[parentKey] = children[parentKey] ?? [];
      children[parentKey].push(key);
    }
  }

  for (const ids of Object.values(children)) {
    ids.sort((a, b) => (byId[a]?.title ?? a).localeCompare(byId[b]?.title ?? b));
  }
  roots.sort((a, b) => (byId[a]?.title ?? a).localeCompare(byId[b]?.title ?? b));

  return { byId, children, roots };
}

export function persistIndex(workspaceRoot: string, tree: IssueTree): void {
  const pmDir = path.join(workspaceRoot, ".pm");
  fs.mkdirSync(pmDir, { recursive: true });
  fs.writeFileSync(indexPath(workspaceRoot), JSON.stringify(tree, null, 2) + "\n", "utf8");
}

/** Drop a leftover `.pm/tree.md` so it cannot be mistaken for a second map. */
export function removeLegacyAgentTree(workspaceRoot: string): void {
  const file = legacyAgentTreePath(workspaceRoot);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

export async function rebuildIndex(workspaceRoot: string): Promise<IssueTree> {
  const tree = await buildTree(workspaceRoot);
  persistIndex(workspaceRoot, tree);
  removeLegacyAgentTree(workspaceRoot);
  // schema.d.ts is committed, so a fresh clone or a hand-edited custom-props.ts
  // could leave it stale; regenerating on open keeps it honest.
  for (const project of await listProjects(workspaceRoot)) {
    writeSchemaDts(project.path, await loadCustomProps(project.path));
  }
  writeWikiSchemaDts(workspaceRoot, await loadWikiCustomProps(workspaceRoot));
  return tree;
}

/** Ensure hierarchy root exists for empty workspaces (with `.gitkeep`). */
export function ensureHierarchyRoot(workspaceRoot: string): void {
  ensureDirWithGitkeep(hierarchyRoot(workspaceRoot));
}
