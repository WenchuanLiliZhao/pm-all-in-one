import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  resolveNodeDir,
  type NodeRef,
} from "../../app/electron/core/domain/node-assets.js";
import { isValidEntityId } from "../../app/electron/core/identity/dir-id.js";
import { isValidWorkspace } from "../../app/electron/core/domain/store.js";

export type { NodeRef };

export type ResolvedPmNode = {
  root: string;
  ref: NodeRef;
};

export type ResolvePmNodeResult =
  | { ok: true; value: ResolvedPmNode }
  | { ok: false; error: string };

function posixRel(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/");
}

export function findWorkspaceRootFromFile(filePath: string): string | null {
  let dir = path.dirname(path.resolve(filePath));
  for (;;) {
    const marker = path.join(dir, ".pmws");
    if (fs.existsSync(marker) && isValidWorkspace(dir)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

function parseNodeReadme(root: string, filePath: string): NodeRef | null {
  if (path.basename(filePath) !== "README.md") {
    return null;
  }
  const rel = posixRel(root, path.resolve(filePath));
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  const parts = rel.split("/").filter(Boolean);
  if (parts.some((p) => p === "assets")) {
    return null;
  }
  if (parts.length === 1 && parts[0] === "README.md") {
    return { kind: "workspace" };
  }
  if (parts.length === 3 && parts[0] === "wiki" && parts[2] === "README.md") {
    const wikiNodeId = parts[1]!;
    return isValidEntityId(wikiNodeId) ? { kind: "wiki", wikiNodeId } : null;
  }
  if (parts.length === 3 && parts[0] === "members" && parts[2] === "README.md") {
    const memberId = parts[1]!;
    return isValidEntityId(memberId) ? { kind: "member", memberId } : null;
  }
  if (
    parts.length === 3 &&
    parts[0] === "handoffs" &&
    parts[2] === "README.md"
  ) {
    const handoffId = parts[1]!;
    return isValidEntityId(handoffId) ? { kind: "handoff", handoffId } : null;
  }
  if (parts[0] === "issue-hierarchy") {
    if (parts.length === 3 && parts[2] === "README.md") {
      const projectId = parts[1]!;
      return isValidEntityId(projectId)
        ? { kind: "project", projectId }
        : null;
    }
    if (parts.length === 4 && parts[3] === "README.md") {
      const projectId = parts[1]!;
      const issueId = parts[2]!;
      return isValidEntityId(projectId) && isValidEntityId(issueId)
        ? { kind: "issue", projectId, issueId }
        : null;
    }
  }
  return null;
}

export function resolvePmNodeReadme(uri: vscode.Uri): ResolvePmNodeResult {
  if (uri.scheme !== "file") {
    return { ok: false, error: "Not a file on disk." };
  }
  const filePath = uri.fsPath;
  if (path.basename(filePath) !== "README.md") {
    return { ok: false, error: "Not a node README.md." };
  }
  const root = findWorkspaceRootFromFile(filePath);
  if (!root) {
    return {
      ok: false,
      error: "Not inside a pm-all-in-one workspace (.pmws).",
    };
  }
  const ref = parseNodeReadme(root, filePath);
  if (!ref) {
    return {
      ok: false,
      error: "Not a PM node README (wiki / issue / Home / member / handoff).",
    };
  }
  return { ok: true, value: { root, ref } };
}

export function readmeUriForNode(root: string, ref: NodeRef): vscode.Uri {
  return vscode.Uri.file(path.join(resolveNodeDir(root, ref), "README.md"));
}

export function labelForNodeRef(ref: NodeRef): string {
  switch (ref.kind) {
    case "workspace":
      return "Home";
    case "project":
      return "Project";
    case "issue":
      return "Issue";
    case "wiki":
      return "Wiki";
    case "member":
      return "Member";
    case "handoff":
      return "Handoff";
    default: {
      const _exhaustive: never = ref;
      return JSON.stringify(_exhaustive);
    }
  }
}
