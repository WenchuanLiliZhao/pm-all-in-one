import type { NavigateFunction } from "react-router-dom";
import { getPm, isVsCodePm } from "@/lib/bridge";
import type { NodeRef } from "@/lib/bridge/pm-api";
import type { TreeNode } from "@/lib/types";
import type { Selection } from "@/lib/workspace/workspace-context";

export function isPmNodeSurface(): boolean {
  return window.__pmSurface === "node";
}

/** Host-only. Used by the vscode right-click menu, not left-click. */
export async function openPmDocument(ref: NodeRef): Promise<boolean> {
  if (!isVsCodePm()) {
    return false;
  }
  const open = getPm().openPmNode;
  if (!open) {
    return false;
  }
  await open(ref);
  return true;
}

export function openWikiNode(id: string, navigate: NavigateFunction): void {
  navigate(isPmNodeSurface() ? `/n/wiki/${id}` : `/w/wiki/${id}`);
}

export function openMemberNode(id: string, navigate: NavigateFunction): void {
  navigate(isPmNodeSurface() ? `/n/members/${id}` : `/w/members/${id}`);
}

export function openHandoffNode(id: string, navigate: NavigateFunction): void {
  navigate(isPmNodeSurface() ? `/n/handoffs/${id}` : `/w/handoffs/${id}`);
}

export function openHomeNode(navigate: NavigateFunction): void {
  navigate(isPmNodeSurface() ? "/n/home" : "/w/home");
}

export function selectionToNodeRef(sel: NonNullable<Selection>): NodeRef {
  if (sel.kind === "project") {
    return { kind: "project", projectId: sel.projectId };
  }
  return {
    kind: "issue",
    projectId: sel.projectId,
    issueId: sel.issueId,
  };
}

export function treeNodeToNodeRef(entry: TreeNode): NodeRef | null {
  if (entry.kind === "project") {
    return { kind: "project", projectId: entry.projectId };
  }
  if (!entry.issueId) {
    return null;
  }
  return {
    kind: "issue",
    projectId: entry.projectId,
    issueId: entry.issueId,
  };
}

export async function closePmPanelIfNodeSurface(): Promise<void> {
  if (!isPmNodeSurface()) {
    return;
  }
  await getPm().closePmPanel?.();
}
