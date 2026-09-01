import { getPm } from "@/lib/bridge";
import type { WikiIncomingRef } from "@/lib/types";

/** Unique source pages among incoming wiki-node field refs. */
export function countIncomingWikiPages(
  refs: readonly { fromId: string }[],
): number {
  return new Set(refs.map((r) => r.fromId)).size;
}

/** Group incoming refs by field key; preserve first-seen fromId order. */
export function groupIncomingWikiRefs(
  refs: readonly WikiIncomingRef[],
): { fieldKey: string; fromIds: string[] }[] {
  const map = new Map<string, string[]>();
  for (const r of refs) {
    const list = map.get(r.fieldKey) ?? [];
    if (!list.includes(r.fromId)) {
      list.push(r.fromId);
    }
    map.set(r.fieldKey, list);
  }
  return [...map.entries()].map(([fieldKey, fromIds]) => ({
    fieldKey,
    fromIds,
  }));
}

export function incomingWikiDeleteLine(pageCount: number): string | null {
  if (pageCount <= 0) {
    return null;
  }
  const pages =
    pageCount === 1 ? "1 wiki page" : `${pageCount} wiki pages`;
  return `Also referenced by ${pages} (ids left dangling).`;
}

export async function incomingWikiDeleteDetail(
  targetId: string,
): Promise<string[]> {
  const refs = await getPm().listWikiIncomingRefs(targetId);
  const line = incomingWikiDeleteLine(countIncomingWikiPages(refs));
  return line ? [line] : [];
}
