import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { buildWebviewHtml } from "./webview-html";
import { WorkspaceSessionRegistry } from "./workspace-session-registry";
import { createPmWorkspace } from "./new-workspace";
import {
  labelForNodeRef,
  resolvePmNodeReadme,
  type NodeRef,
} from "./resolve-pm-node";

export const MAP_VIEW_TYPE = "pm-all-in-one.workspace";
export const NODE_VIEW_TYPE = "pm-all-in-one.node";
/** Untied to a file URI so the tab can show the workspace title, not `.pmws`. */
export const MAP_PANEL_TYPE = "pm-all-in-one.mapPanel";
/** Untied to a file URI so opening a node does not expand Explorer. */
export const NODE_PANEL_TYPE = "pm-all-in-one.nodePanel";

class PmDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}
  dispose(): void {}
}

function workspaceRootFromMarker(uri: vscode.Uri): string {
  return path.dirname(uri.fsPath);
}

function workspaceTabTitle(
  meta: { title?: string } | null | undefined,
  fallback: string,
): string {
  const trimmed = meta?.title?.trim();
  return trimmed || fallback;
}

function makeUi() {
  return {
    async pickDirectory(title?: string) {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: title ?? "Choose folder",
        openLabel: "Select",
      });
      return picked?.[0]?.fsPath ?? null;
    },
    async pickAssetPaths() {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: true,
        title: "Add assets",
      });
      return picked?.map((u) => u.fsPath) ?? [];
    },
    async confirmDangerous(opts: {
      title: string;
      message: string;
      detail?: string;
    }) {
      const body = opts.detail
        ? `${opts.message}\n\n${opts.detail}`
        : opts.message;
      const choice = await vscode.window.showWarningMessage(
        body,
        { modal: true },
        "Delete",
      );
      return choice === "Delete";
    },
    async confirmUnsavedLeave(opts: {
      title: string;
      message: string;
      detail?: string;
    }) {
      const body = opts.detail
        ? `${opts.message}\n\n${opts.detail}`
        : opts.message;
      const choice = await vscode.window.showWarningMessage(
        body,
        { modal: true },
        "Save",
        "Discard",
      );
      if (choice === "Save") {
        return "save" as const;
      }
      if (choice === "Discard") {
        return "discard" as const;
      }
      return "cancel" as const;
    },
    async revealPath(targetPath: string) {
      await vscode.commands.executeCommand(
        "revealFileInOS",
        vscode.Uri.file(path.resolve(targetPath)),
      );
      return true;
    },
    async openPath(targetPath: string) {
      return vscode.env.openExternal(vscode.Uri.file(path.resolve(targetPath)));
    },
  };
}

function configureEnv(context: vscode.ExtensionContext): void {
  const storage = context.globalStorageUri.fsPath;
  fs.mkdirSync(storage, { recursive: true });
  process.env.LOCAL_PM_USER_DATA = storage;

  const bundledWorkspace = path.join(
    context.extensionPath,
    "templates",
    "workspace-template",
  );
  const bundledProject = path.join(
    context.extensionPath,
    "templates",
    "project-template",
  );
  const sourceWorkspace = path.join(
    context.extensionPath,
    "../app/electron/workspace-template",
  );
  const sourceProject = path.join(
    context.extensionPath,
    "../app/electron/project-template",
  );
  process.env.LOCAL_PM_WORKSPACE_TEMPLATE = fs.existsSync(bundledWorkspace)
    ? bundledWorkspace
    : sourceWorkspace;
  process.env.LOCAL_PM_PROJECT_TEMPLATE = fs.existsSync(bundledProject)
    ? bundledProject
    : sourceProject;
}

type CallMsg = {
  type: "call";
  id: number;
  method: string;
  args: unknown[];
};

function nodePanelKey(root: string, ref: NodeRef): string {
  return `${path.resolve(root)}::${JSON.stringify(ref)}`;
}

