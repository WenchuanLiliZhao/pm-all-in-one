import * as vscode from "vscode";
import type { PmWorkspaceCatalogItem } from "./pick-pm-workspace";

function nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildCatalogHtml(
  webview: vscode.Webview,
  items: PmWorkspaceCatalogItem[],
): string {
  const token = nonce();
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource} 'nonce-${token}'`,
  ].join("; ");
  const payload = JSON.stringify(items);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>
    /* Same seed-and-derive scheme as app/src/global-styles/color-use-vscode.scss:
       editor fg/bg seeds, neutrals via color-mix so the ramp matches the map. */
    html, body {
      --fg: var(--vscode-editor-foreground, var(--vscode-foreground));
      --bg: var(--vscode-editor-background);
      --fg-secondary: color-mix(in srgb, var(--fg) 60%, var(--bg));
      margin: 0;
      height: 100%;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--fg);
      background: var(--bg);
    }
    main {
      box-sizing: border-box;
      max-width: 44rem;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 2rem;
    }
    h1 {
      margin: 0 0 0.35rem;
      font-size: 1.15rem;
      font-weight: 600;
    }
    .lead {
      margin: 0 0 1rem;
      color: var(--fg-secondary);
    }
    #list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .row {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.15rem;
      width: 100%;
      margin: 0;
      padding: 0.65rem 0.75rem;
      border: 1px solid color-mix(in srgb, var(--fg) 8%, var(--bg));
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .row:hover {
      background: color-mix(in srgb, var(--fg) 5%, transparent);
      border-color: color-mix(in srgb, var(--fg) 14%, var(--bg));
    }
    .row:active {
      background: color-mix(in srgb, var(--fg) 8%, transparent);
    }
    .row:focus-visible {
      outline: 1px solid color-mix(in srgb, var(--fg) 22%, var(--bg));
      outline-offset: 1px;
    }
    .title {
      font-weight: 600;
    }
    .path {
      color: var(--fg-secondary);
      font-size: 0.9em;
    }
    .empty {
      color: var(--fg-secondary);
    }
  </style>
</head>
<body>
  <main>
    <h1>PM workspaces</h1>
    <p class="lead">Open a library map</p>
    <div id="list"></div>
  </main>
  <script nonce="${token}">
    const items = ${payload};
    const vscode = acquireVsCodeApi();
    const list = document.getElementById("list");
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No PM workspace found.";
      list.append(empty);
    } else {
      for (const item of items) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "row";
        const title = document.createElement("span");
        title.className = "title";
        title.textContent = item.title;
        const rel = document.createElement("span");
        rel.className = "path";
        rel.textContent = item.relative;
        btn.append(title, rel);
        btn.addEventListener("click", () => {
          vscode.postMessage({ type: "open", root: item.root });
        });
        list.append(btn);
      }
    }
  </script>
</body>
</html>`;
}
