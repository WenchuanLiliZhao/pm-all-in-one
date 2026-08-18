// ↔ src/components/markdown-editor/inline-fragment.ts — title/caption $…$ = body math
import { renderInlineMarkdownFragment } from "@/components/markdown-editor";
import type { CalcKitFigureApi, CalcKitSpec } from "./vendor/calc-kit.js";
import { components, makeFigureApi } from "./vendor/calc-kit.js";

function setInlineMarkdown(el: HTMLElement, text: string): void {
  el.innerHTML = renderInlineMarkdownFragment(text);
}

export function buildFigureElement(spec: CalcKitSpec): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "ck-figure";

  const head = document.createElement("div");
  head.className = "ck-figure-head";
  if (spec.title) {
    const title = document.createElement("span");
    title.className = "ck-figure-title";
    setInlineMarkdown(title, spec.title);
    head.appendChild(title);
  }
  const readout = document.createElement("span");
  readout.className = "ck-figure-readout";
  readout.setAttribute("data-ck-readout", "");
  head.appendChild(readout);
  figure.appendChild(head);

  const body = document.createElement("div");
  body.className = "ck-figure-body";
  const canvas = document.createElement("canvas");
  const heightClass =
    spec.height === "tall"
      ? " is-tall"
      : spec.height === "short"
        ? " is-short"
        : "";
  canvas.className = `ck-canvas${heightClass}`;
  canvas.setAttribute("data-ck-canvas", "");
  body.appendChild(canvas);
  figure.appendChild(body);

  const controls = document.createElement("div");
  controls.className = "ck-controls";
  controls.setAttribute("data-ck-controls", "");
  controls.hidden = true;
  figure.appendChild(controls);

  if (spec.caption) {
    const cap = document.createElement("figcaption");
    cap.className = "ck-figure-caption";
    setInlineMarkdown(cap, spec.caption);
    figure.appendChild(cap);
  }

  return figure;
}

export function knownPlotType(type: string | undefined): boolean {
  return Boolean(type && components[type]);
}

/**
 * Mount a calc-kit component into a figure element built by `buildFigureElement`.
 * Returns teardown: disconnect resize/theme observers and drop host DOM.
 */
export function mountPlotFigure(
  el: HTMLElement,
  spec: CalcKitSpec,
): () => void {
  const type = spec.type;
  if (!type || !components[type]) {
    throw new Error(
      type ? `Unknown figure type "${type}"` : "Plot fence is missing type",
    );
  }
  const fig: CalcKitFigureApi = makeFigureApi(el);
  try {
    components[type](fig, spec);
  } catch (err) {
    fig._teardownResize?.();
    throw err;
  }
  return () => {
    fig._teardownResize?.();
    el.replaceChildren();
  };
}
