// ↔ src/components/markdown-editor/types.ts — MarkdownPlugin.fences
// ↔ src/components/markdown-editor/AGENTS.md — § Reading View fence plugins
// ↔ ./inject-type.ts — info-string second token → YAML type
// ↔ ./preview.tsx — Reading View mount / teardown
// ↔ ./vendor/calc-kit.js — vendored renderer (no plot npm dep)

import type { MarkdownPlugin } from "@/components/markdown-editor";
import { injectPlotFenceType } from "./inject-type";
import { PlotFencePreview } from "./preview";

export const plotFencePlugin: MarkdownPlugin = {
  transformSource: injectPlotFenceType,
  fences: [
    { lang: "plot", component: PlotFencePreview, interactive: true },
  ],
};
