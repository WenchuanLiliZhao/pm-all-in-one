// ↔ ../index.ts — registered in elementPreviewComponents + createElementLiveExtensions
// ↔ ./live.ts — Live idle KaTeX widgets
// ↔ ./preview.tsx — Reading View stylesheet import
// ↔ ./parse.ts — delimiter scanner
// ↔ ./render.ts — shared KaTeX wrapper

import "katex/dist/katex.min.css";
import styles from "./preview.module.scss";

void styles;

export { mathPreviewComponents } from "./preview";
export { createMathLiveExtensions } from "./live";
