/**
 * Table search/filter pure helpers.
 * Visibility = flattenVisible + optional keep-set (ancestors of matches).
 */
import type {
  CustomPropsSchema,
  Issue,
  IssueTree,
  Project,
} from "@/lib/types";
import { issueRefKey } from "@/lib/types";
import {
  buildCustomUnion,
  keysDeclaredForRow,
  rowSearchHaystack,
  type CustomColumn,
} from "./columns";

export type FlatRow = { nodeKey: string; depth: number };

export function normalizeTableQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function nodeMatchesQuery(
  haystack: string,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  return haystack.includes(normalizedQuery);
}

export function tableFilterState(query: string): {
  queryActive: boolean;
  dndEnabled: boolean;
} {
  const queryActive = normalizeTableQuery(query).length > 0;
  return { queryActive, dndEnabled: !queryActive };
}

/**
 * null → no filtering (empty query).
 * Otherwise every key that should remain painted (matches + ancestors).
 */
export function collectKeptKeys(args: {
  tree: IssueTree;
  issuesByKey: Map<string, Issue>;
  projectsById: Map<string, Project>;
  query: string;
  customColumns: readonly CustomColumn[];
  schemasByProject: Map<string, CustomPropsSchema>;
}): Set<string> | null {
  const normalized = normalizeTableQuery(args.query);
  if (!normalized) {
    return null;
  }

  const {
    tree,
    issuesByKey,
    projectsById,
    customColumns,
    schemasByProject,
  } = args;
  const kept = new Set<string>();

  const walk = (key: string): boolean => {
    let anyChild = false;
    for (const child of tree.children[key] ?? []) {
      if (walk(child)) {
        anyChild = true;
      }
    }

    const entry = tree.byId[key];
    if (!entry) {
      return anyChild;
    }

    const issue =
      entry.kind === "issue" && entry.issueId !== undefined
        ? (issuesByKey.get(issueRefKey(entry.projectId, entry.issueId)) ??
          null)
        : null;
    const project = projectsById.get(entry.projectId) ?? null;
    const schema = schemasByProject.get(entry.projectId);
    const declaredKeys = keysDeclaredForRow(schema, entry.level);
    const haystack = rowSearchHaystack({
      entry,
      issue,
      project,
      customColumns,
      declaredKeys,
    });
    const self = nodeMatchesQuery(haystack, normalized);
    if (self || anyChild) {
      kept.add(key);
      return true;
    }
    return false;
  };

  for (const root of tree.roots) {
    walk(root);
  }
  return kept;
}

/**
 * When keptKeys !== null, only emit kept keys and ignore collapsed
 * (force-expand kept paths so matches under collapsed ancestors stay visible).
 */
export function filterFlatRows(
  tree: IssueTree,
  collapsed: Set<string>,
  keptKeys: Set<string> | null,
): FlatRow[] {
  const rows: FlatRow[] = [];
  const walk = (key: string, depth: number): void => {
    if (keptKeys !== null && !keptKeys.has(key)) {
      return;
    }
    rows.push({ nodeKey: key, depth });
    if (keptKeys === null && collapsed.has(key)) {
      return;
    }
    for (const child of tree.children[key] ?? []) {
      walk(child, depth + 1);
    }
  };
  for (const root of tree.roots) {
    walk(root, 0);
  }
  return rows;
}

/** Convenience: build customColumns + keptKeys from schemas map. */
export function collectKeptKeysFromSchemas(args: {
  tree: IssueTree;
  issuesByKey: Map<string, Issue>;
  projectsById: Map<string, Project>;
  query: string;
  schemasByProject: Map<string, CustomPropsSchema>;
}): { customColumns: CustomColumn[]; keptKeys: Set<string> | null } {
  const customColumns = buildCustomUnion(args.schemasByProject.values());
  const keptKeys = collectKeptKeys({
    ...args,
    customColumns,
  });
  return { customColumns, keptKeys };
}
