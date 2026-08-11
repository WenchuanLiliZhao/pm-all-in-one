// ↔ src/lib/bridge/pm-api.ts — implements PmApi over HTTP
// ↔ src/lib/bridge.ts — getPm() falls back here without window.pm
// ↔ server/main.ts — HTTP + SSE landings for these calls
// ↔ electron/preload.cts — Electron twin of the same contract
// ↔ electron/core/detail-diff.ts — reconstruct StaleWriteError from 409 body
import type {
  IssueEditableSlice,
  MemberEditableSlice,
  HandoffEditableSlice,
  ProjectEditableSlice,
  WikiEditableSlice,
  WorkspaceEditableSlice,
} from "@pm-core/detail-diff";
import { StaleWriteError } from "@pm-core/detail-diff";
import type {
  AdoptResult,
  CreateHandoffInput,
  CreateMemberInput,
  CreateWikiNodeInput,
  CreateViewInput,
  CustomPropsSchema,
  DoctorReport,
  WikiNode,
  WikiNodePatch,
  WikiSnapshot,
  WikiSidebarMove,
  WikiSidebarNode,
  WikiSidebarPlacement,
  Handoff,
  HandoffPatch,
  HandoffSnapshot,
  Issue,
  IssueCreateInput,
  IssuePatch,
  IssueTree,
  Member,
  MemberPatch,
  MemberSnapshot,
  MoveIssueInput,
  Project,
  ProjectCreateInput,
  ProjectPatch,
  UpdateViewInput,
  ViewOrder,
  ViewOrdersFile,
  WorkspaceMeta,
  WorkspacePatch,
  WorkspaceSnapshot,
  WorkspaceView,
} from "../types";
import type { CreateWorkspaceOptions, LocalConfigMe, PmApi } from "./pm-api";

type ChangedPayload = {
  projects: Project[];
  tree: IssueTree;
  issues: Issue[];
  strays?: DoctorReport;
  meta?: WorkspaceMeta;
  customProps?: Record<string, CustomPropsSchema>;
};

const API = "/api";

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      throw new Error(
        `Invalid JSON from ${method} ${path}: ${text.slice(0, 200)}`,
      );
    }
  }
  if (!res.ok) {
    if (
      data &&
      typeof data === "object" &&
      (data as { code?: string }).code === "stale-write"
    ) {
      const bodyErr = data as {
        error?: string;
        conflictPaths?: string[];
      };
      throw new StaleWriteError(
        bodyErr.error ?? "Stale write",
        bodyErr.conflictPaths ?? [],
      );
    }
    const err =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `${res.status} ${res.statusText}`;
    throw new Error(err);
  }
  return data as T;
}

function unsupported(op: string): never {
  throw new Error(`${op} is not available in web mode`);
}

function subscribeSse(handlers: {
  onChanged?: (payload: ChangedPayload) => void;
}): () => void {
  const es = new EventSource(`${API}/events`);
  const onChanged = (ev: MessageEvent) => {
    handlers.onChanged?.(JSON.parse(String(ev.data)) as ChangedPayload);
  };
  es.addEventListener("changed", onChanged as EventListener);
  return () => {
    es.removeEventListener("changed", onChanged as EventListener);
    es.close();
  };
}

