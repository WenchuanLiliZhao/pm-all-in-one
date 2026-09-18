import * as path from "node:path";
import * as vscode from "vscode";
import { buildCatalogHtml } from "./catalog-html";
import {
  listPmWorkspaceCatalog,
  markerUriForRoot,
} from "./pick-pm-workspace";

export const CATALOG_PANEL_TYPE = "pm-all-in-one.catalogPanel";

type MapOpener = {
  open: (marker: vscode.Uri) => Promise<void>;
};

export class CatalogPanelHost {
  private panel: vscode.WebviewPanel | undefined;
  private allowed = new Set<string>();

  constructor(private readonly maps: MapOpener) {}

  async open(scanRoots: string[]): Promise<void> {
    const items = await listPmWorkspaceCatalog(scanRoots);
    this.allowed = new Set(items.map((item) => path.resolve(item.root)));

    if (this.panel) {
      this.panel.webview.html = buildCatalogHtml(this.panel.webview, items);
      this.panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      CATALOG_PANEL_TYPE,
      "PM workspaces",
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel = panel;
    panel.onDidDispose(() => {
      this.panel = undefined;
      this.allowed.clear();
    });
    panel.webview.onDidReceiveMessage(async (msg: unknown) => {
      if (!msg || typeof msg !== "object") {
        return;
      }
      const body = msg as { type?: unknown; root?: unknown };
      if (body.type !== "open" || typeof body.root !== "string") {
        return;
      }
      const root = path.resolve(body.root);
      if (!this.allowed.has(root)) {
        return;
      }
      await this.maps.open(markerUriForRoot(root));
    });
    panel.webview.html = buildCatalogHtml(panel.webview, items);
  }
}
