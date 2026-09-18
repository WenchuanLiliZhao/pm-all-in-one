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
    html, body {
      margin: 0;
      height: 100%;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
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
      color: var(--vscode-descriptionForeground);
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
      border: 1px solid var(--vscode-widget-border, transparent);
      border-radius: 4px;
      background: var(--vscode-list-inactiveSelectionBackground, transparent);
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .row:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .row:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    .title {
      font-weight: 600;
    }
    .path {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }
    .empty {
      color: var(--vscode-descriptionForeground);
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
