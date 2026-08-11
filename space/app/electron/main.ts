import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions,
  type WebPreferences,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adoptStray, scanStrays } from "./core/doctor.js";
import {
  copyFilesIntoNodeAssets,
  getNodeAssetsDir,
  listNodeAssets,
  type NodeRef,
} from "./core/node-assets.js";
import {
  createWikiNode,
  deleteWikiNode,
  ensureWiki,
  getWikiNode,
  getWikiSnapshot,
  moveWikiNodeInSidebar,
  moveWikiNodeToSidebarPosition,
  setWikiSidebar,
  updateWikiNode,
  type CreateWikiNodeInput,
  type WikiNodePatch,
  type WikiSidebarMove,
  type WikiSidebarNode,
  type WikiSidebarPlacement,
} from "./core/wiki.js";
import {
  createMember,
  ensureMembers,
  getMember,
  getMemberAvatarDataUrl,
  getMemberSnapshot,
  setMemberAvatar,
  updateMember,
} from "./core/members.js";
import {
  createHandoff,
  ensureHandoffs,
  getHandoff,
  getHandoffSnapshot,
  updateHandoff,
} from "./core/handoffs.js";
import { readLocalConfig, writeLocalConfig } from "./core/local-config.js";
import { rebuildIndex } from "./core/index.js";
import { ensureLocalJsonGitignore } from "./core/workspace-gitignore.js";
import { installCliLink } from "./core/cli-install.js";
import { ensureLocalPmShim } from "./core/local-pm-shim.js";
import { PtyManager } from "./core/pty.js";
import {
  scaffoldWorkspace,
  type ScaffoldWorkspaceOptions,
} from "./core/scaffold-workspace.js";
import {
  readSettings,
  setLastWorkspaceRoot,
} from "./core/settings.js";
import {
  createIssue,
  createProject,
  deleteIssue,
  deleteProject,
  getCustomPropsForProject,
  getIssue,
  assertSupportedLayout,
  isValidWorkspace,
  listIssues,
  listProjects,
  moveIssue,
  updateCustomPropsForProject,
  updateIssue,
  updateProject,
} from "./core/store.js";
import type {
  CreateHandoffInput,
  CreateMemberInput,
  CustomPropsSchema,
  HandoffPatch,
  IssueCreateInput,
  IssuePatch,
  MemberPatch,
  MoveIssueInput,
  ProjectCreateInput,
  ProjectPatch,
  WorkspacePatch,
} from "./core/types.js";
import {
  encodeStaleWriteMessage,
  isStaleWriteError,
} from "./core/detail-diff.js";
import {
  ensureWorkspaceMeta,
  updateWorkspaceMeta,
} from "./core/workspace-meta.js";
import {
  createView,
  deleteView,
  ensureViews,
  listViews,
  updateView,
  type CreateViewInput,
  type UpdateViewInput,
} from "./core/views.js";
import {
  ensureViewOrders,
  getAllViewOrders,
  getViewOrder,
  pruneKeyFromOtherViews,
  setViewOrder,
  type ViewOrder,
} from "./core/view-orders.js";
import { WorkspaceWatcher } from "./core/watch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

const MIN_WIDTH = 960;
const MIN_HEIGHT = 640;

/**
 * macOS traffic lights — keep in sync with `--layout--titlebar-height` (38px)
 * and `--layout--titlebar-traffic-inset` (x). `y` is top of the control cluster;
 * native dots ~12px, so (38 - 12) / 2 ≈ 13; optical center on current macOS needs
 * a slight nudge down.
 */
const MAC_TRAFFIC_LIGHT_POSITION = { x: 14, y: 11 } as const;

let mainWindow: BrowserWindow | null = null;
let labWindow: BrowserWindow | null = null;
let workspaceRoot: string | null = null;
let localPmShimPath: string | null = null;
const watcher = new WorkspaceWatcher();
const ptyManager = new PtyManager();

type WorkspaceSnapshot = Awaited<ReturnType<typeof openWorkspaceAt>>;

function windowWebPreferences(): WebPreferences {
  return {
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    devTools: isDev,
  };
}

function isHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isAppOwnedUrl(url: string): boolean {
  if (isDev) {
    return (
      url.startsWith("http://127.0.0.1:5173") ||
      url.startsWith("http://localhost:5173")
    );
  }
  return url.startsWith("file:");
}