export function createHttpPmApi(): PmApi {
  const changedHandlers = new Set<(payload: ChangedPayload) => void>();
  let sseUnsub: (() => void) | null = null;

  const ensureSse = () => {
    if (sseUnsub) {
      return;
    }
    sseUnsub = subscribeSse({
      onChanged: (payload) => {
        for (const h of changedHandlers) {
          h(payload);
        }
      },
    });
  };

  return {
    platform: "web",

    openUiLab: async () => {
      if (!import.meta.env.DEV) {
        return;
      }
      window.open(
        `${window.location.origin}${window.location.pathname}#/lab`,
        "_blank",
        "noopener,noreferrer",
      );
    },

    openWorkspace: async () => unsupported("openWorkspace"),
    pickDirectory: async () => unsupported("pickDirectory"),
    createWorkspaceAt: async (
      _parentDir: string,
      _folderName: string,
      _options?: CreateWorkspaceOptions,
    ) => unsupported("createWorkspaceAt"),
    openWorkspacePath: async (_root: string) =>
      unsupported("openWorkspacePath"),

    restoreWorkspace: () => request<WorkspaceSnapshot>("GET", "/workspace"),
    updateWorkspace: (
      patch: WorkspacePatch,
      options?: { expected?: WorkspaceEditableSlice },
    ) =>
      request<WorkspaceMeta>("PATCH", "/workspace", {
        ...patch,
        expected: options?.expected,
      }),

    getTree: () => request<IssueTree>("GET", "/tree"),
    listProjects: () => request<Project[]>("GET", "/projects"),
    listIssues: () => request<Issue[]>("GET", "/issues"),
    getIssue: (projectId, issueId) =>
      request<Issue>("GET", `/issues/${projectId}/${issueId}`),

    createProject: (input?: ProjectCreateInput) =>
      request<Project>("POST", "/projects", input ?? {}),
    updateProject: (
      projectId,
      patch: ProjectPatch,
      options?: { expected?: ProjectEditableSlice },
    ) =>
      request<Project>("PATCH", `/projects/${projectId}`, {
        ...patch,
        expected: options?.expected,
      }),
    deleteProject: (projectId, options) => {
      const q = options?.cascade === false ? "?cascade=false" : "?cascade=true";
      return request<boolean>("DELETE", `/projects/${projectId}${q}`);
    },

    createIssue: (input: IssueCreateInput) =>
      request<Issue>("POST", "/issues", input),
    updateIssue: (
      projectId,
      issueId,
      patch: IssuePatch,
      options?: { expected?: IssueEditableSlice },
    ) =>
      request<Issue>("PATCH", `/issues/${projectId}/${issueId}`, {
        ...patch,
        expected: options?.expected,
      }),
    deleteIssue: (projectId, issueId, options) => {
      const q = options?.cascade ? "?cascade=true" : "";
      return request<boolean>(
        "DELETE",
        `/issues/${projectId}/${issueId}${q}`,
      );
    },

    confirmDangerous: async (opts) => {
      const detail = opts.detail ? `\n\n${opts.detail}` : "";
      return window.confirm(`${opts.title}\n\n${opts.message}${detail}`);
    },

    moveIssue: (input: MoveIssueInput) =>
      request<Issue>("POST", "/issues/move", input),

    getCustomProps: (projectId) =>
      request<CustomPropsSchema>("GET", `/projects/${projectId}/custom-props`),
    updateCustomProps: (projectId, schema) =>
      request<CustomPropsSchema>(
        "PUT",
        `/projects/${projectId}/custom-props`,
        schema,
      ),

    listViews: () => request<WorkspaceView[]>("GET", "/views"),
    createView: (input?: CreateViewInput) =>
      request<WorkspaceView>("POST", "/views", input ?? {}),
    updateView: (viewId, patch: UpdateViewInput) =>
      request<WorkspaceView>("PATCH", `/views/${viewId}`, patch),
    deleteView: (viewId) => request<boolean>("DELETE", `/views/${viewId}`),

    getViewOrder: (viewKey) =>
      request<ViewOrder>("GET", `/view-orders/${encodeURIComponent(viewKey)}`),
    getAllViewOrders: () => request<ViewOrdersFile>("GET", "/view-orders"),
    setViewOrder: (viewKey, order) =>
      request<ViewOrder>(
        "PUT",
        `/view-orders/${encodeURIComponent(viewKey)}`,
        order,
      ),
    pruneViewOrderKey: (movedKey, activeViewKey) =>
      request<void>("POST", "/view-orders/prune", { movedKey, activeViewKey }),

    doctor: () => request<DoctorReport>("GET", "/doctor"),
    adoptStray: (strayPath) =>
      request<AdoptResult>("POST", "/doctor/adopt", { strayPath }),
    revealPath: async () => false,

    listNodeAssets: async () => [],
    addNodeAssets: async () => unsupported("addNodeAssets"),
    getNodeAssetsDir: async () => null,

    getWiki: () => request<WikiSnapshot>("GET", "/wiki"),
    getWikiNode: (id) =>
      request<WikiNode>("GET", `/wiki/${encodeURIComponent(id)}`),
    createWikiNode: (input?: CreateWikiNodeInput) =>
      request<WikiNode>("POST", "/wiki", input ?? {}),
    updateWikiNode: (
      id,
      patch: WikiNodePatch,
      options?: { expected?: WikiEditableSlice },
    ) =>
      request<WikiNode>("PATCH", `/wiki/${encodeURIComponent(id)}`, {
        ...patch,
        expected: options?.expected,
      }),
    deleteWikiNode: (id, options) => {
      const q =
        options?.removeFile === false ? "?removeFile=false" : "";
      return request<boolean>(
        "DELETE",
        `/wiki/${encodeURIComponent(id)}${q}`,
      );
    },
    setWikiSidebar: (nodes: WikiSidebarNode[]) =>
      request<WikiSidebarNode[]>("PUT", "/wiki/sidebar", { nodes }),
    moveWikiNodeInSidebar: (id, move: WikiSidebarMove) =>
      request<WikiSnapshot>("POST", "/wiki/sidebar/move", { id, move }),
    moveWikiNodeToSidebarPosition: (id, placement: WikiSidebarPlacement) =>
      request<WikiSnapshot>("POST", "/wiki/sidebar/move-to", { id, placement }),

    getMembers: () => request<MemberSnapshot>("GET", "/members"),
    getMember: (id) =>
      request<Member>("GET", `/members/${encodeURIComponent(id)}`),
    createMember: (input?: CreateMemberInput) =>
      request<Member>("POST", "/members", input ?? {}),
    updateMember: (
      id,
      patch: MemberPatch,
      options?: { expected?: MemberEditableSlice },
    ) =>
      request<Member>("PATCH", `/members/${encodeURIComponent(id)}`, {
        ...patch,
        expected: options?.expected,
      }),
    setMemberAvatar: (id, sourcePath) =>
      request<Member>("POST", `/members/${encodeURIComponent(id)}/avatar`, {
        sourcePath,
      }),
    getMemberAvatarDataUrl: async (id) => {
      const res = await request<{ dataUrl: string | null }>(
        "GET",
        `/members/${encodeURIComponent(id)}/avatar-data`,
      );
      return res.dataUrl;
    },
    getLocalConfig: () => request<LocalConfigMe>("GET", "/local-config"),
    setLocalMe: (memberId) =>
      request<LocalConfigMe>("PUT", "/local-config/me", { me: memberId }),

    getHandoffs: () => request<HandoffSnapshot>("GET", "/handoffs"),
    getHandoff: (id) =>
      request<Handoff>("GET", `/handoffs/${encodeURIComponent(id)}`),
    createHandoff: (input: CreateHandoffInput) =>
      request<Handoff>("POST", "/handoffs", input),
    updateHandoff: (
      id,
      patch: HandoffPatch,
      options?: { expected?: HandoffEditableSlice },
    ) =>
      request<Handoff>("PATCH", `/handoffs/${encodeURIComponent(id)}`, {
        ...patch,
        expected: options?.expected,
      }),

    onChanged: (handler) => {
      ensureSse();
      changedHandlers.add(handler);
      return () => {
        changedHandlers.delete(handler);
      };
    },
    onWorkspaceOpened: () => () => undefined,
    onNewWorkspace: () => () => undefined,
    onToggleTerminal: () => () => undefined,
    onFullscreenChange: () => () => undefined,

    term: {
      create: async () => unsupported("term.create"),
      write: async () => unsupported("term.write"),
      resize: async () => unsupported("term.resize"),
      kill: async () => unsupported("term.kill"),
      onData: () => () => undefined,
      onExit: () => () => undefined,
    },
  };
}
