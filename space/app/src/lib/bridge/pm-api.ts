// ↔ electron/preload.cts — Electron window.pm implements this contract
// ↔ src/lib/bridge/http-pm.ts — web HTTP client implements this contract
// ↔ src/lib/bridge.ts — getPm() picks preload vs HTTP
// ↔ electron/core/detail-diff.ts — OCC editable slices / StaleWriteError in signatures
import type {
  IssueEditableSlice,
  MemberEditableSlice,
  HandoffEditableSlice,
  ProjectEditableSlice,
  WikiEditableSlice,
  WorkspaceEditableSlice,
} from "@pm-core/detail-diff";
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
  EntityId,
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

export interface CreateWorkspaceOptions {
  /** Display title for workspace.ts (independent of folder name). */
  title?: string;
  seedProject?: { title: string };
}

/** Target node for per-node `assets/` (optional folder; absent when empty). */
export type NodeRef =
  | { kind: "workspace" }
  | { kind: "project"; projectId: string }
  | { kind: "issue"; projectId: string; issueId: string }
  | { kind: "wiki"; wikiNodeId: string }
  | { kind: "member"; memberId: string }
  | { kind: "handoff"; handoffId: string };

/** Subset of `.pm/local.json` exposed over PmApi (machine-local `me`). */
export type LocalConfigMe = { me?: string | null };

export interface PmApi {
  platform: string;
  /** Dev-only: open UI Lab in a side window (Electron) or new tab (web). */
  openUiLab: () => Promise<void>;
  openWorkspace: () => Promise<WorkspaceSnapshot | null>;
  pickDirectory: (title?: string) => Promise<string | null>;
  createWorkspaceAt: (
    parentDir: string,
    folderName: string,
    options?: CreateWorkspaceOptions,
  ) => Promise<WorkspaceSnapshot>;
  openWorkspacePath: (root: string) => Promise<WorkspaceSnapshot>;
  restoreWorkspace: () => Promise<WorkspaceSnapshot | null>;
  updateWorkspace: (
    patch: WorkspacePatch,
    options?: { expected?: WorkspaceEditableSlice },
  ) => Promise<WorkspaceMeta>;
  getTree: () => Promise<IssueTree>;
  listProjects: () => Promise<Project[]>;
  listIssues: () => Promise<Issue[]>;
  getIssue: (projectId: EntityId, issueId: EntityId) => Promise<Issue>;
  createProject: (input?: ProjectCreateInput) => Promise<Project>;
  updateProject: (
    projectId: EntityId,
    patch: ProjectPatch,
    options?: { expected?: ProjectEditableSlice },
  ) => Promise<Project>;
  deleteProject: (
    projectId: EntityId,
    options?: { cascade?: boolean },
  ) => Promise<boolean>;
  createIssue: (input: IssueCreateInput) => Promise<Issue>;
  updateIssue: (
    projectId: EntityId,
    issueId: EntityId,
    patch: IssuePatch,
    options?: { expected?: IssueEditableSlice },
  ) => Promise<Issue>;
  deleteIssue: (
    projectId: EntityId,
    issueId: EntityId,
    options?: { cascade?: boolean },
  ) => Promise<boolean>;
  confirmDangerous: (opts: {
    title: string;
    message: string;
    detail?: string;
  }) => Promise<boolean>;
  moveIssue: (input: MoveIssueInput) => Promise<Issue>;
  getCustomProps: (projectId: EntityId) => Promise<CustomPropsSchema>;
  updateCustomProps: (
    projectId: EntityId,
    schema: CustomPropsSchema,
  ) => Promise<CustomPropsSchema>;
  listViews: () => Promise<WorkspaceView[]>;
  createView: (input?: CreateViewInput) => Promise<WorkspaceView>;
  updateView: (
    viewId: string,
    patch: UpdateViewInput,
  ) => Promise<WorkspaceView>;
  deleteView: (viewId: string) => Promise<boolean>;
  getViewOrder: (viewKey: string) => Promise<ViewOrder>;
  getAllViewOrders: () => Promise<ViewOrdersFile>;
  setViewOrder: (viewKey: string, order: ViewOrder) => Promise<ViewOrder>;
  pruneViewOrderKey: (
    movedKey: string,
    activeViewKey: string,
  ) => Promise<void>;
  doctor: () => Promise<DoctorReport>;
  adoptStray: (strayPath: string) => Promise<AdoptResult>;
  revealPath: (targetPath: string) => Promise<boolean>;