/** Open http(s) in the OS browser; keep in-app loads (Vite / file) inside Electron. */
function attachExternalLinkHandlers(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (isAppOwnedUrl(url)) {
      return;
    }
    event.preventDefault();
    if (isHttpUrl(url)) {
      void shell.openExternal(url);
    }
  });
}

/**
 * Push native fullscreen to the renderer. Push alone is not enough on refresh:
 * React may subscribe after `did-finish-load`, so preload also pulls via
 * `window:getFullscreen` (registered in `registerIpc`). Delayed re-push covers
 * the same race if invoke is late or Electron was started before the handler
 * existed.
 */
function attachFullscreenBridge(win: BrowserWindow): void {
  const send = () => {
    if (win.isDestroyed()) {
      return;
    }
    win.webContents.send("window:fullscreen", win.isFullScreen());
  };
  win.on("enter-full-screen", send);
  win.on("leave-full-screen", send);
  win.webContents.on("did-finish-load", () => {
    send();
    setTimeout(send, 0);
    setTimeout(send, 100);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    backgroundColor: "#ffffff",
    ...(process.platform === "darwin" && {
      titleBarStyle: "hidden" as const,
      trafficLightPosition: MAC_TRAFFIC_LIGHT_POSITION,
    }),
    webPreferences: windowWebPreferences(),
  });

  if (process.platform === "darwin") {
    mainWindow.setWindowButtonPosition(MAC_TRAFFIC_LIGHT_POSITION);
  }

  attachExternalLinkHandlers(mainWindow);
  attachFullscreenBridge(mainWindow);

  if (isDev) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (labWindow && !labWindow.isDestroyed()) {
      labWindow.close();
    }
  });
}

function createOrFocusLabWindow(): void {
  if (!isDev) {
    return;
  }
  if (labWindow && !labWindow.isDestroyed()) {
    labWindow.show();
    labWindow.focus();
    return;
  }

  labWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: "#ffffff",
    ...(process.platform === "darwin" && {
      titleBarStyle: "hidden" as const,
      trafficLightPosition: MAC_TRAFFIC_LIGHT_POSITION,
    }),
    webPreferences: windowWebPreferences(),
  });

  if (process.platform === "darwin") {
    labWindow.setWindowButtonPosition(MAC_TRAFFIC_LIGHT_POSITION);
  }

  attachExternalLinkHandlers(labWindow);
  attachFullscreenBridge(labWindow);
  void labWindow.loadURL("http://127.0.0.1:5173/#/lab");

  labWindow.on("closed", () => {
    labWindow = null;
  });
}

function requireWorkspace(): string {
  if (!workspaceRoot) {
    throw new Error("No workspace open");
  }
  return workspaceRoot;
}

async function openWorkspaceAt(root: string) {
  if (!isValidWorkspace(root)) {
    throw new Error(
      `Not a workspace (need issue-hierarchy/ and .pm/): ${root}`,
    );
  }
  assertSupportedLayout(root);
  workspaceRoot = root;
  setLastWorkspaceRoot(root);
  ptyManager.setCwd(root);
  ptyManager.setWorkspaceRoot(root);
  ensureViews(root);
  ensureViewOrders(root);
  ensureLocalJsonGitignore(root);
  await ensureWiki(root);
  await ensureMembers(root);
  await ensureHandoffs(root);
  const meta = await ensureWorkspaceMeta(root);
  const tree = await rebuildIndex(root);
  const projects = await listProjects(root);
  const issues = await listIssues(root);
  const strays = scanStrays(root);

  watcher.start(root, (payload) => {
    mainWindow?.webContents.send("pm:changed", payload);
  });

  return { root, meta, projects, tree, issues, strays };
}

function pushWorkspaceOpened(snap: WorkspaceSnapshot): void {
  mainWindow?.webContents.send("pm:workspaceOpened", snap);
}

