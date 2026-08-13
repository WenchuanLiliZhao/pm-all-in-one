// ↔ ./live.ts — idle FencedCode header replaced by this widget
// ↔ ./mermaid-render.ts — async SVG / error
// ↔ ./preview.tsx — Reading View twin (same renderer)

import { WidgetType } from "@codemirror/view";
import {
  applyMermaidSvg,
  mermaidColorTheme,
  renderMermaidSvg,
  subscribeMermaidTheme,
  type MermaidColorTheme,
} from "./mermaid-render";

type HostEl = HTMLElement & {
  _mermaidStale?: boolean;
  _mermaidGen?: number;
  _unsubTheme?: () => void;
};

function paintMermaid(host: HostEl, source: string, theme: MermaidColorTheme) {
  const gen = (host._mermaidGen = (host._mermaidGen ?? 0) + 1);
  host.className = "cm-md-mermaid";
  host.textContent = "Rendering…";
  void renderMermaidSvg(source, theme).then((result) => {
    if (host._mermaidStale || host._mermaidGen !== gen) return;
    if (result.ok) {
      host.className = "cm-md-mermaid";
      applyMermaidSvg(host, result.svg);
    } else {
      host.className = "cm-md-mermaid cm-md-mermaid-error";
      host.textContent = result.error;
    }
  });
}

/** Idle mermaid diagram (or parse error). Clicks fall through to parent CM. */
export class MermaidWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly theme: MermaidColorTheme,
  ) {
    super();
  }

  eq(other: MermaidWidget) {
    return other.source === this.source && other.theme === this.theme;
  }

  toDOM() {
    // Inline span — a block `div` forces cm-widgetBuffer onto its own line.
    const host = document.createElement("span") as HostEl;
    paintMermaid(host, this.source, this.theme);
    const unsub = subscribeMermaidTheme(() => {
      if (host._mermaidStale) return;
      paintMermaid(host, this.source, mermaidColorTheme());
    });
    host._unsubTheme = unsub;
    return host;
  }

  destroy(dom: HTMLElement) {
    const host = dom as HostEl;
    host._mermaidStale = true;
    host._unsubTheme?.();
  }

  ignoreEvent() {
    return false;
  }
}
