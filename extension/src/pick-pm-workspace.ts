import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { isValidWorkspace } from "../../app/electron/core/domain/store.js";
import { readWorkspaceMeta } from "../../app/electron/core/domain/workspace-meta.js";
import { discoverPmWorkspaces } from "../../app/electron/core/workspace/discover-pm-workspaces.js";
import { pmwsMarkerPath } from "../../app/electron/core/workspace/scaffold-workspace.js";

type WorkspacePickItem = vscode.QuickPickItem & { root: string };

export type PmWorkspaceCatalogItem = {
  root: string;
  title: string;
  relative: string;
};

function uniqueDiscoveredRoots(scanRoots: string[]): string[] {
  const unique = new Set<string>();
  for (const scan of scanRoots) {
    for (const root of discoverPmWorkspaces(scan)) {
      unique.add(root);
    }
  }
  return [...unique];
}

async function labelForRoot(root: string): Promise<string> {
  try {
    const meta = await readWorkspaceMeta(root);
    const trimmed = meta.title.trim();
    if (trimmed) {
      return trimmed;
    }
  } catch {
    /* basename fallback */
  }
  return path.basename(root);
}

/** Marker URI for `MapPanelHost.open`. */
export function markerUriForRoot(root: string): vscode.Uri {
  return vscode.Uri.file(pmwsMarkerPath(root));
}

export function isPmWorkspaceFolder(dir: string): boolean {
  return fs.existsSync(pmwsMarkerPath(dir)) && isValidWorkspace(dir);
}

export async function listPmWorkspaceCatalog(
  scanRoots: string[],
): Promise<PmWorkspaceCatalogItem[]> {
  const items: PmWorkspaceCatalogItem[] = [];
  for (const root of uniqueDiscoveredRoots(scanRoots)) {
    items.push({
      root,
      title: await labelForRoot(root),
      relative: vscode.workspace.asRelativePath(root, false),
    });
  }
  items.sort((a, b) => a.title.localeCompare(b.title));
  return items;
}

/**
 * 0 roots → info message and `undefined`.
 * 1 root → that path.
 * 2+ → QuickPick (label = workspace title, description = relative path).
 */
export async function choosePmWorkspaceRoot(
  scanRoots: string[],
): Promise<string | undefined> {
  const roots = uniqueDiscoveredRoots(scanRoots);
  if (roots.length === 0) {
    void vscode.window.showInformationMessage("No PM workspace found.");
    return undefined;
  }
  if (roots.length === 1) {
    return roots[0];
  }
  const items: WorkspacePickItem[] = [];
  for (const root of roots) {
    items.push({
      label: await labelForRoot(root),
      description: vscode.workspace.asRelativePath(root, false),
      root,
    });
  }
  items.sort((a, b) => a.label.localeCompare(b.label));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Open PM workspace",
    matchOnDescription: true,
  });
  if (!picked) {
    return undefined;
  }
  return (
    picked.root ??
    items.find(
      (item) =>
        item.label === picked.label && item.description === picked.description,
    )?.root
  );
}
