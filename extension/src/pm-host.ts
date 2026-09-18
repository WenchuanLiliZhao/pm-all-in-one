import path from "node:path";

import { getGitSyncStatus, pullFastForward } from "../../app/electron/core/desktop/git-sync.js";
import { getUnsyncedChanges } from "../../app/electron/core/desktop/git-changes.js";
import {
  copyFilesIntoNodeAssets,
  getNodeAssetsDir,
  listNodeAssets,
  writeBuffersIntoNodeAssets,
  type NodeRef,
} from "../../app/electron/core/domain/node-assets.js";
import {
  countWikiFieldUsage,
  listWikiIncomingRefs,
  loadWikiCustomProps,
  writeWikiCustomProps,
} from "../../app/electron/core/domain/wiki-custom-props.js";
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
  type WikiSidebarPlacement,
  type WikiSidebarRootNode,
} from "../../app/electron/core/domain/wiki.js";
import {
  createMember,
  ensureMembers,
  getMember,
  getMemberAvatarDataUrl,
  getMemberSnapshot,
  setMemberAvatar,
  updateMember,
} from "../../app/electron/core/domain/members.js";
import {
  createHandoff,
  ensureHandoffs,
  getHandoff,
  getHandoffSnapshot,
  updateHandoff,
} from "../../app/electron/core/domain/handoffs.js";
import {
  readLocalConfig,
  writeLocalConfig,
} from "../../app/electron/core/workspace/local-config.js";
import { rebuildIndex } from "../../app/electron/core/workspace/rebuild-index.js";
import { ensureLocalJsonGitignore } from "../../app/electron/core/workspace/workspace-gitignore.js";
import { ensureStructuralGitkeeps } from "../../app/electron/core/workspace/workspace-gitkeep.js";
import {
  scaffoldWorkspace,
  type ScaffoldWorkspaceOptions,
} from "../../app/electron/core/workspace/scaffold-workspace.js";
import { setLastWorkspaceRoot } from "../../app/electron/core/workspace/settings.js";
import {
  assertSupportedLayout,
  createIssue,
  createProject,
  deleteIssue,
  deleteProject,
  getCustomPropsForProject,
  getIssue,
  isValidWorkspace,
  listIssues,
  listProjects,
  moveIssue,
  updateCustomPropsForProject,
  updateIssue,
  updateProject,
} from "../../app/electron/core/domain/store.js";
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
  WikiCustomPropsSchema,
  WorkspacePatch,
} from "../../app/electron/core/identity/types.js";
import {
  encodeStaleWriteMessage,
  isStaleWriteError,
} from "../../app/electron/core/sync/detail-diff.js";
import {
  ensureWorkspaceMeta,
  updateWorkspaceMeta,
} from "../../app/electron/core/domain/workspace-meta.js";
import {
  createView,
  deleteView,
  ensureViews,
  listViews,
  updateView,
  type CreateViewInput,
  type UpdateViewInput,
} from "../../app/electron/core/views/views.js";
import {
  ensureViewOrders,
  getAllViewOrders,
  getViewOrder,
  pruneKeyFromOtherViews,
  setViewOrder,
  type ViewOrder,
} from "../../app/electron/core/views/view-orders.js";
import { adoptStray, scanWorkspace } from "../../app/electron/core/workspace/doctor.js";
import { WorkspaceWatcher } from "../../app/electron/core/workspace/watch.js";

export type HostUi = {
  pickDirectory: (title?: string) => Promise<string | null>;
  pickAssetPaths: () => Promise<string[]>;
  confirmDangerous: (opts: {
    title: string;
    message: string;
    detail?: string;
  }) => Promise<boolean>;
  confirmUnsavedLeave: (opts: {
    title: string;
    message: string;
    detail?: string;
  }) => Promise<"save" | "discard" | "cancel">;
  revealPath: (targetPath: string) => Promise<boolean>;
  openPath: (targetPath: string) => Promise<boolean>;
};

export type WorkspaceSnapshot = Awaited<ReturnType<PmSession["openWorkspaceAt"]>>;

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

async function wrapStale<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isStaleWriteError(e)) {
      throw new Error(encodeStaleWriteMessage(e));
    }
    throw e;
  }
}

