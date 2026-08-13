// ↔ ./live.ts — idle mermaid fence vs ordinary code chrome
// ↔ ./preview.tsx — Reading View language-mermaid branch
// ↔ ./mermaid-info.test.ts — exact match after trim, case-insensitive

/** True when a fence info string / `language-*` class is exactly `mermaid`. */
export function isMermaidLang(info: string | undefined | null): boolean {
  return (info ?? "").trim().toLowerCase() === "mermaid";
}
