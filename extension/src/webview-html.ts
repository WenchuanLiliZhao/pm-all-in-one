import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { NodeRef } from "./resolve-pm-node";

function nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function rewriteRelative(
  html: string,
  webview: vscode.Webview,
  webviewRoot: vscode.Uri,
): string {
  return html.replace(
    /(src|href)="(\.\/[^"]+)"/g,
    (_all, attr: string, rel: string) => {
      const uri = webview.asWebviewUri(
        vscode.Uri.joinPath(webviewRoot, rel.replace(/^\.\//, "")),
      );
      return `${attr}="${uri}"`;
    },
  );
}

export function hashForPmSurface(
  surface: "map" | "node",
  nodeRef: NodeRef | null,
): string {
  if (surface === "map" || !nodeRef) {
    return "#/w/home";
  }
  switch (nodeRef.kind) {
    case "workspace":
      return "#/n/home";
    case "wiki":
      return `#/n/wiki/${nodeRef.wikiNodeId}`;
    case "project":
      return `#/n/projects/${nodeRef.projectId}`;
    case "issue":
      return `#/n/issues/${nodeRef.projectId}/${nodeRef.issueId}`;
    case "member":
      return `#/n/members/${nodeRef.memberId}`;
    case "handoff":
      return `#/n/handoffs/${nodeRef.handoffId}`;
    default: {
      const _exhaustive: never = nodeRef;
      void _exhaustive;
      return "#/w/home";
    }
  }
}

export function buildWebviewHtml(opts: {
  webview: vscode.Webview;
  extensionUri: vscode.Uri;
  workspaceRoot: string;
  surface: "map" | "node";
  nodeRef: NodeRef | null;
}): string {
  const webviewRoot = vscode.Uri.joinPath(
    opts.extensionUri,
    "media",
    "webview",
  );
  const indexPath = path.join(opts.extensionUri.fsPath, "media", "webview", "index.html");
  if (!fs.existsSync(indexPath)) {
    return `<!doctype html><html><body><p>PM webview is not built. Run <code>npm run compile</code> in the extension folder.</p></body></html>`;
  }
  const token = nonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${opts.webview.cspSource} data: blob: https:`,
    `style-src ${opts.webview.cspSource} 'unsafe-inline'`,
    `font-src ${opts.webview.cspSource} data:`,
    `script-src ${opts.webview.cspSource} 'nonce-${token}' 'unsafe-eval'`,
    `connect-src ${opts.webview.cspSource} data: blob:`,
    `worker-src ${opts.webview.cspSource} blob:`,
  ].join("; ");

  let html = fs.readFileSync(indexPath, "utf8");
  html = rewriteRelative(html, opts.webview, webviewRoot);
  // Bake the host flag on `<html>` so color-use-vscode.scss matches before any
  // script runs (and if the nonce script is blocked). VS Code still injects
  // `--vscode-*` on this same documentElement.
  html = html.replace(/<html\b/i, '<html data-pm-host="vscode"');
  // Also set it from a head script in case a later navigation drops attributes.
  html = html.replace(
    "<head>",
    `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <script nonce="${token}">document.documentElement.setAttribute("data-pm-host","vscode");</script>`,
  );

  const bridge = opts.webview.asWebviewUri(
    vscode.Uri.joinPath(opts.extensionUri, "media", "vscode-pm.js"),
  );
  const assetBase = opts.webview.asWebviewUri(
    vscode.Uri.file(opts.workspaceRoot),
  );
  const hash = hashForPmSurface(opts.surface, opts.nodeRef);
  const boot = `<script nonce="${token}">
window.__pmWorkspaceRoot = ${JSON.stringify(opts.workspaceRoot)};
window.__pmAssetBase = ${JSON.stringify(assetBase.toString())};
window.__pmSurface = ${JSON.stringify(opts.surface)};
window.__pmNodeRef = ${JSON.stringify(opts.nodeRef)};
window.location.hash = ${JSON.stringify(hash)};
</script>
<script nonce="${token}" src="${bridge}"></script>`;

  html = html.replace("<body>", `<body>\n${boot}`);
  html = html.replace(
    /<script(?![^>]*\bnonce=)/g,
    `<script nonce="${token}" `,
  );
  return html;
}
