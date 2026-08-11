/**
 * Zone 8 shell hub — workspace React context (state, selection, PmApi glue).
 * Orchestrates detail dirty/save/conflict via DetailSaveController + @pm-core/detail-diff;
 * do not sink more logic here (algorithms live in detail-save / detail-diff).
 * Known hub — do not keep piling logic.
 * ↔ DEVELOPMENT.md — Vibe zones / Electron vs web
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CreateWorkspaceWizard } from "@/components/create-workspace-wizard";
import { getPm } from "@/lib/bridge";
import type {
  CustomPropsSchema,
  DoctorWarning,
  Issue,
  IssuePatch,
  IssueTree,
  Project,
  ProjectPatch,
  StrayEntry,
  WorkspaceMeta,
  WorkspacePatch,
  WorkspaceSnapshot,
} from "@/lib/types";
import { issueRefKey } from "@/lib/types";
import {
  applyIssueEditable,
  classifyIssue,
  classifyProject,
  classifyWorkspace,
  isStaleWriteError,
  issueSlicesEqual,
  pickIssueEditable,
  pickProjectEditable,
  pickWorkspaceEditable,
  type IssueEditableSlice,
  type ProjectEditableSlice,
  type WorkspaceEditableSlice,
} from "@pm-core/detail-diff";
import {
  countTreeDescendants,
  formatDescendantCost,
} from "@/lib/workspace/delete-cost";
import {
  DetailSaveController,
  type DetailSaveStatus,
  type DetailSaveTarget,
} from "@/lib/workspace/detail-save";

export function workspaceNameFromPath(root: string): string {
  const parts = root.replace(/[/\\]+$/, "").split(/[/\\]/);
  return parts[parts.length - 1] || root;
}

export type Selection =
  | { kind: "project"; projectId: string }
  | { kind: "issue"; projectId: string; issueId: string }
  | null;

export type { DetailSaveStatus };

/** BorderlessTitle uses aria-label="Title" — skip write-back while focused. */
function isTitleInputFocused(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const el = document.activeElement;
  return (
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
    el.getAttribute("aria-label") === "Title"
  );
}

/** Dirty compare: trailing spaces on title do not count (Decision 3). */
function titleDirty(draft: string, baseline: string): boolean {
  return draft.trim() !== baseline.trim();
}