export class PmSession {
  private root: string | null = null;
  private lastSnap: WorkspaceSnapshot | null = null;
  private readonly watcher = new WorkspaceWatcher();

  constructor(
    private readonly ui: HostUi,
    private readonly emit: (event: string, payload: unknown) => void,
  ) {}

  dispose(): void {
    this.watcher.stop();
    this.root = null;
    this.lastSnap = null;
  }

  currentRoot(): string | null {
    return this.root;
  }

  snapshot(): WorkspaceSnapshot | null {
    return this.lastSnap;
  }

  private requireRoot(): string {
    if (!this.root) {
      throw new Error("No workspace open");
    }
    return this.root;
  }

  async openWorkspaceAt(root: string): Promise<{
    root: string;
    meta: Awaited<ReturnType<typeof ensureWorkspaceMeta>>;
    projects: Awaited<ReturnType<typeof listProjects>>;
    tree: Awaited<ReturnType<typeof rebuildIndex>>;
    issues: Awaited<ReturnType<typeof listIssues>>;
    strays: Awaited<ReturnType<typeof scanWorkspace>>;
  }> {
    const resolved = path.resolve(root);
    if (this.root === resolved && this.lastSnap) {
      this.emit("workspaceOpened", this.lastSnap);
      return this.lastSnap;
    }
    if (!isValidWorkspace(resolved)) {
      throw new Error(
        `Not a workspace (need issue-hierarchy/ and .pm/): ${root}`,
      );
    }
    assertSupportedLayout(resolved);
    this.root = resolved;
    setLastWorkspaceRoot(resolved);
    ensureViews(resolved);
    ensureViewOrders(resolved);
    ensureLocalJsonGitignore(resolved);
    ensureStructuralGitkeeps(resolved);
    await ensureWiki(resolved);
    await ensureMembers(resolved);
    await ensureHandoffs(resolved);
    const meta = await ensureWorkspaceMeta(resolved);
    const tree = await rebuildIndex(resolved);
    const projects = await listProjects(resolved);
    const issues = await listIssues(resolved);
    const strays = await scanWorkspace(resolved);
    this.watcher.start(resolved, (payload) => {
      this.emit("changed", payload);
    });
    const snap = { root: resolved, meta, projects, tree, issues, strays };
    this.lastSnap = snap;
    this.emit("workspaceOpened", snap);
    return snap;
  }