async function promptOpenWorkspace(): Promise<WorkspaceSnapshot | null> {
  if (!mainWindow) {
    return null;
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Open workspace",
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return openWorkspaceAt(result.filePaths[0]!);
}

async function pickDirectory(title?: string): Promise<string | null> {
  if (!mainWindow) {
    return null;
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: title ?? "Choose folder",
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0]!;
}

function resolveNewWorkspaceRoot(parentDir: string, folderName: string): string {
  const name = folderName.trim();
  if (!name) {
    throw new Error("Workspace folder name is required.");
  }
  if (name === "." || name === ".." || /[/\\]/.test(name)) {
    throw new Error("Folder name must be a single path segment.");
  }
  return path.join(parentDir, name);
}

async function createWorkspaceAt(
  parentDir: string,
  folderName: string,
  options?: ScaffoldWorkspaceOptions,
): Promise<WorkspaceSnapshot> {
  if (!parentDir?.trim()) {
    throw new Error("Parent folder is required.");
  }
  const root = resolveNewWorkspaceRoot(parentDir, folderName);
  scaffoldWorkspace(root, options ?? {});
  return openWorkspaceAt(root);
}

async function runMenuWorkspaceAction(
  action: () => Promise<WorkspaceSnapshot | null>,
): Promise<void> {
  try {
    const snap = await action();
    if (snap) {
      pushWorkspaceOpened(snap);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (mainWindow) {
      await dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "Workspace",
        message,
      });
    }
  }
}

// ↔ electron/core/cli-install.ts — link placement + clobber safety live there
async function runInstallCli(): Promise<void> {
  try {
    if (!localPmShimPath) {
      throw new Error("The shim is not ready yet. Try again in a moment.");
    }
    const { linkPath, onPath, replaced } = installCliLink(localPmShimPath);
    const dir = path.dirname(linkPath);
    await dialog.showMessageBox({
      type: "info",
      message: replaced
        ? "Command line tool updated"
        : "Command line tool installed",
      detail: onPath
        ? `local-pm is linked at ${linkPath}.\n\nOpen a new shell and run: local-pm doctor`
        : `local-pm is linked at ${linkPath}, but ${dir} is not on your PATH.\n\nAdd this to your shell profile:\n\n    export PATH="${dir}:$PATH"`,
      buttons: ["OK"],
    });
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      message: "Could not install the command line tool",
      detail: error instanceof Error ? error.message : String(error),
      buttons: ["OK"],
    });
  }
}

