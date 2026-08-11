// ↔ ./model.ts — re-exports alignOf / parseSeparatorAligns for idle HTML
// ↔ AGENTS.md — GFM table align helpers for idle projection

/** Parse separator segments (`---`, `:---`, etc.), length = colCount. */
export function parseSeparatorAligns(
  sepText: string,
  colCount: number,
): string[] {
  const inner = sepText.replace(/^\|/, "").replace(/\|$/, "");
  const raw = inner.split("|").map((s) => s.trim());
  const out: string[] = [];
  for (let i = 0; i < colCount; i++) {
    const seg = raw[i] ?? "---";
    out.push(seg.length ? seg : "---");
  }
  return out;
}

export function alignOf(seg: string): "left" | "center" | "right" {
  const s = seg.trim();
  const left = s.startsWith(":");
  const right = s.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}
