import { canReparentPreservingLevel, type LadderRow } from "@pm-core/ladder";
import type { Issue, IssueTree, MoveIssueInput } from "@/lib/types";
import { issueRefKey } from "@/lib/types";

export type DropZone = "before" | "after" | "into";

export type DropIntent =
  | {
      kind: "reorder";
      parentKey: string | null;
      activeId: string;
      overId: string;
    }
  | {
      kind: "reparent";
      activeId: string;
      fromParentKey: string | null;
      /** Tree parent key: project key or issueRefKey; null only for epic under project → ladder null. */
      toParentKey: string | null;
      beforeId: string | null;
      move: MoveIssueInput;
    }
  | { kind: "reject"; reason: string };

export function parentKeyOf(tree: IssueTree, key: string): string | null {
  if (tree.roots.includes(key)) {
    return null;
  }
  for (const [parent, kids] of Object.entries(tree.children)) {
    if (kids.includes(key)) {
      return parent;
    }
  }
  return null;
}

/**
 * Sibling-group parent implied by dropping on `overId` in `zone`.
 * - into → over becomes the parent of the group
 * - before/after → over's parent is the group parent (null = project roots)
 */
export function dropGroupParentKey(
  tree: IssueTree,
  overId: string,
  zone: DropZone,
): string | null {
  if (zone === "into") {
    return overId;
  }
  return parentKeyOf(tree, overId);
}

/** Parent row + its direct children (the reorder/reparent sibling group). */
export function dropGroupMemberKeys(
  tree: IssueTree,
  groupParentKey: string | null,
): ReadonlySet<string> {
  const kids =
    groupParentKey === null
      ? tree.roots
      : (tree.children[groupParentKey] ?? []);
  const keys = new Set<string>(kids);
  if (groupParentKey !== null) {
    keys.add(groupParentKey);
  }
  return keys;
}

export function ladderRowsFromIssues(issues: readonly Issue[]): LadderRow[] {
  return issues.map((issue) => ({
    key: issueRefKey(issue.projectId, issue.id),
    level: issue.level,
    parentKey:
      issue.parentId === null
        ? null
        : issueRefKey(issue.projectId, issue.parentId),
  }));
}

/**
 * Resolve a drag of `activeId` over `overId` with a vertical zone.
 * `into` = nest under over; before/after = sibling of over under over's parent.
 */
export function resolveDropIntent(
  tree: IssueTree,
  issues: readonly Issue[],
  activeId: string,
  overId: string,
  zone: DropZone,
): DropIntent {
  if (activeId === overId) {
    return { kind: "reject", reason: "same row" };
  }
  const active = tree.byId[activeId];
  const over = tree.byId[overId];
  if (!active || !over) {
    return { kind: "reject", reason: "unknown node" };
  }

  if (active.kind === "project") {
    if (over.kind !== "project") {
      return { kind: "reject", reason: "projects only reorder among projects" };
    }
    if (zone === "into") {
      return { kind: "reject", reason: "cannot nest a project" };
    }
    return {
      kind: "reorder",
      parentKey: null,
      activeId,
      overId,
    };
  }

  // active is issue
  if (active.issueId === undefined || active.level === undefined) {
    return { kind: "reject", reason: "invalid issue" };
  }

  if (over.kind === "project" || over.projectId !== active.projectId) {
    // Only epics may sit directly under a project; and only as reorder among
    // that project's children — never cross-project.
    if (over.kind === "project" && over.projectId === active.projectId) {
      if (active.level !== "epic") {
        return {
          kind: "reject",
          reason: "only epics can sit under a project",
        };
      }
      if (zone === "into") {
        // into project = become child of project = epic under project
        const fromParentKey = parentKeyOf(tree, activeId);
        if (fromParentKey === over.key) {
          return { kind: "reject", reason: "already under project" };
        }
        // Epics already have ladder parent null; moving between projects isn't
        // allowed. Same project into project is a no-op structurally — treat as
        // reorder among project children if we have a before target later.
        return { kind: "reject", reason: "use before/after on a sibling epic" };
      }
      // before/after a project row while dragging an epic: reorder among roots? No —
      // epics are children of the project, not roots. Reject dropping relative to
      // project row except we could interpret as reorder within that project —
      // use into-only for project. Prefer before/after sibling epics.
      return { kind: "reject", reason: "drop relative to an epic sibling" };
    }
    return { kind: "reject", reason: "cross-project move forbidden" };
  }

  const fromParentKey = parentKeyOf(tree, activeId);
  const rows = ladderRowsFromIssues(issues);
  const activeLadderKey = issueRefKey(active.projectId, active.issueId);

  if (zone === "into") {
    if (over.kind !== "issue" || over.issueId === undefined) {
      return { kind: "reject", reason: "cannot nest into project this way" };
    }
    const toLadderParent = issueRefKey(over.projectId, over.issueId);
    if (fromParentKey === over.key) {
      return { kind: "reject", reason: "already a child" };
    }
    if (!canReparentPreservingLevel(rows, activeLadderKey, toLadderParent)) {
      return { kind: "reject", reason: "would change level" };
    }
    return {
      kind: "reparent",
      activeId,
      fromParentKey,
      toParentKey: over.key,
      beforeId: null,
      move: {
        projectId: active.projectId,
        issueId: active.issueId,
        newParentIssueId: over.issueId,
      },
    };
  }

  // before / after → sibling of `over`
  const overParent = parentKeyOf(tree, overId);
  if (overParent === fromParentKey) {
    return {
      kind: "reorder",
      parentKey: fromParentKey,
      activeId,
      overId,
    };
  }

  // Reparent to over's parent, insert before/after over
  let toLadderParent: string | null;
  let newParentIssueId: string | null;
  if (overParent === null) {
    // over is a project root — shouldn't happen for issues
    return { kind: "reject", reason: "invalid over parent" };
  }
  const overParentNode = tree.byId[overParent];
  if (!overParentNode) {
    return { kind: "reject", reason: "missing over parent" };
  }
  if (overParentNode.kind === "project") {
    toLadderParent = null;
    newParentIssueId = null;
  } else if (overParentNode.issueId !== undefined) {
    toLadderParent = issueRefKey(
      overParentNode.projectId,
      overParentNode.issueId,
    );
    newParentIssueId = overParentNode.issueId;
  } else {
    return { kind: "reject", reason: "bad parent node" };
  }

  if (!canReparentPreservingLevel(rows, activeLadderKey, toLadderParent)) {
    return { kind: "reject", reason: "would change level" };
  }

  const beforeId = zone === "before" ? overId : nextSiblingAfter(tree, overId);
  return {
    kind: "reparent",
    activeId,
    fromParentKey,
    toParentKey: overParent,
    beforeId,
    move: {
      projectId: active.projectId,
      issueId: active.issueId,
      newParentIssueId,
    },
  };
}

