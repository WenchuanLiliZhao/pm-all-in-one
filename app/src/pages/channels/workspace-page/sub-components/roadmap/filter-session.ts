/**
 * Roadmap filter and project focus for the open window, keyed by workspace root.
 * The roadmap route unmounts when another channel is shown, so the tree
 * cannot live only in that component. Reloading the window clears this map.
 * Nothing here is written to the workspace.
 *
 * ↔ index.tsx — read on mount, write on change
 * ↔ filter-model.ts — the tree shape
 */

import { emptyFilter, type FilterGroup } from "./filter-model";

type RoadmapMemory = {
  filter: FilterGroup;
  focusProjectId: string | null;
};

const byRoot = new Map<string, RoadmapMemory>();

function memoryFor(root: string): RoadmapMemory | undefined {
  return byRoot.get(root);
}

export function readRoadmapFilter(root: string | null): FilterGroup {
  if (!root) {
    return emptyFilter();
  }
  return memoryFor(root)?.filter ?? emptyFilter();
}

export function writeRoadmapFilter(
  root: string | null,
  filter: FilterGroup,
): void {
  if (!root) {
    return;
  }
  const prev = memoryFor(root);
  byRoot.set(root, {
    filter,
    focusProjectId: prev?.focusProjectId ?? null,
  });
}

export function readRoadmapFocus(root: string | null): string | null {
  if (!root) {
    return null;
  }
  return memoryFor(root)?.focusProjectId ?? null;
}

export function writeRoadmapFocus(
  root: string | null,
  focusProjectId: string | null,
): void {
  if (!root) {
    return;
  }
  const prev = memoryFor(root);
  byRoot.set(root, {
    filter: prev?.filter ?? emptyFilter(),
    focusProjectId,
  });
}
