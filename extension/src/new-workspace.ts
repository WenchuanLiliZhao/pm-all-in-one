import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { slugifyWorkspaceFolder } from "../../app/electron/core/identity/slugify-folder.js";
import {
  pmwsMarkerPath,
  scaffoldWorkspace,
} from "../../app/electron/core/workspace/scaffold-workspace.js";

function resolveNewWorkspaceRoot(parentDir: string, folderName: string): string {
  const name = folderName.trim();
  if (!name) {
    throw new Error("Workspace folder name is required.");
  }
  if (name === "." || name === ".." || /[/\\]/.test(name)) {
    throw new Error("Folder name must be a single path segment.");
  }
  return path.join(parentDir, name);
}

async function parentDirFromUri(uri: vscode.Uri): Promise<string | null> {
  if (uri.scheme !== "file") {
    return null;
  }
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.type & vscode.FileType.Directory) {
      return uri.fsPath;
    }
  } catch {
    /* fall through to dirname */
  }
  return path.dirname(uri.fsPath);
}

async function pickParentFolder(): Promise<string | null> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title: "Choose parent folder for the new PM workspace",
    openLabel: "Select",
    defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
  });
  return picked?.[0]?.fsPath ?? null;
}

export async function createPmWorkspace(
  uri: vscode.Uri | undefined,
): Promise<{ root: string; marker: string } | null> {
  const parent =
    uri !== undefined
      ? await parentDirFromUri(uri)
      : await pickParentFolder();
  if (!parent) {
    return null;
  }
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    throw new Error("Parent folder is required.");
  }

  const title = await vscode.window.showInputBox({
    title: "New PM Workspace",
    prompt: `Creates a new folder under ${parent}`,
    value: "My Workspace",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.trim() ? undefined : "Workspace title is required.",
  });
  if (title === undefined) {
    return null;
  }
  const trimmed = title.trim();
  const root = resolveNewWorkspaceRoot(
    parent,
    slugifyWorkspaceFolder(trimmed),
  );
  scaffoldWorkspace(root, { title: trimmed });
  const marker = pmwsMarkerPath(root);
  if (!fs.existsSync(marker)) {
    throw new Error("Workspace was created but .pmws is missing.");
  }
  return { root, marker };
}