function nextSiblingAfter(tree: IssueTree, key: string): string | null {
  const parent = parentKeyOf(tree, key);
  const list =
    parent === null ? tree.roots : (tree.children[parent] ?? []);
  const idx = list.indexOf(key);
  if (idx < 0 || idx + 1 >= list.length) {
    return null;
  }
  return list[idx + 1]!;
}

/** Map pointer Y within a row to before / into / after (40/20/40). */
export function zoneFromPointerY(
  clientY: number,
  rowTop: number,
  rowHeight: number,
): DropZone {
  const y = clientY - rowTop;
  const ratio = rowHeight <= 0 ? 0.5 : y / rowHeight;
  if (ratio < 0.4) {
    return "before";
  }
  if (ratio > 0.6) {
    return "after";
  }
  return "into";
}

/**
 * Prefer the live DOM box (post-transform) over dnd-kit's layout rect, which
 * can disagree with the painted row while Sortable is translating siblings.
 *
 * `CSS.escape` must use the global `window.CSS` — files that import
 * `CSS` from `@dnd-kit/utilities` shadow the name.
 */
export function zoneFromOverTarget(
  clientY: number,
  overId: string,
  fallback: { top: number; height: number },
): DropZone {
  const escape =
    typeof globalThis.CSS?.escape === "function"
      ? globalThis.CSS.escape
      : (s: string) => s.replace(/"/g, '\\"');
  const el = document.querySelector<HTMLElement>(
    `[data-dnd-key="${escape(overId)}"]`,
  );
  if (el) {
    const rect = el.getBoundingClientRect();
    return zoneFromPointerY(clientY, rect.top, rect.height);
  }
  return zoneFromPointerY(clientY, fallback.top, fallback.height);
}

/**
 * closestCenter / stale pointer Y often report the wrong edge zone:
 * - dragging up onto a row above → "after" (no-op / wrong); remap to "before"
 * - dragging down onto a row below → "before" (lands above target); remap to "after"
 * Keep "into" so nesting under that row still works.
 */
export function adjustZoneForVerticalReorder(
  zone: DropZone,
  activeId: string,
  overId: string,
  deltaY: number,
  visualOrderIds: readonly string[],
): DropZone {
  const activeIndex = visualOrderIds.indexOf(activeId);
  const overIndex = visualOrderIds.indexOf(overId);
  if (activeIndex < 0 || overIndex < 0) {
    return zone;
  }
  if (deltaY < 0 && zone === "after" && overIndex < activeIndex) {
    return "before";
  }
  if (deltaY > 0 && zone === "before" && overIndex > activeIndex) {
    return "after";
  }
  return zone;
}