function buildAppMenu(): void {
  const fileSubmenu: MenuItemConstructorOptions[] = [
    {
      label: "New Workspace…",
      accelerator: "CmdOrCtrl+N",
      click: () => {
        mainWindow?.webContents.send("menu:newWorkspace");
      },
    },
    {
      label: "Open Workspace…",
      accelerator: "CmdOrCtrl+O",
      click: () => {
        void runMenuWorkspaceAction(promptOpenWorkspace);
      },
    },
  ];

  if (process.platform !== "win32") {
    fileSubmenu.push(
      { type: "separator" },
      {
        label: "Install Command Line Tool…",
        click: () => {
          void runInstallCli();
        },
      },
    );
  }

  if (process.platform === "darwin") {
    fileSubmenu.push({ type: "separator" }, { role: "close" });
  } else {
    fileSubmenu.push({ type: "separator" }, { role: "quit" });
  }

  const viewSubmenu: MenuItemConstructorOptions[] = [
    { role: "reload" },
    { role: "forceReload" },
    { role: "toggleDevTools" },
    { type: "separator" },
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
    { type: "separator" },
    {
      label: "Toggle Terminal",
      accelerator: "Ctrl+`",
      click: () => {
        mainWindow?.webContents.send("menu:toggleTerminal");
      },
    },
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
    { label: "File", submenu: fileSubmenu },
    { role: "editMenu" },
    { label: "View", submenu: viewSubmenu },
    ...(isDev
      ? [
          {
            label: "Dev",
            submenu: [
              {
                label: "UI Lab",
                accelerator: "CmdOrCtrl+Shift+D",
                click: () => createOrFocusLabWindow(),
              },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    { role: "windowMenu" },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ↔ server/main.ts — HTTP/SSE twin of these IPC handlers (shared electron/core)
// ↔ electron/preload.cts — renderer invokes pm:* / term:* channels below
// ↔ src/lib/bridge/pm-api.ts — contract every handler must satisfy
// ↔ electron/core/detail-diff.ts — encodeStaleWriteMessage on update* OCC failures
// ↔ electron/core/index.ts — rebuildIndex after mutations / watch
function registerIpc(): void {
  // Pulled by preload `onFullscreenChange` so remount/refresh syncs inset.
  ipcMain.handle("window:getFullscreen", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isFullScreen() ?? false;
  });
  ipcMain.handle("pm:openUiLab", () => {
    createOrFocusLabWindow();
  });
  ipcMain.handle("pm:openWorkspace", async () => promptOpenWorkspace());
  ipcMain.handle("pm:pickDirectory", async (_event, title?: string) =>
    pickDirectory(title),
  );
  ipcMain.handle(
    "pm:createWorkspaceAt",
    (
      _event,
      parentDir: string,
      folderName: string,
      options?: ScaffoldWorkspaceOptions,
    ) => createWorkspaceAt(parentDir, folderName, options),
  );
  ipcMain.handle("pm:openWorkspacePath", (_event, root: string) =>
    openWorkspaceAt(root),
  );
  ipcMain.handle("pm:restoreWorkspace", async () => {
    const candidates = [workspaceRoot, readSettings().lastWorkspaceRoot];
    for (const root of candidates) {
      if (root && isValidWorkspace(root)) {
        return openWorkspaceAt(root);
      }
    }
    return null;
  });

  ipcMain.handle("pm:getTree", () => rebuildIndex(requireWorkspace()));
  ipcMain.handle("pm:listProjects", () => listProjects(requireWorkspace()));
  ipcMain.handle("pm:listIssues", () => listIssues(requireWorkspace()));

  ipcMain.handle(
    "pm:getIssue",
    (_event, projectId: string, issueId: string) =>
      getIssue(requireWorkspace(), projectId, issueId),
  );

  ipcMain.handle("pm:createProject", (_event, input: ProjectCreateInput) => {
    const root = requireWorkspace();
    const me = readLocalConfig(root).me;
    return createProject(root, input ?? {}, { actorMemberId: me });
  });
  ipcMain.handle(
    "pm:updateProject",
    async (
      _event,
      projectId: string,
      patch: ProjectPatch,
      options?: { expected?: unknown },
    ) => {
      try {
        return await updateProject(
          requireWorkspace(),
          projectId,
          patch,
          options as never,
        );
      } catch (e) {
        if (isStaleWriteError(e)) {
          throw new Error(encodeStaleWriteMessage(e));
        }
        throw e;
      }
    },
  );
  ipcMain.handle(
    "pm:updateWorkspace",
    async (_event, patch: WorkspacePatch, options?: { expected?: unknown }) => {
      try {
        return await updateWorkspaceMeta(
          requireWorkspace(),
          patch,
          options as never,
        );
      } catch (e) {
        if (isStaleWriteError(e)) {
          throw new Error(encodeStaleWriteMessage(e));
        }
        throw e;
      }
    },
  );
  ipcMain.handle(
    "pm:deleteProject",
    (_event, projectId: string, options?: { cascade?: boolean }) => {
      return deleteProject(requireWorkspace(), projectId, options).then(
        () => true,
      );
    },
  );

  ipcMain.handle("pm:createIssue", (_event, input: IssueCreateInput) => {
    const root = requireWorkspace();
    const me = readLocalConfig(root).me;
    return createIssue(root, input, { actorMemberId: me });
  });
  ipcMain.handle(
    "pm:updateIssue",
    async (
      _event,
      projectId: string,
      issueId: string,
      patch: IssuePatch,
      options?: { expected?: unknown },
    ) => {
      try {
        return await updateIssue(
          requireWorkspace(),
          projectId,
          issueId,
          patch,
          options as never,
        );
      } catch (e) {
        if (isStaleWriteError(e)) {
          throw new Error(encodeStaleWriteMessage(e));
        }
        throw e;
      }
    },
  );
  ipcMain.handle(
    "pm:deleteIssue",
    (
      _event,
      projectId: string,
      issueId: string,
      options?: { cascade?: boolean },
    ) => {
      return deleteIssue(requireWorkspace(), projectId, issueId, options).then(
        () => true,
      );
    },
  );
  ipcMain.handle(
    "pm:confirmDangerous",
    async (
      _event,
      opts: { title: string; message: string; detail?: string },
    ) => {
      const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
      const box = {
        type: "warning" as const,
        title: opts.title,
        message: opts.message,
        detail: opts.detail,
        buttons: ["Cancel", "Delete"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      };
      const result = win
        ? await dialog.showMessageBox(win, box)
        : await dialog.showMessageBox(box);
      return result.response === 1;
    },
  );
  ipcMain.handle("pm:moveIssue", (_event, input: MoveIssueInput) =>
    moveIssue(requireWorkspace(), input),
  );

  ipcMain.handle("pm:getCustomProps", (_event, projectId: string) =>
    getCustomPropsForProject(requireWorkspace(), projectId),
  );
  ipcMain.handle(
    "pm:updateCustomProps",
    (_event, projectId: string, schema: CustomPropsSchema) =>
      updateCustomPropsForProject(requireWorkspace(), projectId, schema),
  );

  ipcMain.handle("pm:listViews", () => listViews(requireWorkspace()));
  ipcMain.handle("pm:createView", (_event, input: CreateViewInput) =>
    createView(requireWorkspace(), input ?? {}),
  );
  ipcMain.handle(
    "pm:updateView",
    (_event, viewId: string, patch: UpdateViewInput) =>
      updateView(requireWorkspace(), viewId, patch),
  );
  ipcMain.handle("pm:deleteView", (_event, viewId: string) =>
    deleteView(requireWorkspace(), viewId),
  );
  ipcMain.handle("pm:getViewOrder", (_event, viewKey: string) =>
    getViewOrder(requireWorkspace(), viewKey),
  );
  ipcMain.handle("pm:getAllViewOrders", () =>
    getAllViewOrders(requireWorkspace()),
  );
  ipcMain.handle(
    "pm:setViewOrder",
    (_event, viewKey: string, order: ViewOrder) =>
      setViewOrder(requireWorkspace(), viewKey, order),
  );
  ipcMain.handle(
    "pm:pruneViewOrderKey",
    (_event, movedKey: string, activeViewKey: string) => {
      pruneKeyFromOtherViews(requireWorkspace(), movedKey, activeViewKey);
    },
  );

  ipcMain.handle("pm:doctor", () => scanStrays(requireWorkspace()));
  ipcMain.handle("pm:adoptStray", (_event, strayPath: string) => {
    return adoptStray(requireWorkspace(), strayPath);
  });
  ipcMain.handle("pm:revealPath", (_event, targetPath: string) => {
    shell.showItemInFolder(path.resolve(targetPath));
    return true;
  });
  ipcMain.handle("pm:listNodeAssets", (_event, ref: NodeRef) =>
    listNodeAssets(requireWorkspace(), ref),
  );
  ipcMain.handle("pm:getNodeAssetsDir", (_event, ref: NodeRef) =>
    getNodeAssetsDir(requireWorkspace(), ref),
  );
  ipcMain.handle("pm:addNodeAssets", async (_event, ref: NodeRef) => {
    if (!mainWindow) {
      return [];
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      title: "Add assets",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }
    return copyFilesIntoNodeAssets(
      requireWorkspace(),
      ref,
      result.filePaths,
    );
  });

  ipcMain.handle("pm:getWiki", () => getWikiSnapshot(requireWorkspace()));
  ipcMain.handle("pm:getWikiNode", (_event, id: string) =>
    getWikiNode(requireWorkspace(), id),
  );
  ipcMain.handle("pm:createWikiNode", async (_event, input: CreateWikiNodeInput) => {
    const root = requireWorkspace();
    const me = readLocalConfig(root).me;
    return createWikiNode(root, {
      ...(input ?? {}),
      actorMemberId: input?.actorMemberId !== undefined ? input.actorMemberId : me,
    });
  });
  ipcMain.handle(
    "pm:updateWikiNode",
    async (
      _event,
      id: string,
      patch: WikiNodePatch,
      options?: { expected?: unknown },
    ) => {
      try {
        return await updateWikiNode(
          requireWorkspace(),
          id,
          patch,
          options as { expected?: import("./core/detail-diff.js").WikiEditableSlice },
        );
      } catch (e) {
        if (isStaleWriteError(e)) {
          throw new Error(encodeStaleWriteMessage(e));
        }
        throw e;
      }
    },
  );
  ipcMain.handle(
    "pm:deleteWikiNode",
    (_event, id: string, options?: { removeFile?: boolean }) =>
      deleteWikiNode(requireWorkspace(), id, options),
  );
  ipcMain.handle("pm:setWikiSidebar", (_event, nodes: WikiSidebarNode[]) =>
    setWikiSidebar(requireWorkspace(), nodes),
  );
  ipcMain.handle(
    "pm:moveWikiNodeInSidebar",
    (_event, id: string, move: WikiSidebarMove) =>
      moveWikiNodeInSidebar(requireWorkspace(), id, move),
  );
  ipcMain.handle(
    "pm:moveWikiNodeToSidebarPosition",
    (_event, id: string, placement: WikiSidebarPlacement) =>
      moveWikiNodeToSidebarPosition(requireWorkspace(), id, placement),
  );

  ipcMain.handle("pm:getMembers", () => getMemberSnapshot(requireWorkspace()));
  ipcMain.handle("pm:getMember", (_event, id: string) =>
    getMember(requireWorkspace(), id),
  );
  ipcMain.handle("pm:createMember", (_event, input: CreateMemberInput) =>
    createMember(requireWorkspace(), input ?? {}),
  );
  ipcMain.handle(
    "pm:updateMember",
    async (
      _event,
      id: string,
      patch: MemberPatch,
      options?: { expected?: unknown },
    ) => {
      try {
        return await updateMember(
          requireWorkspace(),
          id,
          patch,
          options as {
            expected?: import("./core/detail-diff.js").MemberEditableSlice;
          },
        );
      } catch (e) {
        if (isStaleWriteError(e)) {
          throw new Error(encodeStaleWriteMessage(e));
        }
        throw e;
      }
    },
  );
  ipcMain.handle(
    "pm:setMemberAvatar",
    async (_event, id: string, sourcePath: string) => {
      const root = requireWorkspace();
      setMemberAvatar(root, id, sourcePath);
      return getMember(root, id);
    },
  );
  ipcMain.handle("pm:getMemberAvatarDataUrl", (_event, id: string) =>
    getMemberAvatarDataUrl(requireWorkspace(), id),
  );
  ipcMain.handle("pm:getLocalConfig", () => {
    const { me } = readLocalConfig(requireWorkspace());
    return { me };
  });
  ipcMain.handle("pm:setLocalMe", (_event, memberId: string | null) => {
    const next = writeLocalConfig(requireWorkspace(), { me: memberId });
    return { me: next.me };
  });

  ipcMain.handle("pm:getHandoffs", () => getHandoffSnapshot(requireWorkspace()));
  ipcMain.handle("pm:getHandoff", (_event, id: string) =>
    getHandoff(requireWorkspace(), id),
  );
  ipcMain.handle("pm:createHandoff", (_event, input: CreateHandoffInput) =>
    createHandoff(requireWorkspace(), input),
  );
  ipcMain.handle(
    "pm:updateHandoff",
    async (
      _event,
      id: string,
      patch: HandoffPatch,
      options?: { expected?: unknown },
    ) => {
      try {
        return await updateHandoff(
          requireWorkspace(),
          id,
          patch,
          options as {
            expected?: import("./core/detail-diff.js").HandoffEditableSlice;
          },
        );
      } catch (e) {
        if (isStaleWriteError(e)) {
          throw new Error(encodeStaleWriteMessage(e));
        }
        throw e;
      }
    },
  );

  ptyManager.setHandlers(
    (sessionId, data) => {
      mainWindow?.webContents.send("term:data", { sessionId, data });
    },
    (sessionId, exitCode) => {
      mainWindow?.webContents.send("term:exit", { sessionId, exitCode });
    },
  );

  ipcMain.handle("term:create", (_event, cols?: number, rows?: number) => {
    return ptyManager.create(cols ?? 80, rows ?? 24);
  });
  ipcMain.handle("term:write", (_event, sessionId: string, data: string) => {
    ptyManager.write(sessionId, data);
  });
  ipcMain.handle(
    "term:resize",
    (_event, sessionId: string, cols: number, rows: number) => {
      ptyManager.resize(sessionId, cols, rows);
    },
  );
  ipcMain.handle("term:kill", (_event, sessionId: string) => {
    ptyManager.kill(sessionId);
  });
}

app.whenReady().then(() => {
  const shim = ensureLocalPmShim(app.getPath("userData"));
  localPmShimPath = shim.shimPath;
  ptyManager.setBinDir(shim.binDir);
  registerIpc();
  buildAppMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  watcher.stop();
  ptyManager.killAll();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  watcher.stop();
  ptyManager.killAll();
});
