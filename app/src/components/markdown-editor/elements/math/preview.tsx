// ↔ ./index.ts — mathPreviewComponents
// ↔ ./preview.module.scss — KaTeX token remap
// ↔ ./live.ts — Live twin
// ↔ ../../markdown-preview.tsx — remark-math + rehype-katex emit .katex trees

import type { Components } from "react-markdown";

/**
 * rehype-katex already emits `.katex` / `.katex-display` trees. Stylesheet
 * import lives in `index.ts` so Live widgets and Reading View share one load.
 */
export const mathPreviewComponents: Components = {};
