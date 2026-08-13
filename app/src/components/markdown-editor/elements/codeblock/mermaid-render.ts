// ↔ ./mermaid-widget.ts — Live idle SVG / error
// ↔ ./preview.tsx — Reading View host
// ↔ ./mermaid-info.ts — lang gate lives there (this file only renders)

export type MermaidColorTheme = "dark" | "default";

export type MermaidRenderResult =
  | { ok: true; svg: string }
  | { ok: false; error: string };

type MermaidApi = {
  initialize: (config: {
    startOnLoad: boolean;
    securityLevel: "strict" | "loose" | "antiscript" | "sandbox";
    theme: MermaidColorTheme;
  }) => void;
  render: (
    id: string,
    source: string,
  ) => Promise<{ svg: string }>;
};

let mermaidApi: MermaidApi | null = null;
let initTheme: MermaidColorTheme | null = null;
let idSeq = 0;

/** App chrome theme → mermaid `dark` / `default`. */
export function mermaidColorTheme(): MermaidColorTheme {
  if (typeof document === "undefined") return "default";
  const locked = document.documentElement.dataset.theme;
  if (locked === "dark") return "dark";
  if (locked === "light") return "default";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "default";
}

/** Re-run `cb` when `data-theme` or OS color-scheme changes. */
export function subscribeMermaidTheme(cb: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", cb);
  };
}

async function getMermaid(theme: MermaidColorTheme): Promise<MermaidApi> {
  if (!mermaidApi) {
    const mod = await import("mermaid");
    mermaidApi = mod.default as unknown as MermaidApi;
  }
  if (initTheme !== theme) {
    mermaidApi.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
    });
    initTheme = theme;
  }
  return mermaidApi;
}

export async function renderMermaidSvg(
  source: string,
  theme: MermaidColorTheme = mermaidColorTheme(),
): Promise<MermaidRenderResult> {
  const trimmed = source.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty mermaid diagram" };
  }
  try {
    const mermaid = await getMermaid(theme);
    const id = `md-mermaid-${++idSeq}`;
    const { svg } = await mermaid.render(id, trimmed);
    return { ok: true, svg };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to render mermaid";
    return { ok: false, error: message };
  }
}

/**
 * Mermaid often emits `width="100%"` (and a px `max-width`). Stretching that
 * to the editor column blows up a narrow flowchart. Size from viewBox instead:
 * intrinsic px, shrink only when the host is narrower.
 */
export function applyMermaidSvg(host: HTMLElement, svg: string) {
  host.innerHTML = svg;
  const el = host.querySelector("svg");
  if (!(el instanceof SVGElement)) return;
  el.removeAttribute("width");
  el.removeAttribute("height");
  const parts = el.getAttribute("viewBox")?.trim().split(/[\s,]+/);
  const vbW = parts && parts.length === 4 ? Number(parts[2]) : NaN;
  el.style.width = Number.isFinite(vbW) && vbW > 0 ? `${vbW}px` : "auto";
  el.style.height = "auto";
  el.style.maxWidth = "100%";
}
