import { contextBridge, ipcRenderer } from "electron";

// ↔ src/lib/bridge/pm-api.ts — window.pm shape must match PmApi
// ↔ src/lib/bridge.ts — getPm() returns window.pm when present
// ↔ src/lib/bridge/http-pm.ts — web twin (stubs desktop-only ops)
// ↔ electron/main.ts — ipcMain.handle("pm:…") / term:… counterparts
const pm = {
  platform: process.platform,
  openUiLab: () => ipcRenderer.invoke("pm:openUiLab"),
  openWorkspace: () => ipcRenderer.invoke("pm:openWorkspace"),
  pickDirectory: (title?: string) =>
    ipcRenderer.invoke("pm:pickDirectory", title) as Promise<string | null>,
  createWorkspaceAt: (
    parentDir: string,
    folderName: string,
    options?: { title?: string; seedProject?: { title: string } },
  ) =>
    ipcRenderer.invoke(
      "pm:createWorkspaceAt",
      parentDir,
      folderName,
      options,
    ),
  openWorkspacePath: (root: string) =>
    ipcRenderer.invoke("pm:openWorkspacePath", root),
  restoreWorkspace: () => ipcRenderer.invoke("pm:restoreWorkspace"),
  getTree: () => ipcRenderer.invoke("pm:getTree"),
  listProjects: () => ipcRenderer.invoke("pm:listProjects"),
  listIssues: () => ipcRenderer.invoke("pm:listIssues"),
  getIssue: (projectId: string, issueId: string) =>
    ipcRenderer.invoke("pm:getIssue", projectId, issueId),
  createProject: (input: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:createProject", input),
  updateProject: (projectId: string, patch: Record<string, unknown>, options?: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:updateProject", projectId, patch, options),
  updateWorkspace: (patch: Record<string, unknown>, options?: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:updateWorkspace", patch, options),
  deleteProject: (projectId: string, options?: { cascade?: boolean }) =>
    ipcRenderer.invoke("pm:deleteProject", projectId, options),
  createIssue: (input: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:createIssue", input),
  updateIssue: (
    projectId: string,
    issueId: string,
    patch: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => ipcRenderer.invoke("pm:updateIssue", projectId, issueId, patch, options),
  deleteIssue: (
    projectId: string,
    issueId: string,
    options?: { cascade?: boolean },
  ) => ipcRenderer.invoke("pm:deleteIssue", projectId, issueId, options),
  confirmDangerous: (opts: {
    title: string;
    message: string;
    detail?: string;
  }) => ipcRenderer.invoke("pm:confirmDangerous", opts) as Promise<boolean>,
  moveIssue: (input: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:moveIssue", input),
  getCustomProps: (projectId: string) =>
    ipcRenderer.invoke("pm:getCustomProps", projectId),
  updateCustomProps: (projectId: string, schema: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:updateCustomProps", projectId, schema),
  listViews: () => ipcRenderer.invoke("pm:listViews"),
  createView: (input?: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:createView", input ?? {}),
  updateView: (viewId: string, patch: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:updateView", viewId, patch),
  deleteView: (viewId: string) => ipcRenderer.invoke("pm:deleteView", viewId),
  getViewOrder: (viewKey: string) =>
    ipcRenderer.invoke("pm:getViewOrder", viewKey),
  getAllViewOrders: () => ipcRenderer.invoke("pm:getAllViewOrders"),
  setViewOrder: (viewKey: string, order: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:setViewOrder", viewKey, order),
  pruneViewOrderKey: (movedKey: string, activeViewKey: string) =>
    ipcRenderer.invoke("pm:pruneViewOrderKey", movedKey, activeViewKey),
  doctor: () => ipcRenderer.invoke("pm:doctor"),
  adoptStray: (strayPath: string) =>
    ipcRenderer.invoke("pm:adoptStray", strayPath),
  revealPath: (targetPath: string) =>
    ipcRenderer.invoke("pm:revealPath", targetPath),
  // ↔ src/lib/bridge/pm-api.ts — getGitSyncStatus / pullWorkspace
  // ↔ electron/main.ts — pm:getGitSyncStatus / pm:pullWorkspace
  // ↔ src/lib/bridge/http-pm.ts — web stubs
  getGitSyncStatus: () => ipcRenderer.invoke("pm:getGitSyncStatus"),
  pullWorkspace: () => ipcRenderer.invoke("pm:pullWorkspace"),
  listNodeAssets: (ref: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:listNodeAssets", ref),
  addNodeAssets: (ref: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:addNodeAssets", ref),
  getNodeAssetsDir: (ref: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:getNodeAssetsDir", ref),
  getWiki: () => ipcRenderer.invoke("pm:getWiki"),
  getWikiNode: (id: string) => ipcRenderer.invoke("pm:getWikiNode", id),
  createWikiNode: (input?: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:createWikiNode", input ?? {}),
  updateWikiNode: (
    id: string,
    patch: Record<string, unknown>,
    options?: { expected?: unknown },
  ) => ipcRenderer.invoke("pm:updateWikiNode", id, patch, options),
  deleteWikiNode: (id: string, options?: { removeFile?: boolean }) =>
    ipcRenderer.invoke("pm:deleteWikiNode", id, options),
  setWikiSidebar: (nodes: unknown[]) =>
    ipcRenderer.invoke("pm:setWikiSidebar", nodes),
  moveWikiNodeInSidebar: (id: string, move: string) =>
    ipcRenderer.invoke("pm:moveWikiNodeInSidebar", id, move),
  moveWikiNodeToSidebarPosition: (
    id: string,
    placement: { parentId: string | null; index: number },
  ) => ipcRenderer.invoke("pm:moveWikiNodeToSidebarPosition", id, placement),
  getMembers: () => ipcRenderer.invoke("pm:getMembers"),
  getMember: (id: string) => ipcRenderer.invoke("pm:getMember", id),
  createMember: (input?: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:createMember", input ?? {}),
  updateMember: (
    id: string,
    patch: Record<string, unknown>,
    options?: { expected?: unknown },
  ) => ipcRenderer.invoke("pm:updateMember", id, patch, options),
  setMemberAvatar: (id: string, sourcePath: string) =>
    ipcRenderer.invoke("pm:setMemberAvatar", id, sourcePath),
  getMemberAvatarDataUrl: (id: string) =>
    ipcRenderer.invoke("pm:getMemberAvatarDataUrl", id),
  getLocalConfig: () => ipcRenderer.invoke("pm:getLocalConfig"),
  setLocalMe: (memberId: string | null) =>
    ipcRenderer.invoke("pm:setLocalMe", memberId),
  getHandoffs: () => ipcRenderer.invoke("pm:getHandoffs"),
  getHandoff: (id: string) => ipcRenderer.invoke("pm:getHandoff", id),
  createHandoff: (input: Record<string, unknown>) =>
    ipcRenderer.invoke("pm:createHandoff", input),
  updateHandoff: (
    id: string,
    patch: Record<string, unknown>,
    options?: { expected?: unknown },
  ) => ipcRenderer.invoke("pm:updateHandoff", id, patch, options),
  onChanged: (
    handler: (payload: {
      projects: unknown;
      tree: unknown;
      issues: unknown;
      strays?: unknown;
      meta?: unknown;
      customProps?: unknown;
    }) => void,
  ) => {
    const listener = (
      _event: unknown,
      payload: {
        projects: unknown;
        tree: unknown;
        issues: unknown;
        strays?: unknown;
        meta?: unknown;
        customProps?: unknown;
      },
    ) => {
      handler(payload);
    };
    ipcRenderer.on("pm:changed", listener);
    return () => {
      ipcRenderer.removeListener("pm:changed", listener);
    };
  },
  onWorkspaceOpened: (handler: (payload: unknown) => void) => {
    const listener = (_event: unknown, payload: unknown) => {
      handler(payload);
    };
    ipcRenderer.on("pm:workspaceOpened", listener);
    return () => {
      ipcRenderer.removeListener("pm:workspaceOpened", listener);
    };
  },
  onNewWorkspace: (handler: () => void) => {
    const listener = () => {
      handler();
    };
    ipcRenderer.on("menu:newWorkspace", listener);
    return () => {
      ipcRenderer.removeListener("menu:newWorkspace", listener);
    };
  },
  onToggleTerminal: (handler: () => void) => {
    const listener = () => {
      handler();
    };
    ipcRenderer.on("menu:toggleTerminal", listener);
    return () => {
      ipcRenderer.removeListener("menu:toggleTerminal", listener);
    };
  },
  /**
   * Subscribe to native fullscreen. Pulls current state on subscribe so Vite
   * remount / Cmd+R cannot miss the enter-full-screen push (see main
   * `window:getFullscreen` + `attachFullscreenBridge`).
   */
  onFullscreenChange: (handler: (fullscreen: boolean) => void) => {
    let active = true;
    const listener = (_event: unknown, fullscreen: boolean) => {
      handler(Boolean(fullscreen));
    };
    ipcRenderer.on("window:fullscreen", listener);
    void ipcRenderer
      .invoke("window:getFullscreen")
      .then((fs: unknown) => {
        if (active) {
          handler(Boolean(fs));
        }
      })
      .catch(() => {
        /* Main without handler (stale Electron) — rely on push / restart. */
      });
    return () => {
      active = false;
      ipcRenderer.removeListener("window:fullscreen", listener);
    };
  },
  term: {
    create: (cols?: number, rows?: number) =>
      ipcRenderer.invoke("term:create", cols, rows),
    write: (sessionId: string, data: string) =>
      ipcRenderer.invoke("term:write", sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke("term:resize", sessionId, cols, rows),
    kill: (sessionId: string) => ipcRenderer.invoke("term:kill", sessionId),
    onData: (handler: (payload: { sessionId: string; data: string }) => void) => {
      const listener = (
        _event: unknown,
        payload: { sessionId: string; data: string },
      ) => {
        handler(payload);
      };
      ipcRenderer.on("term:data", listener);
      return () => {
        ipcRenderer.removeListener("term:data", listener);
      };
    },
    onExit: (
      handler: (payload: { sessionId: string; exitCode: number }) => void,
    ) => {
      const listener = (
        _event: unknown,
        payload: { sessionId: string; exitCode: number },
      ) => {
        handler(payload);
      };
      ipcRenderer.on("term:exit", listener);
      return () => {
        ipcRenderer.removeListener("term:exit", listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld("pm", pm);