  /** Filenames under the node's `assets/` (missing dir → []). Desktop-only write path. */
  listNodeAssets: (ref: NodeRef) => Promise<string[]>;
  /**
   * Native multi-file picker; copies into the node's `assets/`.
   * Returns written basenames (after conflict rename). Cancel → [].
   */
  addNodeAssets: (ref: NodeRef) => Promise<string[]>;
  /** Absolute `assets/` path when the directory exists; otherwise null. */
  getNodeAssetsDir: (ref: NodeRef) => Promise<string | null>;

  getWiki: () => Promise<WikiSnapshot>;
  getWikiNode: (id: string) => Promise<WikiNode>;
  createWikiNode: (input?: CreateWikiNodeInput) => Promise<WikiNode>;
  updateWikiNode: (
    id: string,
    patch: WikiNodePatch,
    options?: { expected?: WikiEditableSlice },
  ) => Promise<WikiNode>;
  deleteWikiNode: (
    id: string,
    options?: { removeFile?: boolean },
  ) => Promise<boolean>;
  setWikiSidebar: (nodes: WikiSidebarNode[]) => Promise<WikiSidebarNode[]>;
  moveWikiNodeInSidebar: (
    id: string,
    move: WikiSidebarMove,
  ) => Promise<WikiSnapshot>;
  moveWikiNodeToSidebarPosition: (
    id: string,
    placement: WikiSidebarPlacement,
  ) => Promise<WikiSnapshot>;

  getMembers: () => Promise<MemberSnapshot>;
  getMember: (id: string) => Promise<Member>;
  createMember: (input?: CreateMemberInput) => Promise<Member>;
  updateMember: (
    id: string,
    patch: MemberPatch,
    options?: { expected?: MemberEditableSlice },
  ) => Promise<Member>;
  setMemberAvatar: (id: string, sourcePath: string) => Promise<Member>;
  /** Data URL for avatar `<img>`, or null when missing. */
  getMemberAvatarDataUrl: (id: string) => Promise<string | null>;
  getLocalConfig: () => Promise<LocalConfigMe>;
  setLocalMe: (memberId: string | null) => Promise<LocalConfigMe>;

  getHandoffs: () => Promise<HandoffSnapshot>;
  getHandoff: (id: string) => Promise<Handoff>;
  createHandoff: (input: CreateHandoffInput) => Promise<Handoff>;
  updateHandoff: (
    id: string,
    patch: HandoffPatch,
    options?: { expected?: HandoffEditableSlice },
  ) => Promise<Handoff>;

  onChanged: (
    handler: (payload: {
      projects: Project[];
      tree: IssueTree;
      issues: Issue[];
      strays?: DoctorReport;
      meta?: WorkspaceMeta;
      customProps?: Record<string, CustomPropsSchema>;
    }) => void,
  ) => () => void;
  onWorkspaceOpened: (handler: (snap: WorkspaceSnapshot) => void) => () => void;
  onNewWorkspace: (handler: () => void) => () => void;
  onToggleTerminal: (handler: () => void) => () => void;
  /**
   * macOS Electron: native fullscreen (traffic lights hidden).
   * Subscribe also receives the current value immediately (preload invoke).
   * Web stub never fires.
   */
  onFullscreenChange: (handler: (fullscreen: boolean) => void) => () => void;
  term: {
    create: (cols?: number, rows?: number) => Promise<string>;
    write: (sessionId: string, data: string) => Promise<void>;
    resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
    kill: (sessionId: string) => Promise<void>;
    onData: (
      handler: (payload: { sessionId: string; data: string }) => void,
    ) => () => void;
    onExit: (
      handler: (payload: { sessionId: string; exitCode: number }) => void,
    ) => () => void;
  };
}
