/**
 * Host chrome theme subscription (Electron + vscode / Cursor webview).
 *
 * Aliases: vscode-theme, cursor-theme, --vscode-, host adapter
 *
 * Color values: components still read `--color-use--*`. On the vscode host,
 * `color-use-vscode.scss` remaps those to `--vscode-*`. This module does
 * **not** write color tokens.
 *
 * Early `data-theme` writer: `extension/media/vscode-pm.js` (runs before
 * React so shadows / mermaid do not FOUC). This file is the in-app
 * subscriber SoT for JS that caches computed colors (xterm) or mermaid’s
 * dark / default split.
 *
 * Electron: body never has vscode-* classes; observers on those attrs
 * never fire. `data-theme` + prefers-color-scheme still work.
 *
 * ↔ global-styles/color-use-vscode.scss — CSS remap (html[data-pm-host=vscode])
 * ↔ extension/media/vscode-pm.js — early data-theme lock from IDE kind
 */

/** True when the Cursor / VS Code webview boot set `data-pm-host="vscode"`. */
export function isVscodePmHost(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-pm-host") === "vscode";
}

/**
 * Re-run `cb` when the host chrome theme may have changed.
 *
 * Watches `html[data-theme]`, vscode body kind/name/class (same-kind theme
 * switches such as two dark themes), and `prefers-color-scheme`.
 */
export function subscribeHostTheme(cb: () => void): () => void {
  if (typeof document === "undefined") return () => {};

  let scheduled = false;
  const fire = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      cb();
    });
  };

  const root = document.documentElement;
  const rootMo = new MutationObserver(fire);
  rootMo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  const bodyMo = new MutationObserver(fire);
  if (document.body) {
    bodyMo.observe(document.body, {
      attributes: true,
      attributeFilter: [
        "class",
        "data-vscode-theme-kind",
        "data-vscode-theme-name",
      ],
    });
  }

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", fire);

  return () => {
    rootMo.disconnect();
    bodyMo.disconnect();
    mq.removeEventListener("change", fire);
  };
}