class NodePanelHost {
  private readonly panels = new Map<string, vscode.WebviewPanel>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly registry: WorkspaceSessionRegistry,
  ) {}

  async open(root: string, ref: NodeRef): Promise<void> {
    const key = nodePanelKey(root, ref);
    const existing = this.panels.get(key);
    if (existing) {
      existing.reveal(vscode.ViewColumn.Active);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      NODE_PANEL_TYPE,
      labelForNodeRef(ref),
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panels.set(key, panel);
    panel.onDidDispose(() => {
      this.panels.delete(key);
    });
    await bindPmWebview({
      context: this.context,
      registry: this.registry,
      webviewPanel: panel,
      root,
      surface: "node",
      nodeRef: ref,
      title: labelForNodeRef(ref),
      openNode: (nextRoot, nextRef) => this.open(nextRoot, nextRef),
    });
  }
}

class MapPanelHost {
  private readonly panels = new Map<string, vscode.WebviewPanel>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly registry: WorkspaceSessionRegistry,
    private readonly nodes: NodePanelHost,
  ) {}

  async open(marker: vscode.Uri): Promise<void> {
    const root = workspaceRootFromMarker(marker);
    const key = path.resolve(root);
    const existing = this.panels.get(key);
    if (existing) {
      existing.reveal(vscode.ViewColumn.Active);
      return;
    }

    const fallback = path.basename(key);
    const panel = vscode.window.createWebviewPanel(
      MAP_PANEL_TYPE,
      fallback,
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panels.set(key, panel);
    panel.onDidDispose(() => {
      this.panels.delete(key);
    });
    await bindPmWebview({
      context: this.context,
      registry: this.registry,
      webviewPanel: panel,
      root,
      surface: "map",
      nodeRef: null,
      title: fallback,
      openNode: (nextRoot, nextRef) => this.nodes.open(nextRoot, nextRef),
    });
  }
}

