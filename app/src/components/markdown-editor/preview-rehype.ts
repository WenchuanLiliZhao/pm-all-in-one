// ↔ markdown-preview.tsx — Reading View rehype stack (raw HTML + sanitize)
// ↔ AGENTS.md — Preview parses CommonMark HTML; comments dropped; Live stays source

import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Options as SanitizeSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export const PREVIEW_REMARK_PLUGINS = [remarkGfm, remarkMath];

/** GitHub-like schema plus plugin href schemes and remark-math class names. */
export function createPreviewSanitizeSchema(
  allowedUrlSchemes: Iterable<string>,
): SanitizeSchema {
  const extra = [...allowedUrlSchemes]
    .map((scheme) => scheme.trim().toLowerCase().replace(/:$/, ""))
    .filter(Boolean);
  return {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [["className", /^language-./, "math-inline", "math-display"]],
    },
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href ?? []), ...extra],
    },
  };
}

export function createPreviewRehypePlugins(opts: {
  allowedUrlSchemes: Iterable<string>;
  highlightPlainText: string[];
}) {
  return [
    rehypeRaw,
    [rehypeSanitize, createPreviewSanitizeSchema(opts.allowedUrlSchemes)] as [
      typeof rehypeSanitize,
      SanitizeSchema,
    ],
    [
      rehypeHighlight,
      {
        ignoreMissing: true,
        plainText: opts.highlightPlainText,
      },
    ] as [
      typeof rehypeHighlight,
      { ignoreMissing: boolean; plainText: string[] },
    ],
    [rehypeKatex, { output: "htmlAndMathml" }] as [
      typeof rehypeKatex,
      { output: "htmlAndMathml" },
    ],
  ];
}