interface WorkspaceContextValue {
  root: string | null;
  meta: WorkspaceMeta | null;
  projects: Project[];
  tree: IssueTree | null;
  issues: Issue[];
  strays: StrayEntry[];
  selection: Selection;
  selectedProject: Project | null;
  selectedIssue: Issue | null;
  error: string | null;
  booting: boolean;
  terminalOpen: boolean;
  hasWorkspace: boolean;
  /** @deprecated Prefer saveStatus; true when dirty/saving/conflict. */
  dirty: boolean;
  /** @deprecated Prefer saveStatus === "saving". */
  saving: boolean;
  saveStatus: DetailSaveStatus;
  saveError: string | null;
  conflictPaths: string[];
  setError: (error: string | null) => void;
  setTerminalOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  openDialog: () => Promise<void>;
  openCreateWizard: () => void;
  createProject: () => Promise<void>;
  /** Create a wiki-node (Untitled). Always placed in Contents (root unless parentId). */
  createWikiNode: (opts?: {
    title?: string;
    parentId?: string | null;
  }) => Promise<void>;
  createChild: () => Promise<Issue | null>;
  updateIssueDraft: (patch: IssuePatch) => void;
  updateProjectDraft: (patch: ProjectPatch) => void;
  updateWorkspaceDraft: (patch: WorkspacePatch) => void;
  /** Persist start/end dates for an issue (Roadmap context menu); updates local state. */
  persistIssueDates: (
    projectId: string,
    issueId: string,
    dates: { startDate?: string | null; endDate?: string | null },
  ) => Promise<void>;
  /** Persist hard-dependency blockers (Roadmap dep curves); updates local state. */
  persistIssueBlockedBy: (
    projectId: string,
    issueId: string,
    blockedBy: string[],
  ) => Promise<void>;
  /** Persist priority for an issue (Table quick-edit); updates local state. */
  persistIssuePriority: (
    projectId: string,
    issueId: string,
    priority: Issue["priority"],
  ) => Promise<void>;
  /** Explicit detail save (Save button / Cmd+S / Retry). */
  saveDetail: () => Promise<boolean>;
  /** Flush pending autosave (blur / navigation). Holds on conflict / blank title. */
  flushDetail: () => Promise<boolean>;
  /** @deprecated Alias of saveDetail. */
  flushDetailSave: () => Promise<boolean>;
  /** @deprecated Alias of saveDetail. */
  saveCurrent: () => Promise<boolean>;
  /** Conflict banner: discard draft and take disk. */
  resolveConflictReload: () => Promise<void>;
  /** Conflict banner: keep draft; baseline := disk so Save overwrites. */
  resolveConflictKeep: () => void;
  select: (sel: Selection) => Promise<boolean>;
  handleDelete: () => Promise<void>;
  applySnapshot: (snap: WorkspaceSnapshot) => void;
  refreshCustomProps: (projectId: string) => Promise<CustomPropsSchema>;
  saveCustomProps: (
    projectId: string,
    schema: CustomPropsSchema,
  ) => Promise<void>;
  adoptStray: (strayPath: string) => Promise<void>;
  revealPath: (targetPath: string) => Promise<void>;
  dismissStray: (strayPath: string) => void;
  warnings: DoctorWarning[];
  dismissWarnings: () => void;
  moveIssueTo: (
    projectId: string,
    issueId: string,
    newParentIssueId: string | null,
  ) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [root, setRoot] = useState<string | null>(null);
  const [meta, setMeta] = useState<WorkspaceMeta | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tree, setTree] = useState<IssueTree | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [strays, setStrays] = useState<StrayEntry[]>([]);
  const [warnings, setWarnings] = useState<DoctorWarning[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<DetailSaveStatus>("clean");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictPaths, setConflictPaths] = useState<string[]>([]);
  const [createWizardOpen, setCreateWizardOpen] = useState(false);

  const dirtyRef = useRef(false);
  const selectionRef = useRef<Selection>(null);
  const issuesRef = useRef<Issue[]>([]);
  const projectsRef = useRef<Project[]>([]);
  const metaRef = useRef<WorkspaceMeta | null>(null);
  const treeRef = useRef<IssueTree | null>(null);
  const issueBaselineRef = useRef<IssueEditableSlice | null>(null);
  const projectBaselineRef = useRef<ProjectEditableSlice | null>(null);
  const workspaceBaselineRef = useRef<WorkspaceEditableSlice | null>(null);

  const detailSaveRef = useRef<DetailSaveController | null>(null);
  if (detailSaveRef.current === null) {
    detailSaveRef.current = new DetailSaveController({
      getTitleIsBlank: () => {
        const target = detailSaveRef.current?.getTarget();
        if (!target) {
          return false;
        }
        if (target.kind === "workspace") {
          return !(metaRef.current?.title.trim());
        }
        if (target.kind === "project") {
          const p = projectsRef.current.find((x) => x.id === target.projectId);
          return !(p?.title.trim());
        }
        if (target.kind === "issue") {
          const issue = issuesRef.current.find(
            (i) =>
              i.projectId === target.projectId && i.id === target.issueId,
          );
          return !(issue?.title.trim());
        }
        // Wiki / member use their own DetailSaveController instances.
        return false;
      },
      onStatus: (status, errorMessage, paths) => {
        setSaveStatus(status);
        setSaveError(errorMessage);
        setConflictPaths(paths);
        dirtyRef.current =
          status === "dirty" ||
          status === "saving" ||
          status === "conflict" ||
          // error with content still dirty is handled via hasUnsavedWork;
          // keep beforeunload in sync with controller.
          (status === "error" &&
            (detailSaveRef.current?.hasUnsavedWork() ?? false));
      },
      persist: async (target: DetailSaveTarget) => {
        const titleFocused = isTitleInputFocused();
        if (target.kind === "workspace") {
          const current = metaRef.current;
          if (!current) {
            return;
          }
          if (!current.title.trim()) {
            throw new Error("Workspace title is required.");
          }
          const expected = workspaceBaselineRef.current ?? undefined;
          const saved = await getPm().updateWorkspace(
            {
              title: current.title.trim(),
              description: current.description,
            },
            expected ? { expected } : undefined,
          );
          const next = titleFocused
            ? { ...saved, title: current.title }
            : saved;
          metaRef.current = next;
          setMeta(next);
          workspaceBaselineRef.current = pickWorkspaceEditable(saved);
          return;
        }
        if (target.kind === "issue") {
          const issue = issuesRef.current.find(
            (i) =>
              i.projectId === target.projectId && i.id === target.issueId,
          );
          if (!issue) {
            return;
          }
          if (!issue.title.trim()) {
            throw new Error("Issue title is required.");
          }
          const expected = issueBaselineRef.current ?? undefined;
          const saved = await getPm().updateIssue(
            target.projectId,
            target.issueId,
            {
              title: issue.title.trim(),
              status: issue.status,
              priority: issue.priority,
              startDate: issue.startDate,
              endDate: issue.endDate,
              blockedBy: issue.blockedBy,
              estimatePoint: issue.estimatePoint,
              description: issue.description,
              fields: issue.fields,
              markdownFields: issue.markdownFields,
            },
            expected ? { expected } : undefined,
          );
          const merged = titleFocused
            ? { ...saved, title: issue.title }
            : saved;
          setIssues((prev) => {
            const next = prev.map((i) =>
              i.projectId === merged.projectId && i.id === merged.id
                ? merged
                : i,
            );
            issuesRef.current = next;
            return next;
          });
          issueBaselineRef.current = pickIssueEditable(saved);
          return;
        }
        if (target.kind !== "project") {
          // Wiki / member persist via their own controllers.
          return;
        }
        const project = projectsRef.current.find(
          (p) => p.id === target.projectId,
        );
        if (!project) {
          return;
        }
        if (!project.title.trim()) {
          throw new Error("Project title is required.");
        }
        const expected = projectBaselineRef.current ?? undefined;
        const saved = await getPm().updateProject(
          target.projectId,
          {
            title: project.title.trim(),
            description: project.description,
          },
          expected ? { expected } : undefined,
        );
        const merged = titleFocused
          ? { ...saved, title: project.title }
          : saved;
        setProjects((prev) => {
          const next = prev.map((p) => (p.id === merged.id ? merged : p));
          projectsRef.current = next;
          return next;
        });
        projectBaselineRef.current = pickProjectEditable(saved);
      },
    });
  }

  const dirty =
    saveStatus === "dirty" ||
    saveStatus === "saving" ||
    saveStatus === "conflict" ||
    (saveStatus === "error" &&
      (detailSaveRef.current?.hasUnsavedWork() ?? false));
  const saving = saveStatus === "saving";

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  useEffect(() => {
    issuesRef.current = issues;
  }, [issues]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  useEffect(() => {
    const onBeforeUnload = (): void => {
      const ctrl = detailSaveRef.current;
      if (!(ctrl?.hasUnsavedWork() ?? dirtyRef.current)) {
        return;
      }
      // Decision 8: flush-then-leave, no browser discard prompt.
      // Best-effort — the page may still unload mid-write.
      void ctrl?.flush();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const hasWorkspace = Boolean(tree && root);
  const selectedProject =
    selection?.kind === "project"
      ? (projects.find((p) => p.id === selection.projectId) ?? null)
      : selection?.kind === "issue"
        ? (projects.find((p) => p.id === selection.projectId) ?? null)
        : null;
  const selectedIssue =
    selection?.kind === "issue"
      ? (issues.find(
          (i) =>
            i.projectId === selection.projectId && i.id === selection.issueId,
        ) ?? null)
      : null;

  const applySnapshot = useCallback((snap: WorkspaceSnapshot) => {
    detailSaveRef.current?.resetClean();
    issueBaselineRef.current = null;
    projectBaselineRef.current = null;
    workspaceBaselineRef.current = snap.meta
      ? pickWorkspaceEditable(snap.meta)
      : null;
    setRoot(snap.root);
    setMeta(snap.meta);
    metaRef.current = snap.meta;
    setProjects(snap.projects);
    setTree(snap.tree);
    setIssues(snap.issues);
    setStrays(snap.strays?.strays ?? []);
    setWarnings(snap.strays?.warnings ?? []);
    setError(null);
    setSelection((cur) => {
      if (cur?.kind === "project" && snap.projects.some((p) => p.id === cur.projectId)) {
        const p = snap.projects.find((x) => x.id === cur.projectId);
        if (p) {
          projectBaselineRef.current = pickProjectEditable(p);
        }
        return cur;
      }
      if (
        cur?.kind === "issue" &&
        snap.issues.some(
          (i) => i.projectId === cur.projectId && i.id === cur.issueId,
        )
      ) {
        const issue = snap.issues.find(
          (i) => i.projectId === cur.projectId && i.id === cur.issueId,
        );
        if (issue) {
          issueBaselineRef.current = pickIssueEditable(issue);
        }
        return cur;
      }
      return null;
    });
  }, []);

  useEffect(() => {
    const unsubChanged = getPm().onChanged((payload) => {
      const sel = selectionRef.current;
      let nextIssues = payload.issues;
      let nextProjects = payload.projects;
      let nextMeta = payload.meta ?? metaRef.current;

      // External delete of selected entity — clear without fake unsaved prompt.
      if (sel?.kind === "issue") {
        const diskIssue = payload.issues.find(
          (i) => i.projectId === sel.projectId && i.id === sel.issueId,
        );
        if (!diskIssue) {
          detailSaveRef.current?.resetClean();
          issueBaselineRef.current = null;
          selectionRef.current = null;
          setSelection(null);
          setProjects(nextProjects);
          setIssues(nextIssues);
          setTree(payload.tree);
          if (payload.meta) {
            setMeta(payload.meta);
            metaRef.current = payload.meta;
            workspaceBaselineRef.current = pickWorkspaceEditable(payload.meta);
          }
          if (payload.strays) {
            setStrays(payload.strays.strays);
            setWarnings(payload.strays.warnings);
          }
          return;
        }

        const local = issuesRef.current.find(
          (i) => i.projectId === sel.projectId && i.id === sel.issueId,
        );
        const baseline = issueBaselineRef.current;
        if (local && baseline) {
          const draft = pickIssueEditable(local);
          const disk = pickIssueEditable(diskIssue);
          const result = classifyIssue(baseline, draft, disk);
          // Structural fields always from disk; editable from merge.
          const merged = applyIssueEditable(diskIssue, result.mergedDraft);
          nextIssues = [
            ...payload.issues.filter(
              (i) => !(i.projectId === sel.projectId && i.id === sel.issueId),
            ),
            merged,
          ];
          issuesRef.current = nextIssues;
          issueBaselineRef.current = result.nextBaseline;
          detailSaveRef.current?.applySyncState(
            {
              kind: "issue",
              projectId: sel.projectId,
              issueId: sel.issueId,
            },
            result.hasLocalEdits,
            result.conflictPaths,
          );
        } else if (!baseline) {
          issueBaselineRef.current = pickIssueEditable(diskIssue);
          detailSaveRef.current?.resetClean();
        }
      } else if (sel?.kind === "project") {
        const diskProject = payload.projects.find(
          (p) => p.id === sel.projectId,
        );
        if (!diskProject) {
          detailSaveRef.current?.resetClean();
          projectBaselineRef.current = null;
          selectionRef.current = null;
          setSelection(null);
          setProjects(nextProjects);
          setIssues(nextIssues);
          setTree(payload.tree);
          if (payload.meta) {
            setMeta(payload.meta);
            metaRef.current = payload.meta;
          }
          if (payload.strays) {
            setStrays(payload.strays.strays);
            setWarnings(payload.strays.warnings);
          }
          return;
        }
        const local = projectsRef.current.find((p) => p.id === sel.projectId);
        const baseline = projectBaselineRef.current;
        if (local && baseline) {
          const draft = pickProjectEditable(local);
          const disk = pickProjectEditable(diskProject);
          const result = classifyProject(baseline, draft, disk);
          const merged: Project = {
            ...diskProject,
            ...result.mergedDraft,
          };
          nextProjects = [
            ...payload.projects.filter((p) => p.id !== sel.projectId),
            merged,
          ];
          projectsRef.current = nextProjects;
          projectBaselineRef.current = result.nextBaseline;
          detailSaveRef.current?.applySyncState(
            { kind: "project", projectId: sel.projectId },
            result.hasLocalEdits,
            result.conflictPaths,
          );
        } else if (!baseline) {
          projectBaselineRef.current = pickProjectEditable(diskProject);
          detailSaveRef.current?.resetClean();
        }
      } else if (payload.meta && metaRef.current) {
        // Home / workspace detail may be open without selection.
        const onHome =
          typeof window !== "undefined" &&
          window.location.hash.includes("/w/home");
        if (onHome || detailSaveRef.current?.getTarget()?.kind === "workspace") {
          const baseline =
            workspaceBaselineRef.current ??
            pickWorkspaceEditable(metaRef.current);
          const draft = pickWorkspaceEditable(metaRef.current);
          const disk = pickWorkspaceEditable(payload.meta);
          const result = classifyWorkspace(baseline, draft, disk);
          nextMeta = {
            ...payload.meta,
            ...result.mergedDraft,
            createdDate: payload.meta.createdDate,
          };
          metaRef.current = nextMeta;
          workspaceBaselineRef.current = result.nextBaseline;
          detailSaveRef.current?.applySyncState(
            { kind: "workspace" },
            result.hasLocalEdits,
            result.conflictPaths,
          );
        } else {
          nextMeta = payload.meta;
          metaRef.current = payload.meta;
          workspaceBaselineRef.current = pickWorkspaceEditable(payload.meta);
        }
      }

      setProjects(nextProjects);
      setIssues(nextIssues);
      setTree(payload.tree);
      if (nextMeta) {
        setMeta(nextMeta);
      }
      if (payload.strays) {
        setStrays(payload.strays.strays);
        setWarnings(payload.strays.warnings);
      }
    });
    const unsubOpened = getPm().onWorkspaceOpened((snap) => {
      applySnapshot(snap);
    });
    const unsubTerminal = getPm().onToggleTerminal(() => {
      setTerminalOpen((open) => !open);
    });
    const unsubNewWorkspace = getPm().onNewWorkspace(() => {
      setCreateWizardOpen(true);
    });
    return () => {
      unsubChanged();
      unsubOpened();
      unsubTerminal();
      unsubNewWorkspace();
    };
  }, [applySnapshot]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const snap = await getPm().restoreWorkspace();
        if (!cancelled && snap) {
          applySnapshot(snap);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySnapshot]);

  useEffect(() => {
    if (booting) {
      return;
    }
    // Lab is a DEV design-system surface and must not depend on workspace data.
    if (location.pathname.startsWith("/lab")) {
      return;
    }
    if (!hasWorkspace) {
      if (location.pathname !== "/") {
        navigate("/", { replace: true });
      }
      return;
    }
    if (location.pathname === "/" || location.pathname === "") {
      navigate("/w/home", { replace: true });
    }
  }, [booting, hasWorkspace, location.pathname, navigate]);

  const openDialog = useCallback(async () => {
    setError(null);
    try {
      const snap = await getPm().openWorkspace();
      if (snap) {
        applySnapshot(snap);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [applySnapshot]);

  const openCreateWizard = useCallback(() => {
    setError(null);
    setCreateWizardOpen(true);
  }, []);

  const createWorkspaceFromWizard = useCallback(
    async (input: {
      parentDir: string;
      folderName: string;
      title: string;
    }) => {
      const snap = await getPm().createWorkspaceAt(
        input.parentDir,
        input.folderName,
        { title: input.title },
      );
      applySnapshot(snap);
    },
    [applySnapshot],
  );

  const updateIssueDraft = useCallback((patch: IssuePatch) => {
    const sel = selectionRef.current;
    if (sel?.kind !== "issue") {
      return;
    }
    setIssues((prev) => {
      const current = prev.find(
        (i) => i.projectId === sel.projectId && i.id === sel.issueId,
      );
      if (current && !issueBaselineRef.current) {
        issueBaselineRef.current = pickIssueEditable(current);
      }
      const next = prev.map((i) => {
        if (i.projectId !== sel.projectId || i.id !== sel.issueId) {
          return i;
        }
        return {
          ...i,
          title: patch.title ?? i.title,
          status: patch.status ?? i.status,
          priority: patch.priority ?? i.priority,
          startDate: patch.startDate !== undefined ? patch.startDate : i.startDate,
          endDate: patch.endDate !== undefined ? patch.endDate : i.endDate,
          blockedBy:
            patch.blockedBy !== undefined ? patch.blockedBy : i.blockedBy,
          estimatePoint: patch.estimatePoint ?? i.estimatePoint,
          description:
            patch.description !== undefined ? patch.description : i.description,
          assignee:
            patch.assignee !== undefined ? patch.assignee : i.assignee,
          fields: patch.fields ? { ...i.fields, ...patch.fields } : i.fields,
          markdownFields: patch.markdownFields
            ? { ...i.markdownFields, ...patch.markdownFields }
            : i.markdownFields,
        };
      });
      issuesRef.current = next;
      const draftIssue = next.find(
        (i) => i.projectId === sel.projectId && i.id === sel.issueId,
      );
      if (draftIssue && issueBaselineRef.current) {
        const draft = pickIssueEditable(draftIssue);
        const base = issueBaselineRef.current;
        const dirty =
          titleDirty(draft.title, base.title) ||
          !issueSlicesEqual(
            { ...draft, title: base.title },
            { ...base, title: base.title },
          );
        detailSaveRef.current?.setContentDirty(
          {
            kind: "issue",
            projectId: sel.projectId,
            issueId: sel.issueId,
          },
          dirty,
        );
      }
      return next;
    });
  }, []);

  const updateProjectDraft = useCallback((patch: ProjectPatch) => {
    const sel = selectionRef.current;
    if (sel?.kind !== "project") {
      return;
    }
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === sel.projectId
          ? {
              ...p,
              title: patch.title ?? p.title,
              description:
                patch.description !== undefined
                  ? patch.description
                  : p.description,
            }
          : p,
      );
      projectsRef.current = next;
      const draft = next.find((p) => p.id === sel.projectId);
      if (draft) {
        if (!projectBaselineRef.current) {
          projectBaselineRef.current = pickProjectEditable(draft);
        }
        const base = projectBaselineRef.current;
        detailSaveRef.current?.setContentDirty(
          { kind: "project", projectId: sel.projectId },
          titleDirty(draft.title, base.title) ||
            draft.description !== base.description,
        );
      }
      return next;
    });
  }, []);

  const updateWorkspaceDraft = useCallback((patch: WorkspacePatch) => {
    setMeta((prev) => {
      if (!prev) {
        return prev;
      }
      if (!workspaceBaselineRef.current) {
        workspaceBaselineRef.current = pickWorkspaceEditable(prev);
      }
      const next: WorkspaceMeta = {
        title: patch.title !== undefined ? patch.title : prev.title,
        createdDate: prev.createdDate,
        description:
          patch.description !== undefined
            ? patch.description
            : prev.description,
      };
      metaRef.current = next;
      const base = workspaceBaselineRef.current;
      detailSaveRef.current?.setContentDirty(
        { kind: "workspace" },
        titleDirty(next.title, base.title) ||
          next.description !== base.description,
      );
      return next;
    });
  }, []);

  const saveDetail = useCallback(async (): Promise<boolean> => {
    const ctrl = detailSaveRef.current;
    if (!ctrl || !ctrl.hasUnsavedWork()) {
      return true;
    }
    setError(null);
    try {
      const ok = await ctrl.save();
      if (!ok) {
        const msg = ctrl.getErrorMessage();
        if (msg && ctrl.getStatus() !== "conflict") {
          setError(msg);
        }
      }
      return ok;
    } catch (e) {
      if (isStaleWriteError(e)) {
        detailSaveRef.current?.markConflict(
          e.conflictPaths ?? [],
          e.message,
        );
        return false;
      }
      throw e;
    }
  }, []);

  const flushDetail = useCallback(async (): Promise<boolean> => {
    const ctrl = detailSaveRef.current;
    if (!ctrl || !ctrl.hasUnsavedWork()) {
      return true;
    }
    setError(null);
    try {
      return await ctrl.flush();
    } catch (e) {
      if (isStaleWriteError(e)) {
        detailSaveRef.current?.markConflict(
          e.conflictPaths ?? [],
          e.message,
        );
        return false;
      }
      throw e;
    }
  }, []);

  const reloadDetailTarget = useCallback(
    async (target: DetailSaveTarget): Promise<void> => {
      if (target.kind === "issue") {
        const fresh = await getPm().getIssue(target.projectId, target.issueId);
        setIssues((prev) => {
          const next = prev.map((i) =>
            i.projectId === fresh.projectId && i.id === fresh.id ? fresh : i,
          );
          issuesRef.current = next;
          return next;
        });
        issueBaselineRef.current = pickIssueEditable(fresh);
        return;
      }
      if (target.kind === "project") {
        const projectsNext = await getPm().listProjects();
        setProjects(projectsNext);
        projectsRef.current = projectsNext;
        const p = projectsNext.find((x) => x.id === target.projectId);
        projectBaselineRef.current = p ? pickProjectEditable(p) : null;
        return;
      }
      const snap = await getPm().restoreWorkspace();
      if (snap?.meta) {
        setMeta(snap.meta);
        metaRef.current = snap.meta;
        workspaceBaselineRef.current = pickWorkspaceEditable(snap.meta);
      }
    },
    [],
  );

  const resolveConflictReload = useCallback(async () => {
    const ctrl = detailSaveRef.current;
    const target = ctrl?.getTarget();
    if (!target) {
      ctrl?.resetClean();
      return;
    }
    try {
      await reloadDetailTarget(target);
      ctrl?.resetClean();
      // Re-bind target after reset so subsequent edits work.
      if (target.kind === "issue") {
        ctrl?.setContentDirty(target, false);
      } else if (target.kind === "project") {
        ctrl?.setContentDirty(target, false);
      } else {
        ctrl?.setContentDirty(target, false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [reloadDetailTarget]);

  const resolveConflictKeep = useCallback(() => {
    const ctrl = detailSaveRef.current;
    const target = ctrl?.getTarget();
    if (!target) {
      return;
    }
    void (async () => {
      try {
        if (target.kind === "issue") {
          const fresh = await getPm().getIssue(
            target.projectId,
            target.issueId,
          );
          // Keep local draft; advance baseline to disk.
          issueBaselineRef.current = pickIssueEditable(fresh);
          const local = issuesRef.current.find(
            (i) =>
              i.projectId === target.projectId && i.id === target.issueId,
          );
          const dirty = local
            ? !issueSlicesEqual(
                pickIssueEditable(local),
                issueBaselineRef.current,
              )
            : true;
          ctrl?.clearConflicts();
          ctrl?.setContentDirty(target, dirty);
          return;
        }
        if (target.kind === "project") {
          const projectsNext = await getPm().listProjects();
          const fresh = projectsNext.find((p) => p.id === target.projectId);
          if (fresh) {
            projectBaselineRef.current = pickProjectEditable(fresh);
          }
          const local = projectsRef.current.find(
            (p) => p.id === target.projectId,
          );
          const base = projectBaselineRef.current;
          const dirty = Boolean(
            local &&
              base &&
              (local.title !== base.title ||
                local.description !== base.description),
          );
          ctrl?.clearConflicts();
          ctrl?.setContentDirty(target, dirty);
          return;
        }
        const snap = await getPm().restoreWorkspace();
        if (snap?.meta) {
          workspaceBaselineRef.current = pickWorkspaceEditable(snap.meta);
        }
        const local = metaRef.current;
        const base = workspaceBaselineRef.current;
        const dirty = Boolean(
          local &&
            base &&
            (local.title !== base.title ||
              local.description !== base.description),
        );
        ctrl?.clearConflicts();
        ctrl?.setContentDirty(target, dirty);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  /**
   * Flush pending detail edits before leaving the current host.
   * No discard dialog — autosave hosts flush instead.
   * Returns false when conflict / blank title / persist error blocks leave.
   */
  const flushBeforeLeave = useCallback(async (): Promise<boolean> => {
    const ctrl = detailSaveRef.current;
    if (!ctrl || !ctrl.hasUnsavedWork()) {
      return true;
    }
    if (ctrl.getConflictPaths().length > 0 || ctrl.getStatus() === "conflict") {
      return false;
    }
    const ok = await ctrl.flush();
    if (!ok && ctrl.hasUnsavedWork()) {
      return false;
    }
    return true;
  }, []);

  const persistIssueDates = useCallback(
    async (
      projectId: string,
      issueId: string,
      dates: { startDate?: string | null; endDate?: string | null },
    ) => {
      const ctrl = detailSaveRef.current;
      const target = ctrl?.getTarget();
      const sameIssueDirty =
        ctrl?.hasUnsavedWork() &&
        target?.kind === "issue" &&
        target.projectId === projectId &&
        target.issueId === issueId;
      if (sameIssueDirty) {
        const flushed = await flushBeforeLeave();
        if (!flushed) {
          throw new Error(
            "Cannot apply — resolve conflict or fill title first.",
          );
        }
      }
      const issue = issuesRef.current.find(
        (i) => i.projectId === projectId && i.id === issueId,
      );
      if (!issue) {
        throw new Error(`Issue not found: ${projectId}::${issueId}`);
      }
      const startDate =
        dates.startDate !== undefined ? dates.startDate : issue.startDate;
      const endDate =
        dates.endDate !== undefined ? dates.endDate : issue.endDate;
      const expected = pickIssueEditable(issue);
      const saved = await getPm().updateIssue(
        projectId,
        issueId,
        {
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          startDate,
          endDate,
          blockedBy: issue.blockedBy,
          estimatePoint: issue.estimatePoint,
          description: issue.description,
          fields: issue.fields,
          markdownFields: issue.markdownFields,
        },
        { expected },
      );
      setIssues((prev) => {
        const next = prev.map((i) =>
          i.projectId === projectId && i.id === issueId ? saved : i,
        );
        issuesRef.current = next;
        return next;
      });
      const sel = selectionRef.current;
      if (
        sel?.kind === "issue" &&
        sel.projectId === projectId &&
        sel.issueId === issueId
      ) {
        issueBaselineRef.current = pickIssueEditable(saved);
        detailSaveRef.current?.resetClean();
      }
    },
    [flushBeforeLeave],
  );

  const persistIssueBlockedBy = useCallback(
    async (projectId: string, issueId: string, blockedBy: string[]) => {
      const ctrl = detailSaveRef.current;
      const target = ctrl?.getTarget();
      const sameIssueDirty =
        ctrl?.hasUnsavedWork() &&
        target?.kind === "issue" &&
        target.projectId === projectId &&
        target.issueId === issueId;
      if (sameIssueDirty) {
        const flushed = await flushBeforeLeave();
        if (!flushed) {
          throw new Error(
            "Cannot apply — resolve conflict or fill title first.",
          );
        }
      }
      const issue = issuesRef.current.find(
        (i) => i.projectId === projectId && i.id === issueId,
      );
      if (!issue) {
        throw new Error(`Issue not found: ${projectId}::${issueId}`);
      }
      const expected = pickIssueEditable(issue);
      const saved = await getPm().updateIssue(
        projectId,
        issueId,
        {
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          startDate: issue.startDate,
          endDate: issue.endDate,
          blockedBy,
          estimatePoint: issue.estimatePoint,
          description: issue.description,
          fields: issue.fields,
          markdownFields: issue.markdownFields,
        },
        { expected },
      );
      setIssues((prev) => {
        const next = prev.map((i) =>
          i.projectId === projectId && i.id === issueId ? saved : i,
        );
        issuesRef.current = next;
        return next;
      });
      const sel = selectionRef.current;
      if (
        sel?.kind === "issue" &&
        sel.projectId === projectId &&
        sel.issueId === issueId
      ) {
        issueBaselineRef.current = pickIssueEditable(saved);
        detailSaveRef.current?.resetClean();
      }
    },
    [flushBeforeLeave],
  );

  const persistIssuePriority = useCallback(
    async (
      projectId: string,
      issueId: string,
      priority: Issue["priority"],
    ) => {
      const ctrl = detailSaveRef.current;
      const target = ctrl?.getTarget();
      const sameIssueDirty =
        ctrl?.hasUnsavedWork() &&
        target?.kind === "issue" &&
        target.projectId === projectId &&
        target.issueId === issueId;
      if (sameIssueDirty) {
        const flushed = await flushBeforeLeave();
        if (!flushed) {
          throw new Error(
            "Cannot apply — resolve conflict or fill title first.",
          );
        }
      }
      const issue = issuesRef.current.find(
        (i) => i.projectId === projectId && i.id === issueId,
      );
      if (!issue) {
        throw new Error(`Issue not found: ${projectId}::${issueId}`);
      }
      const expected = pickIssueEditable(issue);
      const saved = await getPm().updateIssue(
        projectId,
        issueId,
        {
          title: issue.title,
          status: issue.status,
          priority,
          startDate: issue.startDate,
          endDate: issue.endDate,
          blockedBy: issue.blockedBy,
          estimatePoint: issue.estimatePoint,
          description: issue.description,
          fields: issue.fields,
          markdownFields: issue.markdownFields,
        },
        { expected },
      );
      setIssues((prev) => {
        const next = prev.map((i) =>
          i.projectId === projectId && i.id === issueId ? saved : i,
        );
        issuesRef.current = next;
        return next;
      });
      const sel = selectionRef.current;
      if (
        sel?.kind === "issue" &&
        sel.projectId === projectId &&
        sel.issueId === issueId
      ) {
        issueBaselineRef.current = pickIssueEditable(saved);
        detailSaveRef.current?.resetClean();
      }
    },
    [flushBeforeLeave],
  );

  const flushDetailSave = saveDetail;
  const saveCurrent = saveDetail;

  const select = useCallback(
    async (sel: Selection): Promise<boolean> => {
      const cur = selectionRef.current;
      const same =
        (cur === null && sel === null) ||
        (cur?.kind === "project" &&
          sel?.kind === "project" &&
          cur.projectId === sel.projectId) ||
        (cur?.kind === "issue" &&
          sel?.kind === "issue" &&
          cur.projectId === sel.projectId &&
          cur.issueId === sel.issueId);
      if (same) {
        return true;
      }
      const ok = await flushBeforeLeave();
      if (!ok) {
        return false;
      }
      // Keep ref in sync before paint so draft handlers never see the prior selection.
      selectionRef.current = sel;
      setSelection(sel);
      detailSaveRef.current?.resetClean();
      issueBaselineRef.current = null;
      projectBaselineRef.current = null;
      if (sel?.kind === "issue") {
        const issue = issuesRef.current.find(
          (i) => i.projectId === sel.projectId && i.id === sel.issueId,
        );
        if (issue) {
          issueBaselineRef.current = pickIssueEditable(issue);
        }
      } else if (sel?.kind === "project") {
        const project = projectsRef.current.find((p) => p.id === sel.projectId);
        if (project) {
          projectBaselineRef.current = pickProjectEditable(project);
        }
      } else if (metaRef.current) {
        workspaceBaselineRef.current = pickWorkspaceEditable(metaRef.current);
      }
      return true;
    },
    [flushBeforeLeave],
  );

  const createProjectFn = useCallback(async () => {
    const ok = await flushBeforeLeave();
    if (!ok) {
      return;
    }
    setError(null);
    try {
      const project = await getPm().createProject({ title: "New Project" });
      const [treeNext, projectsNext, issuesNext] = await Promise.all([
        getPm().getTree(),
        getPm().listProjects(),
        getPm().listIssues(),
      ]);
      setTree(treeNext);
      setProjects(projectsNext);
      setIssues(issuesNext);
      detailSaveRef.current?.resetClean();
      setSelection({ kind: "project", projectId: project.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [flushBeforeLeave]);

  const createWikiNodeFn = useCallback(
    async (opts?: { title?: string; parentId?: string | null }) => {
      const title = opts?.title?.trim() || "Untitled";
      setError(null);
      try {
        const page = await getPm().createWikiNode({
          title,
          parentId: opts?.parentId ?? null,
        });
        navigate(`/w/wiki/${page.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [navigate],
  );

  const createChild = useCallback(async (): Promise<Issue | null> => {
    const sel = selectionRef.current;
    if (!sel) {
      return null;
    }
    const ok = await flushBeforeLeave();
    if (!ok) {
      return null;
    }
    setError(null);
    try {
      const issue = await getPm().createIssue({
        projectId: sel.projectId,
        parentIssueId: sel.kind === "issue" ? sel.issueId : null,
        title: undefined,
      });
      const [treeNext, issuesNext] = await Promise.all([
        getPm().getTree(),
        getPm().listIssues(),
      ]);
      setTree(treeNext);
      setIssues(issuesNext);
      detailSaveRef.current?.resetClean();
      return issue;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [flushBeforeLeave]);

  const adoptStrayFn = useCallback(async (strayPath: string) => {
    setError(null);
    try {
      await getPm().adoptStray(strayPath);
      const [treeNext, projectsNext, issuesNext, report] = await Promise.all([
        getPm().getTree(),
        getPm().listProjects(),
        getPm().listIssues(),
        getPm().doctor(),
      ]);
      setTree(treeNext);
      setProjects(projectsNext);
      setIssues(issuesNext);
      setStrays(report.strays);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleDelete = useCallback(async () => {
    const sel = selectionRef.current;
    const treeNow = treeRef.current;
    if (!sel || !treeNow) {
      return;
    }

    const hasUnsaved = detailSaveRef.current?.hasUnsavedWork() ?? false;

    let title: string;
    let message: string;
    const detailParts: string[] = [];

    if (sel.kind === "issue") {
      const issue = issuesRef.current.find(
        (i) => i.projectId === sel.projectId && i.id === sel.issueId,
      );
      const key = issueRefKey(sel.projectId, sel.issueId);
      const counts = countTreeDescendants(treeNow, key);
      const cost = formatDescendantCost(counts);
      const label = issue?.title ?? key;
      const level = issue?.level ?? "issue";
      if (counts.total > 0) {
        title = "Delete issue and descendants?";
        message = `Delete "${label}" (${level}) and all nested issues?`;
        detailParts.push(`This will permanently remove: ${cost}.`);
      } else {
        title = "Delete issue?";
        message = `Delete "${label}" (${level})?`;
      }
    } else {
      const project = projectsRef.current.find((p) => p.id === sel.projectId);
      const key = String(sel.projectId);
      const counts = countTreeDescendants(treeNow, key);
      const cost = formatDescendantCost(counts);
      const label = project?.title ?? key;
      if (counts.total > 0) {
        title = "Delete project and all issues?";
        message = `Delete project "${label}" and every issue under it?`;
        detailParts.push(`This will permanently remove: ${cost}.`);
      } else {
        title = "Delete project?";
        message = `Delete project "${label}"?`;
      }
    }

    detailParts.push("This cannot be undone.");
    if (hasUnsaved) {
      detailParts.push("Unsaved edits will be discarded.");
    }

    const confirmed = await getPm().confirmDangerous({
      title,
      message,
      detail: detailParts.join("\n"),
    });
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      if (sel.kind === "issue") {
        await getPm().deleteIssue(sel.projectId, sel.issueId, {
          cascade: true,
        });
      } else {
        await getPm().deleteProject(sel.projectId, { cascade: true });
      }
      detailSaveRef.current?.resetClean();
      const [treeNext, projectsNext, issuesNext] = await Promise.all([
        getPm().getTree(),
        getPm().listProjects(),
        getPm().listIssues(),
      ]);
      setTree(treeNext);
      setProjects(projectsNext);
      setIssues(issuesNext);
      const first = projectsNext[0];
      setSelection(first ? { kind: "project", projectId: first.id } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshCustomProps = useCallback(async (projectId: string) => {
    return getPm().getCustomProps(projectId);
  }, []);

  const saveCustomProps = useCallback(
    async (projectId: string, schema: CustomPropsSchema) => {
      await getPm().updateCustomProps(projectId, schema);
    },
    [],
  );

  const revealPathFn = useCallback(async (targetPath: string) => {
    try {
      await getPm().revealPath(targetPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const dismissStray = useCallback((strayPath: string) => {
    setStrays((prev) => prev.filter((s) => s.path !== strayPath));
  }, []);

  const dismissWarnings = useCallback(() => {
    setWarnings([]);
  }, []);

  /**
   * Reparent an issue. The store rewrites `level` for the whole subtree, so
   * this doubles as the repair for a ladder violation: moving an issue to the
   * parent it already has re-derives its level from that parent.
   */
  const moveIssueTo = useCallback(
    async (
      projectId: string,
      issueId: string,
      newParentIssueId: string | null,
    ) => {
      const ok = await flushBeforeLeave();
      if (!ok) {
        return;
      }
      setError(null);
      try {
        await getPm().moveIssue({ projectId, issueId, newParentIssueId });
        const [treeNext, projectsNext, issuesNext] = await Promise.all([
          getPm().getTree(),
          getPm().listProjects(),
          getPm().listIssues(),
        ]);
        setTree(treeNext);
        setProjects(projectsNext);
        setIssues(issuesNext);
        detailSaveRef.current?.resetClean();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [flushBeforeLeave],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      root,
      meta,
      projects,
      tree,
      issues,
      strays,
      selection,
      selectedProject,
      selectedIssue,
      error,
      booting,
      terminalOpen,
      hasWorkspace,
      dirty,
      saving,
      saveStatus,
      saveError,
      conflictPaths,
      setError,
      setTerminalOpen,
      openDialog,
      openCreateWizard,
      createProject: createProjectFn,
      createWikiNode: createWikiNodeFn,
      createChild,
      updateIssueDraft,
      updateProjectDraft,
      updateWorkspaceDraft,
      persistIssueDates,
      persistIssueBlockedBy,
      persistIssuePriority,
      saveDetail,
      flushDetail,
      flushDetailSave,
      saveCurrent,
      resolveConflictReload,
      resolveConflictKeep,
      select,
      handleDelete,
      applySnapshot,
      refreshCustomProps,
      saveCustomProps,
      adoptStray: adoptStrayFn,
      revealPath: revealPathFn,
      dismissStray,
      warnings,
      dismissWarnings,
      moveIssueTo,
    }),
    [
      root,
      meta,
      projects,
      tree,
      issues,
      strays,
      selection,
      selectedProject,
      selectedIssue,
      error,
      booting,
      terminalOpen,
      hasWorkspace,
      dirty,
      saving,
      saveStatus,
      saveError,
      conflictPaths,
      openDialog,
      openCreateWizard,
      createProjectFn,
      createWikiNodeFn,
      createChild,
      updateIssueDraft,
      updateProjectDraft,
      updateWorkspaceDraft,
      persistIssueDates,
      persistIssueBlockedBy,
      persistIssuePriority,
      saveDetail,
      flushDetail,
      flushDetailSave,
      saveCurrent,
      resolveConflictReload,
      resolveConflictKeep,
      select,
      handleDelete,
      applySnapshot,
      refreshCustomProps,
      saveCustomProps,
      adoptStrayFn,
      revealPathFn,
      dismissStray,
      warnings,
      dismissWarnings,
      moveIssueTo,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      <CreateWorkspaceWizard
        open={createWizardOpen}
        onClose={() => setCreateWizardOpen(false)}
        onCreated={() => setError(null)}
        createWorkspace={createWorkspaceFromWizard}
      />
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

export { issueRefKey };
