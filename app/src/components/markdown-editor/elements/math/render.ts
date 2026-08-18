// ↔ ./live.ts — idle widget HTML
// ↔ ./preview.tsx — Reading View uses rehype-katex (same KaTeX options)

import katex from "katex";

export type MathRenderResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

export function renderMath(tex: string, display: boolean): MathRenderResult {
  try {
    const html = katex.renderToString(tex, {
      throwOnError: true,
      displayMode: display,
      output: "htmlAndMathml",
    });
    return { ok: true, html };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