async function bindPmWebview(opts: {
  context: vscode.ExtensionContext;
  registry: WorkspaceSessionRegistry;
  webviewPanel: vscode.WebviewPanel;
  root: string;
  surface: "map" | "node";
  nodeRef: NodeRef | null;
  title: string;
  openNode: (root: string, ref: NodeRef) => Promise<void>;
}): Promise<void> {
  const { context, registry, webviewPanel, root, surface, nodeRef, title } =
    opts;

  webviewPanel.webview.options = {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.file(root),
      vscode.Uri.joinPath(context.extensionUri, "media"),
    ],
  };

  let acquired;
  try {
    acquired = await registry.acquire(root, webviewPanel, surface);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    void vscode.window.showErrorMessage(
      `Could not open PM workspace: ${message}`,
    );
    webviewPanel.dispose();
    return;
  }

  const snap = acquired.session.snapshot();
  webviewPanel.title =
    surface === "map"
      ? workspaceTabTitle(snap?.meta, title)
      : title;
  webviewPanel.webview.html = buildWebviewHtml({
    webview: webviewPanel.webview,
    extensionUri: context.extensionUri,
    workspaceRoot: acquired.root,
    surface,
    nodeRef,
  });

  const disposable = webviewPanel.webview.onDidReceiveMessage(
    async (msg: unknown) => {
      if (!msg || typeof msg !== "object" || (msg as { type?: string }).type !== "call") {
        return;
      }
      const call = msg as CallMsg;
      try {
        if (call.method === "openPmNode") {
          const ref = call.args[0] as NodeRef;
          await opts.openNode(acquired.root, ref);
          await webviewPanel.webview.postMessage({
            type: "ok",
            id: call.id,
            result: undefined,
          });
          return;
        }
        if (call.method === "closePmPanel") {
          await vscode.commands.executeCommand(
            "workbench.action.closeActiveEditor",
          );
          await webviewPanel.webview.postMessage({
            type: "ok",
            id: call.id,
            result: undefined,
          });
          return;
        }
        const result = await acquired.session.invoke(
          call.method,
          call.args ?? [],
        );
        await webviewPanel.webview.postMessage({
          type: "ok",
          id: call.id,
          result,
        });
      } catch (err) {
        await webviewPanel.webview.postMessage({
          type: "err",
          id: call.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  webviewPanel.onDidDispose(() => {
    disposable.dispose();
    acquired.release();
  });
}

class PmMapEditorProvider
  implements vscode.CustomReadonlyEditorProvider<PmDocument>
{
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly registry: WorkspaceSessionRegistry,
    private readonly nodes: NodePanelHost,
  ) {}

  openCustomDocument(uri: vscode.Uri): PmDocument {
    return new PmDocument(uri);
  }

  async resolveCustomEditor(
    document: PmDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    const root = workspaceRootFromMarker(document.uri);
    await bindPmWebview({
      context: this.context,
      registry: this.registry,
      webviewPanel,
      root,
      surface: "map",
      nodeRef: null,
      title: path.basename(root),
      openNode: (nextRoot, nextRef) => this.nodes.open(nextRoot, nextRef),
    });
  }
}

class PmNodeEditorProvider
  implements vscode.CustomReadonlyEditorProvider<PmDocument>
{
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly registry: WorkspaceSessionRegistry,
    private readonly nodes: NodePanelHost,
  ) {}

  openCustomDocument(uri: vscode.Uri): PmDocument {
    return new PmDocument(uri);
  }

  async resolveCustomEditor(
    document: PmDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    const resolved = resolvePmNodeReadme(document.uri);
    if (!resolved.ok) {
      void vscode.window.showErrorMessage(resolved.error);
      return;
    }
    await bindPmWebview({
      context: this.context,
      registry: this.registry,
      webviewPanel,
      root: resolved.value.root,
      surface: "node",
      nodeRef: resolved.value.ref,
      title: labelForNodeRef(resolved.value.ref),
      openNode: (nextRoot, nextRef) => this.nodes.open(nextRoot, nextRef),
    });
  }
}

const editorOptions = {
  webviewOptions: { retainContextWhenHidden: true },
  supportsMultipleEditorsPerDocument: false,
};

export function activate(context: vscode.ExtensionContext): void {
  configureEnv(context);
  const registry = new WorkspaceSessionRegistry(makeUi());
  const nodes = new NodePanelHost(context, registry);
  const maps = new MapPanelHost(context, registry, nodes);
  context.subscriptions.push({ dispose: () => registry.disposeAll() });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pm-all-in-one.open",
      async (uri?: vscode.Uri) => {
        const target = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (!target) {
          void vscode.window.showErrorMessage(
            "Select a .pmws file or a PM node README.md.",
          );
          return;
        }
        if (path.basename(target.fsPath) === ".pmws") {
          await maps.open(target);
          return;
        }
        const resolved = resolvePmNodeReadme(target);
        if (!resolved.ok) {
          void vscode.window.showErrorMessage(resolved.error);
          return;
        }
        await nodes.open(resolved.value.root, resolved.value.ref);
      },
    ),
    vscode.commands.registerCommand(
      "pm-all-in-one.newWorkspace",
      async (uri?: vscode.Uri) => {
        try {
          const created = await createPmWorkspace(uri);
          if (!created) {
            return;
          }
          await vscode.commands.executeCommand(
            "revealInExplorer",
            vscode.Uri.file(created.root),
          );
          await maps.open(vscode.Uri.file(created.marker));
        } catch (e) {
          void vscode.window.showErrorMessage(
            e instanceof Error ? e.message : String(e),
          );
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      MAP_VIEW_TYPE,
      new PmMapEditorProvider(context, registry, nodes),
      editorOptions,
    ),
  );

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      NODE_VIEW_TYPE,
      new PmNodeEditorProvider(context, registry, nodes),
      editorOptions,
    ),
  );
}

export function deactivate(): void {}
