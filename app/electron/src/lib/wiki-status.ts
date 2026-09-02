/**
 * Orphan Electron-root twin of renderer wiki-status (byte-identical to src/lib).
 * ↔ src/lib/wiki-status.ts — prefer that file + electron/core/identity/wiki-status.ts
 * Props store `status: <id>`. Not issue status: no draft / cancel.
 */

export const WIKI_STATUS_IDS = ["todo", "in-progress", "done"] as const;

export type WikiStatusId = (typeof WIKI_STATUS_IDS)[number];

export interface WikiStatusDef {
  id: WikiStatusId;
  label: string;
}

export const BUILTIN_WIKI_STATUSES: readonly WikiStatusDef[] = [
  { id: "todo", label: "Todo" },
  { id: "in-progress", label: "In progress" },
  { id: "done", label: "Done" },
];

export const DEFAULT_WIKI_STATUS: WikiStatusId = "todo";

const ID_SET = new Set<string>(WIKI_STATUS_IDS);

export function isWikiStatusId(value: unknown): value is WikiStatusId {
  return typeof value === "string" && ID_SET.has(value);
}

export function normalizeWikiStatus(raw: unknown): WikiStatusId {
  return isWikiStatusId(raw) ? raw : DEFAULT_WIKI_STATUS;
}

export function wikiStatusLabel(id: WikiStatusId): string {
  return BUILTIN_WIKI_STATUSES.find((s) => s.id === id)?.label ?? id;
}
