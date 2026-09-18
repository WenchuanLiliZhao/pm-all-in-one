(() => {
  /**
   * vscode-theme / cursor-theme host adapter (early `data-theme` writer).
   *
   * `--vscode-*` CSS variables update by themselves when the IDE theme
   * changes. `data-theme` is only for non-color forks: `shadow.scss`
   * (light vs dark shadow stacks) and mermaid (`dark` / `default`).
   * Color remapping lives in `color-use-vscode.scss` on
   * `html[data-pm-host=vscode]`. In-app subscribers: `src/lib/host-theme.ts`.
   *
   * Kind → lock: vscode-dark | vscode-high-contrast → dark;
   * vscode-light | vscode-high-contrast-light → light.
   */
  function vscodeKindIsDark(kind) {
    if (kind) {
      return kind === "vscode-dark" || kind === "vscode-high-contrast";
    }
    const body = document.body;
    if (!body) {
      return false;
    }
    return (
      body.classList.contains("vscode-dark") ||
      (body.classList.contains("vscode-high-contrast") &&
        !body.classList.contains("vscode-high-contrast-light"))
    );
  }

  function syncPmHostTheme() {
    const root = document.documentElement;
    if (root.getAttribute("data-pm-host") !== "vscode") {
      root.setAttribute("data-pm-host", "vscode");
    }
    const kind =
      (document.body && document.body.dataset.vscodeThemeKind) || "";
    root.setAttribute("data-theme", vscodeKindIsDark(kind) ? "dark" : "light");
  }

  syncPmHostTheme();
  if (document.body) {
    const themeMo = new MutationObserver(syncPmHostTheme);
    themeMo.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-vscode-theme-kind"],
    });
  }

  const vscode = acquireVsCodeApi();
  let nextId = 1;
  const pending = new Map();
  const changedHandlers = new Set();
  const openedHandlers = new Set();

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") {
      return;
    }
    if (msg.type === "ok" || msg.type === "err") {
      const waiter = pending.get(msg.id);
      if (!waiter) {
        return;
      }
      pending.delete(msg.id);
      if (msg.type === "ok") {
        waiter.resolve(msg.result);
      } else {
        waiter.reject(new Error(msg.message || "PM error"));
      }
      return;
    }
    if (msg.type === "event") {
      if (msg.event === "changed") {
        for (const handler of changedHandlers) {
          handler(msg.payload);
        }
      } else if (msg.event === "workspaceOpened") {
        for (const handler of openedHandlers) {
          handler(msg.payload);
        }
      }
    }
  });

  function invoke(method, ...args) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      vscode.postMessage({ type: "call", id, method, args });
    });
  }

  const noopUnsub = () => undefined;

  window.pm = {
    platform: "vscode",
    openUiLab: async () => {
      window.location.hash = "#/lab";
    },
    openWorkspace: () => invoke("openWorkspace"),
    pickDirectory: (title) => invoke("pickDirectory", title),
    createWorkspaceAt: (parentDir, folderName, options) =>
      invoke("createWorkspaceAt", parentDir, folderName, options),
    openWorkspacePath: (root) => invoke("openWorkspacePath", root),
    restoreWorkspace: () => invoke("restoreWorkspace"),
    updateWorkspace: (patch, options) =>
      invoke("updateWorkspace", patch, options),
    getTree: () => invoke("getTree"),
    listProjects: () => invoke("listProjects"),
    listIssues: () => invoke("listIssues"),
    getIssue: (projectId, issueId) => invoke("getIssue", projectId, issueId),
    createProject: (input) => invoke("createProject", input ?? {}),
    updateProject: (projectId, patch, options) =>
      invoke("updateProject", projectId, patch, options),
    deleteProject: (projectId, options) =>
      invoke("deleteProject", projectId, options),
    createIssue: (input) => invoke("createIssue", input),
    updateIssue: (projectId, issueId, patch, options) =>
      invoke("updateIssue", projectId, issueId, patch, options),
    deleteIssue: (projectId, issueId, options) =>
      invoke("deleteIssue", projectId, issueId, options),
    confirmDangerous: (opts) => invoke("confirmDangerous", opts),
    confirmUnsavedLeave: (opts) => invoke("confirmUnsavedLeave", opts),
    moveIssue: (input) => invoke("moveIssue", input),
    getCustomProps: (projectId) => invoke("getCustomProps", projectId),
    updateCustomProps: (projectId, schema) =>
      invoke("updateCustomProps", projectId, schema),
    getWikiCustomProps: () => invoke("getWikiCustomProps"),
    updateWikiCustomProps: (schema) => invoke("updateWikiCustomProps", schema),
    countWikiFieldUsage: (key) => invoke("countWikiFieldUsage", key),
    listWikiIncomingRefs: (targetId) =>
      invoke("listWikiIncomingRefs", targetId),
    listViews: () => invoke("listViews"),
    createView: (input) => invoke("createView", input ?? {}),
    updateView: (viewId, patch) => invoke("updateView", viewId, patch),
    deleteView: (viewId) => invoke("deleteView", viewId),
    getViewOrder: (viewKey) => invoke("getViewOrder", viewKey),
    getAllViewOrders: () => invoke("getAllViewOrders"),
    setViewOrder: (viewKey, order) => invoke("setViewOrder", viewKey, order),
    pruneViewOrderKey: (movedKey, activeViewKey) =>
      invoke("pruneViewOrderKey", movedKey, activeViewKey),
    doctor: () => invoke("doctor"),
    adoptStray: (strayPath) => invoke("adoptStray", strayPath),
    revealPath: (targetPath) => invoke("revealPath", targetPath),
    openPath: (targetPath) => invoke("openPath", targetPath),
    openPmNode: (ref) => invoke("openPmNode", ref),
    closePmPanel: () => invoke("closePmPanel"),
    getGitSyncStatus: (options) => invoke("getGitSyncStatus", options ?? {}),
    getUnsyncedChanges: () => invoke("getUnsyncedChanges"),
    pullWorkspace: () => invoke("pullWorkspace"),
    listNodeAssets: (ref) => invoke("listNodeAssets", ref),
    addNodeAssets: (ref) => invoke("addNodeAssets", ref),
    importNodeAssetPaths: (ref, paths) =>
      invoke("importNodeAssetPaths", ref, paths),
    writeNodeAssetBuffers: (ref, items) =>
      invoke(
        "writeNodeAssetBuffers",
        ref,
        (items ?? []).map((it) => ({
          name: it.name,
          data: Array.from(it.data ?? []),
        })),
      ),
    getNodeAssetsDir: (ref) => invoke("getNodeAssetsDir", ref),
    getWiki: () => invoke("getWiki"),
    getWikiNode: (id) => invoke("getWikiNode", id),
    createWikiNode: (input) => invoke("createWikiNode", input ?? {}),
    updateWikiNode: (id, patch, options) =>
      invoke("updateWikiNode", id, patch, options),
    deleteWikiNode: (id, options) => invoke("deleteWikiNode", id, options),
    setWikiSidebar: (nodes) => invoke("setWikiSidebar", nodes),
    moveWikiNodeInSidebar: (id, move) =>
      invoke("moveWikiNodeInSidebar", id, move),
    moveWikiNodeToSidebarPosition: (id, placement) =>
      invoke("moveWikiNodeToSidebarPosition", id, placement),
    getMembers: () => invoke("getMembers"),
    getMember: (id) => invoke("getMember", id),
    createMember: (input) => invoke("createMember", input ?? {}),
    updateMember: (id, patch, options) =>
      invoke("updateMember", id, patch, options),
    setMemberAvatar: (id, sourcePath) =>
      invoke("setMemberAvatar", id, sourcePath),
    getMemberAvatarDataUrl: (id) => invoke("getMemberAvatarDataUrl", id),
    getLocalConfig: () => invoke("getLocalConfig"),
    setLocalMe: (memberId) => invoke("setLocalMe", memberId),
    getHandoffs: () => invoke("getHandoffs"),
    getHandoff: (id) => invoke("getHandoff", id),
    createHandoff: (input) => invoke("createHandoff", input),
    updateHandoff: (id, patch, options) =>
      invoke("updateHandoff", id, patch, options),
    onChanged: (handler) => {
      changedHandlers.add(handler);
      return () => {
        changedHandlers.delete(handler);
      };
    },
    onWorkspaceOpened: (handler) => {
      openedHandlers.add(handler);
      return () => {
        openedHandlers.delete(handler);
      };
    },
    onNewWorkspace: () => noopUnsub,
    onToggleTerminal: () => noopUnsub,
    onFullscreenChange: (handler) => {
      handler(false);
      return noopUnsub;
    },
    term: {
      create: async () => {
        throw new Error("Terminal is not available in the Cursor extension");
      },
      write: async () => undefined,
      resize: async () => undefined,
      kill: async () => undefined,
      onData: () => noopUnsub,
      onExit: () => noopUnsub,
    },
  };
})();
