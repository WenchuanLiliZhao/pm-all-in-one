// ↔ electron/main.ts / server/main.ts — rebuildIndex consumers over dual bridge
// Zone 3 core entry for derived .pm/index.json + tree.md (not a PmApi landing)
import fs from "node:fs";
import path from "node:path";

import { loadCustomProps } from "./custom-props.js";
import { hierarchyRoot } from "./ids.js";
import { writeSchemaDts } from "./schema-dts.js";
import { listIssues, listProjects } from "./store.js";
import {
  issueRefKey,
  type IssueTree,
  type TreeNode,
} from "./types.js";

export function indexPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".pm", "index.json");
}

export function agentTreePath(workspaceRoot: string): string {
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

/**
 * A one-page map for agents working in a terminal.
 *
 * Flat directories give a mechanical path for every reference but no ancestry,
 * so this file supplies the ancestry. Derived and gitignored: files stay the
 * source of truth.
 */
export function renderAgentTree(tree: IssueTree): string {
  const lines = [
    "# Workspace map (derived)",
    "",
    "Rebuilt by pm-all-in-one; do not edit.",
    "",
  ];

  const walk = (key: string, depth: number): void => {
    const node = tree.byId[key];
    if (!node) {
      return;
    }
    const indent = "  ".repeat(depth);
    const flag = node.hasViolation ? " [violation]" : "";
    lines.push(
      `${indent}- @issue-${node.projectId}::${node.issueId} ${node.level} — ${node.title || "(untitled)"}${flag}`,
    );
    for (const child of tree.children[key] ?? []) {
      walk(child, depth + 1);
    }
  };

  for (const projectKey of tree.roots) {
    const project = tree.byId[projectKey];
    if (!project) {
      continue;
    }
    lines.push(
      `## project ${project.projectId} — ${project.title || "(untitled)"}`,
      "",
    );
    const children = tree.children[projectKey] ?? [];
    if (children.length === 0) {
      lines.push("_no issues yet_");
    }
    for (const child of children) {
      walk(child, 0);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function persistAgentTree(workspaceRoot: string, tree: IssueTree): void {
  fs.mkdirSync(path.join(workspaceRoot, ".pm"), { recursive: true });
  fs.writeFileSync(agentTreePath(workspaceRoot), renderAgentTree(tree), "utf8");
}

export async function rebuildIndex(workspaceRoot: string): Promise<IssueTree> {
  const tree = await buildTree(workspaceRoot);
  persistIndex(workspaceRoot, tree);
  persistAgentTree(workspaceRoot, tree);
  // schema.d.ts is committed, so a fresh clone or a hand-edited custom-props.ts
  // could leave it stale; regenerating on open keeps it honest.
  for (const project of await listProjects(workspaceRoot)) {
    writeSchemaDts(project.path, await loadCustomProps(project.path));
  }
  return tree;
}

/** Ensure hierarchy root exists for empty workspaces. */
export function ensureHierarchyRoot(workspaceRoot: string): void {
  fs.mkdirSync(hierarchyRoot(workspaceRoot), { recursive: true });
}
