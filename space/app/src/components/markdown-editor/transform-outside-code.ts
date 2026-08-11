// ↔ ./merge-plugins.ts — Reading View transformSource chain
// ↔ src/lib/markdown/*-link-plugin.tsx — product adapters use this helper
// ↔ AGENTS.md — @mentions must stay literal inside code

const FENCE_SRC =
  "^ {0,3}(`{3,}|~{3,})[^\\n]*\\n[\\s\\S]*?^ {0,3}\\1[^\\S\\n]*(?:\\n|$)";
/** Inline code: one or more backticks, matching closer of the same length. */
const INLINE_CODE_SRC = "(`+)((?:(?!\\1).|[\\n])+?)\\1";

const MASK_PREFIX = "\uE000PMCODE";
const MASK_SUFFIX = "\uE001";
const UNMASK_RE = /\uE000PMCODE(\d+)\uE001/g;

/**
 * Run a global regex replace only outside fenced and inline code spans.
 * Mentions / adapters must not turn `` `@issue-…` `` into chips.
 */
export function replaceOutsideCode(
  source: string,
  pattern: RegExp,
  replacer: (match: string, ...groups: string[]) => string,
): string {
  const masks: string[] = [];
  const mask = (segment: string): string => {
    const i = masks.length;
    masks.push(segment);
    return `${MASK_PREFIX}${i}${MASK_SUFFIX}`;
  };

  let out = source
    .replace(new RegExp(FENCE_SRC, "gm"), mask)
    .replace(new RegExp(INLINE_CODE_SRC, "g"), mask);

  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);

  let rebuilt = "";
  let last = 0;
  for (const m of out.matchAll(re)) {
    const index = m.index ?? 0;
    rebuilt += out.slice(last, index);
    rebuilt += replacer(m[0], ...m.slice(1));
    last = index + m[0].length;
  }
  rebuilt += out.slice(last);

  return rebuilt.replace(UNMASK_RE, (_m, i: string) => masks[Number(i)] ?? "");
}