  async invoke(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case "openUiLab":
        return undefined;
      case "openWorkspace":
        return this.openWorkspaceDialog();
      case "pickDirectory":
        return this.ui.pickDirectory(args[0] as string | undefined);
      case "createWorkspaceAt":
        return this.createWorkspaceAt(
          args[0] as string,
          args[1] as string,
          args[2] as ScaffoldWorkspaceOptions | undefined,
        );
      case "openWorkspacePath":
        return this.openWorkspaceAt(args[0] as string);
      case "restoreWorkspace":
        return this.restoreWorkspace();
      case "updateWorkspace":
        return wrapStale(() =>
          updateWorkspaceMeta(
            this.requireRoot(),
            args[0] as WorkspacePatch,
            args[1] as never,
          ),
        );
      case "getTree":
        return rebuildIndex(this.requireRoot());
      case "listProjects":
        return listProjects(this.requireRoot());
      case "listIssues":
        return listIssues(this.requireRoot());
      case "getIssue":
        return getIssue(
          this.requireRoot(),
          args[0] as string,
          args[1] as string,
        );
      case "createProject": {
        const root = this.requireRoot();
        const me = readLocalConfig(root).me;
        return createProject(root, (args[0] as ProjectCreateInput) ?? {}, {
          actorMemberId: me,
        });
      }
      case "updateProject":
        return wrapStale(() =>
          updateProject(
            this.requireRoot(),
            args[0] as string,
            args[1] as ProjectPatch,
            args[2] as never,
          ),
        );
      case "deleteProject":
        return deleteProject(
          this.requireRoot(),
          args[0] as string,
          args[1] as { cascade?: boolean } | undefined,
        ).then(() => true);
      case "createIssue": {
        const root = this.requireRoot();
        const me = readLocalConfig(root).me;
        return createIssue(root, args[0] as IssueCreateInput, {
          actorMemberId: me,
        });
      }
      case "updateIssue":
        return wrapStale(() =>
          updateIssue(
            this.requireRoot(),
            args[0] as string,
            args[1] as string,
            args[2] as IssuePatch,
            args[3] as never,
          ),
        );
      case "deleteIssue":
        return deleteIssue(
          this.requireRoot(),
          args[0] as string,
          args[1] as string,
          args[2] as { cascade?: boolean } | undefined,
        ).then(() => true);
      case "confirmDangerous":
        return this.ui.confirmDangerous(
          args[0] as { title: string; message: string; detail?: string },
        );
      case "confirmUnsavedLeave":
        return this.ui.confirmUnsavedLeave(
          args[0] as { title: string; message: string; detail?: string },
        );
      case "moveIssue":
        return moveIssue(this.requireRoot(), args[0] as MoveIssueInput);
      case "getCustomProps":
        return getCustomPropsForProject(this.requireRoot(), args[0] as string);
      case "updateCustomProps":
        return updateCustomPropsForProject(
          this.requireRoot(),
          args[0] as string,
          args[1] as CustomPropsSchema,
        );
      case "getWikiCustomProps":
        return loadWikiCustomProps(this.requireRoot());
      case "updateWikiCustomProps": {
        const root = this.requireRoot();
        writeWikiCustomProps(root, args[0] as WikiCustomPropsSchema);
        return loadWikiCustomProps(root);
      }
      case "countWikiFieldUsage":
        return countWikiFieldUsage(this.requireRoot(), args[0] as string);
      case "listWikiIncomingRefs":
        return listWikiIncomingRefs(this.requireRoot(), args[0] as string);
      case "listViews":
        return listViews(this.requireRoot());
      case "createView":
        return createView(
          this.requireRoot(),
          (args[0] as CreateViewInput) ?? {},
        );
      case "updateView":
        return updateView(
          this.requireRoot(),
          args[0] as string,
          args[1] as UpdateViewInput,
        );
      case "deleteView":
        return deleteView(this.requireRoot(), args[0] as string);
      case "getViewOrder":
        return getViewOrder(this.requireRoot(), args[0] as string);
      case "getAllViewOrders":
        return getAllViewOrders(this.requireRoot());
      case "setViewOrder":
        return setViewOrder(
          this.requireRoot(),
          args[0] as string,
          args[1] as ViewOrder,
        );
      case "pruneViewOrderKey":
        pruneKeyFromOtherViews(
          this.requireRoot(),
          args[0] as string,
          args[1] as string,
        );
        return undefined;
      case "doctor":
        return scanWorkspace(this.requireRoot());
      case "adoptStray":
        return adoptStray(this.requireRoot(), args[0] as string);
      case "revealPath":
        return this.ui.revealPath(args[0] as string);
      case "openPath":
        return this.ui.openPath(args[0] as string);
      case "getGitSyncStatus":
        return getGitSyncStatus(
          this.requireRoot(),
          (args[0] as { fetch?: boolean } | undefined) ?? {},
        );
      case "getUnsyncedChanges":
        return getUnsyncedChanges(this.requireRoot());
      case "pullWorkspace":
        return pullFastForward(this.requireRoot());
      case "listNodeAssets":
        return listNodeAssets(this.requireRoot(), args[0] as NodeRef);
      case "getNodeAssetsDir":
        return getNodeAssetsDir(this.requireRoot(), args[0] as NodeRef);
      case "addNodeAssets":
        return this.addNodeAssets(args[0] as NodeRef);
      case "importNodeAssetPaths":
        return copyFilesIntoNodeAssets(
          this.requireRoot(),
          args[0] as NodeRef,
          (args[1] as string[]) ?? [],
        );
      case "writeNodeAssetBuffers":
        return writeBuffersIntoNodeAssets(
          this.requireRoot(),
          args[0] as NodeRef,
          ((args[1] as { name: string; data: number[] | Uint8Array }[]) ?? []).map(
            (it) => ({
              name: it.name,
              bytes:
                it.data instanceof Uint8Array
                  ? it.data
                  : Uint8Array.from(it.data ?? []),
            }),
          ),
        );
      case "getWiki":
        return getWikiSnapshot(this.requireRoot());
      case "getWikiNode":
        return getWikiNode(this.requireRoot(), args[0] as string);
      case "createWikiNode": {
        const root = this.requireRoot();
        const input = (args[0] as CreateWikiNodeInput | undefined) ?? {};
        const me = readLocalConfig(root).me;
        return createWikiNode(root, {
          ...input,
          actorMemberId:
            input.actorMemberId !== undefined ? input.actorMemberId : me,
        });
      }
      case "updateWikiNode":
        return wrapStale(() =>
          updateWikiNode(
            this.requireRoot(),
            args[0] as string,
            args[1] as WikiNodePatch,
            args[2] as never,
          ),
        );
      case "deleteWikiNode":
        return deleteWikiNode(
          this.requireRoot(),
          args[0] as string,
          args[1] as { removeFile?: boolean } | undefined,
        );
      case "setWikiSidebar":
        return setWikiSidebar(
          this.requireRoot(),
          args[0] as WikiSidebarRootNode[],
        );
      case "moveWikiNodeInSidebar":
        return moveWikiNodeInSidebar(
          this.requireRoot(),
          args[0] as string,
          args[1] as WikiSidebarMove,
        );
      case "moveWikiNodeToSidebarPosition":
        return moveWikiNodeToSidebarPosition(
          this.requireRoot(),
          args[0] as string,
          args[1] as WikiSidebarPlacement,
        );
      case "getMembers":
        return getMemberSnapshot(this.requireRoot());
      case "getMember":
        return getMember(this.requireRoot(), args[0] as string);
      case "createMember":
        return createMember(
          this.requireRoot(),
          (args[0] as CreateMemberInput) ?? {},
        );
      case "updateMember":
        return wrapStale(() =>
          updateMember(
            this.requireRoot(),
            args[0] as string,
            args[1] as MemberPatch,
            args[2] as never,
          ),
        );
      case "setMemberAvatar": {
        const root = this.requireRoot();
        setMemberAvatar(root, args[0] as string, args[1] as string);
        return getMember(root, args[0] as string);
      }
      case "getMemberAvatarDataUrl":
        return getMemberAvatarDataUrl(this.requireRoot(), args[0] as string);
      case "getLocalConfig": {
        const { me } = readLocalConfig(this.requireRoot());
        return { me };
      }
      case "setLocalMe": {
        const next = writeLocalConfig(this.requireRoot(), {
          me: args[0] as string | null,
        });
        return { me: next.me };
      }
      case "getHandoffs":
        return getHandoffSnapshot(this.requireRoot());
      case "getHandoff":
        return getHandoff(this.requireRoot(), args[0] as string);
      case "createHandoff":
        return createHandoff(this.requireRoot(), args[0] as CreateHandoffInput);
      case "updateHandoff":
        return wrapStale(() =>
          updateHandoff(
            this.requireRoot(),
            args[0] as string,
            args[1] as HandoffPatch,
            args[2] as never,
          ),
        );
      default:
        throw new Error(`Unknown PM method: ${method}`);
    }
  }

  private async restoreWorkspace(): Promise<WorkspaceSnapshot | null> {
    if (this.lastSnap) {
      return this.lastSnap;
    }
    if (this.root && isValidWorkspace(this.root)) {
      return this.openWorkspaceAt(this.root);
    }
    return null;
  }

  private async openWorkspaceDialog(): Promise<WorkspaceSnapshot | null> {
    const dir = await this.ui.pickDirectory("Open workspace");
    if (!dir) {
      return null;
    }
    return this.openWorkspaceAt(dir);
  }

  private async createWorkspaceAt(
    parentDir: string,
    folderName: string,
    options?: ScaffoldWorkspaceOptions,
  ): Promise<WorkspaceSnapshot> {
    if (!parentDir?.trim()) {
      throw new Error("Parent folder is required.");
    }
    const root = resolveNewWorkspaceRoot(parentDir, folderName);
    scaffoldWorkspace(root, options ?? {});
    return this.openWorkspaceAt(root);
  }

  private async addNodeAssets(ref: NodeRef): Promise<string[]> {
    const paths = await this.ui.pickAssetPaths();
    if (paths.length === 0) {
      return [];
    }
    return copyFilesIntoNodeAssets(this.requireRoot(), ref, paths);
  }
}
