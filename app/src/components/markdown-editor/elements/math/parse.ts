// ↔ ./live.ts — scans $…$ / $$…$$ outside code
// ↔ ./parse.test.ts — delimiter / code-skip / escape cases
// ↔ ../../extensions/live-preview.ts — same code-range skip idea as mentions

export type ByteRange = { from: number; to: number };

export type MathSpan = {
  from: number;
  to: number;
  tex: string;
  display: boolean;
};

function isWs(ch: string | undefined): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function inRanges(ranges: ByteRange[], pos: number): boolean {
  return ranges.some((r) => pos >= r.from && pos < r.to);
}

/** Odd number of backslashes immediately before `index` → the `$` is escaped. */
export function isEscapedDollar(source: string, index: number): boolean {
  let n = 0;
  for (let i = index - 1; i >= 0 && source[i] === "\\"; i--) n += 1;
  return n % 2 === 1;
}

function isEmptyTex(tex: string): boolean {
  return tex.trim() === "";
}

function lineBounds(source: string, pos: number): { from: number; to: number } {
  let from = pos;
  while (from > 0 && source[from - 1] !== "\n") from -= 1;
  let to = pos;
  while (to < source.length && source[to] !== "\n") to += 1;
  return { from, to };
}

/** True when `$$` at `pos` is the only non-space on its line (flow fence). */
function isLineOnlyDollars(source: string, pos: number): boolean {
  const { from, to } = lineBounds(source, pos);
  const before = source.slice(from, pos);
  const after = source.slice(pos + 2, to);
  return /^\s*$/.test(before) && /^\s*$/.test(after);
}

function findDisplayClose(
  source: string,
  from: number,
  codeRanges: ByteRange[],
  limit: number,
): number {
  const end = Math.min(limit, source.length);
  for (let i = from; i < end - 1; i++) {
    if (inRanges(codeRanges, i)) continue;
    if (source[i] !== "$" || source[i + 1] !== "$") continue;
    if (isEscapedDollar(source, i)) continue;
    return i;
  }
  return -1;
}

function findFlowDisplayClose(
  source: string,
  from: number,
  codeRanges: ByteRange[],
): number {
  for (let i = from; i < source.length - 1; i++) {
    if (inRanges(codeRanges, i)) continue;
    if (source[i] !== "$" || source[i + 1] !== "$") continue;
    if (isEscapedDollar(source, i)) continue;
    if (!isLineOnlyDollars(source, i)) continue;
    return i;
  }
  return -1;
}

function findInlineClose(
  source: string,
  from: number,
  codeRanges: ByteRange[],
): number {
  for (let i = from; i < source.length; i++) {
    if (source[i] === "\n") return -1;
    if (inRanges(codeRanges, i)) continue;
    if (source[i] !== "$") continue;
    if (isEscapedDollar(source, i)) continue;
    // Do not treat a `$$` pair as an inline closer.
    if (source[i + 1] === "$" || source[i - 1] === "$") continue;
    if (isWs(source[i - 1])) continue;
    return i;
  }
  return -1;
}

/**
 * Find `$…$` (inline, same line) and `$$…$$` (display) spans.
 * A pair counts only when the tex is non-empty (after trim). Lone `$$` while
 * typing must not swallow a later formula: same-line `$$…$$` first; flow
 * `$$` only when each fence is alone on its line. Empty pairs do not consume
 * the closer, so formulas below stay intact.
 */
export function findMathSpans(
  source: string,
  codeRanges: ByteRange[] = [],
): MathSpan[] {
  const spans: MathSpan[] = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    if (inRanges(codeRanges, i)) {
      const hit = codeRanges.find((r) => i >= r.from && i < r.to);
      i = hit ? hit.to : i + 1;
      continue;
    }
    if (source[i] !== "$") {
      i += 1;
      continue;
    }
    if (isEscapedDollar(source, i)) {
      i += 1;
      continue;
    }

    if (source[i + 1] === "$" && !isEscapedDollar(source, i + 1)) {
      const lineTo = lineBounds(source, i).to;
      const closeSame = findDisplayClose(source, i + 2, codeRanges, lineTo);
      if (closeSame !== -1) {
        const tex = source.slice(i + 2, closeSame);
        if (!isEmptyTex(tex)) {
          spans.push({ from: i, to: closeSame + 2, tex, display: true });
          i = closeSame + 2;
          continue;
        }
        i += 2;
        continue;
      }
      if (isLineOnlyDollars(source, i)) {
        const closeFlow = findFlowDisplayClose(source, i + 2, codeRanges);
        if (closeFlow !== -1) {
          const tex = source.slice(i + 2, closeFlow);
          // A later complete `$…$` / `$$…$$` inside means this closer belongs
          // to a formula below — do not swallow it.
          if (!isEmptyTex(tex) && findMathSpans(tex).length === 0) {
            spans.push({ from: i, to: closeFlow + 2, tex, display: true });
            i = closeFlow + 2;
            continue;
          }
        }
      }
      i += 2;
      continue;
    }

    if (isWs(source[i + 1])) {
      i += 1;
      continue;
    }
    const close = findInlineClose(source, i + 1, codeRanges);
    if (close === -1) {
      i += 1;
      continue;
    }
    const tex = source.slice(i + 1, close);
    if (isEmptyTex(tex)) {
      i += 1;
      continue;
    }
    spans.push({
      from: i,
      to: close + 1,
      tex,
      display: false,
    });
    i = close + 1;
  }
  return spans;
}
