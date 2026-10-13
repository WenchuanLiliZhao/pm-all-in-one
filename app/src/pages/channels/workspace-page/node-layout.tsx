import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Navigate,
  Outlet,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import {
  HandoffEditor,
  IssueDetail,
  MemberEditor,
  ProjectDetail,
  WikiNodeEditor,
  WorkspaceHomeDetail,
} from "@/components";
import { PageWidth } from "@/components/ui/page-width";
import { getPm } from "@/lib/bridge";
import { closePmPanelIfNodeSurface } from "@/lib/bridge/open-pm-document";
import { issueRefKey } from "@/lib/types";
import { getActiveSaveHost } from "@/lib/workspace/active-save-host";
import { MemberProvider } from "@/lib/workspace/member-context";
import {
  useWorkspace,
  type Selection,
} from "@/lib/workspace/workspace-context";
import { WikiProvider, useWiki } from "@/lib/workspace/wiki-context";
import type { WorkspaceOutletContext } from "./route";
import styles from "./styles.module.scss";

function NodeWikiNodes({
  children,
}: {
  children: (wikiNodes: WorkspaceOutletContext["wikiNodes"]) => ReactNode;
}) {
  const { wiki } = useWiki();
  return <>{children(wiki?.nodes ?? [])}</>;
}

export function NodeLayout() {
  const navigate = useNavigate();
  const {
    root,
    tree,
    booting,
    hasWorkspace,
    saveDetail,
  } = useWorkspace();

  const openSelection = useCallback(
    (sel: Selection) => {
      if (!sel) {
        return;
      }
      if (sel.kind === "project") {
        navigate(`/n/projects/${sel.projectId}`);
        return;
      }
      navigate(`/n/issues/${sel.projectId}/${sel.issueId}`);
    },
    [navigate],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const host = getActiveSaveHost();
        if (host) {
          void host.save();
          return;
        }
        void saveDetail();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveDetail]);

  // Keep the outlet mounted while the full snapshot is in flight. The issue
  // page loads that one record itself; waiting here left the tab blank.
  if (!booting && (!hasWorkspace || !tree || !root)) {
    return <Navigate to="/" replace />;
  }

  return (
    <WikiProvider>
      <MemberProvider>
        <NodeWikiNodes>
          {(wikiNodes) => (
            <div className={`${styles.shell} ${styles.layout}`}>
              <div className={styles.pageScroll}>
                <div className={styles.pageRow}>
                  <main className={`${styles.center} ${styles.nodeMain}`}>
                    <PageWidth width="reading" padded>
                      <Outlet
                        context={{
                          openSelection,
                          views: [],
                          viewsReady: true,
                          refreshViews: async () => undefined,
                          wikiNodes,
                        } satisfies WorkspaceOutletContext}
                      />
                    </PageWidth>
                  </main>
                </div>
              </div>
            </div>
          )}
        </NodeWikiNodes>
      </MemberProvider>
    </WikiProvider>
  );
}

export function NodeHomeView() {
  const { openSelection, wikiNodes } =
    useOutletContext<WorkspaceOutletContext>();
  const {
    meta,
    issues,
    saveStatus,
    conflictPaths,
    updateWorkspaceDraft,
    saveDetail,
    resolveConflictReload,
    resolveConflictKeep,
  } = useWorkspace();

  const knownKeys = useMemo(
    () => new Set(issues.map((i) => issueRefKey(i.projectId, i.id))),
    [issues],
  );

  if (!meta) {
    return (
      <div className={styles.placeholder}>
        <p>Loading workspace…</p>
      </div>
    );
  }

  return (
    <WorkspaceHomeDetail
      meta={meta}
      saveStatus={saveStatus}
      conflictPaths={conflictPaths}
      onChange={updateWorkspaceDraft}
      onSave={() => saveDetail()}
      onConflictReload={() => void resolveConflictReload()}
      onConflictKeep={resolveConflictKeep}
      onNavigateIssue={openSelection}
      knownKeys={knownKeys}
      issues={issues}
      wikiNodes={wikiNodes}
    />
  );
}

export function NodeWikiView() {
  const { wikiNodeId } = useParams<{ wikiNodeId: string }>();
  const { openSelection, wikiNodes } =
    useOutletContext<WorkspaceOutletContext>();
  const { issues } = useWorkspace();

  if (!wikiNodeId) {
    return <Navigate to="/w/wiki" replace />;
  }

  return (
    <WikiNodeEditor
      wikiNodeId={wikiNodeId}
      issues={issues}
      wikiNodes={wikiNodes}
      onNavigateIssue={openSelection}
    />
  );
}

export function NodeMemberView() {
  const { memberId } = useParams<{ memberId: string }>();
  if (!memberId) {
    return <Navigate to="/w/members" replace />;
  }
  return <MemberEditor memberId={memberId} />;
}

export function NodeHandoffView() {
  const { handoffId } = useParams<{ handoffId: string }>();
  if (!handoffId) {
    return <Navigate to="/w/handoffs" replace />;
  }
  return <HandoffEditor handoffId={handoffId} />;
}

export function NodeIssueView() {
  const { projectId, issueId } = useParams<{
    projectId: string;
    issueId: string;
  }>();
  const { openSelection, wikiNodes } =
    useOutletContext<WorkspaceOutletContext>();
  const {
    issues,
    selectedIssue,
    selection,
    saveStatus,
    conflictPaths,
    updateIssueDraft,
    saveDetail,
    resolveConflictReload,
    resolveConflictKeep,
    handleDelete,
    createChild,
    moveIssueTo,
    select,
    cacheIssue,
  } = useWorkspace();
  const [loadError, setLoadError] = useState<string | null>(null);

  const fromList = useMemo(() => {
    if (!projectId || !issueId) {
      return null;
    }
    return (
      issues.find((i) => i.projectId === projectId && i.id === issueId) ??
      null
    );
  }, [issues, projectId, issueId]);

  useEffect(() => {
    if (!projectId || !issueId) {
      return;
    }
    if (
      selection?.kind === "issue" &&
      selection.projectId === projectId &&
      selection.issueId === issueId
    ) {
      return;
    }
    void select({ kind: "issue", projectId, issueId });
  }, [projectId, issueId, select, selection]);

  useEffect(() => {
    if (!projectId || !issueId || fromList) {
      return;
    }
    let cancelled = false;
    setLoadError(null);
    void getPm()
      .getIssue(projectId, issueId)
      .then((issue) => {
        if (!cancelled) {
          cacheIssue(issue);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, issueId, fromList, cacheIssue]);

  const knownKeys = useMemo(
    () => new Set(issues.map((i) => issueRefKey(i.projectId, i.id))),
    [issues],
  );

  const addChild = async () => {
    const issue = await createChild();
    if (issue) {
      openSelection({
        kind: "issue",
        projectId: issue.projectId,
        issueId: issue.id,
      });
    }
  };

  if (!projectId || !issueId) {
    return <Navigate to="/w/table" replace />;
  }

  const issue =
    selectedIssue &&
    selectedIssue.projectId === projectId &&
    selectedIssue.id === issueId
      ? selectedIssue
      : fromList;

  if (!issue) {
    return (
      <div className={styles.placeholder}>
        <p>{loadError ?? "Loading issue…"}</p>
      </div>
    );
  }

  return (
    <IssueDetail
      issue={issue}
      saveStatus={saveStatus}
      conflictPaths={conflictPaths}
      onChange={updateIssueDraft}
      onSave={() => saveDetail()}
      onConflictReload={() => void resolveConflictReload()}
      onConflictKeep={resolveConflictKeep}
      onDelete={() => {
        void (async () => {
          await handleDelete();
          await closePmPanelIfNodeSurface();
        })();
      }}
      onAddChild={
        issue.level === "subtask" ? undefined : () => void addChild()
      }
      onClose={() => void closePmPanelIfNodeSurface()}
      onRepairPlacement={(newParentIssueId) =>
        void moveIssueTo(issue.projectId, issue.id, newParentIssueId)
      }
      onNavigateIssue={openSelection}
      knownKeys={knownKeys}
      issues={issues}
      wikiNodes={wikiNodes}
    />
  );
}

export function NodeProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { openSelection, wikiNodes } =
    useOutletContext<WorkspaceOutletContext>();
  const {
    issues,
    projects,
    selectedProject,
    selection,
    booting,
    saveStatus,
    conflictPaths,
    updateProjectDraft,
    saveDetail,
    resolveConflictReload,
    resolveConflictKeep,
    handleDelete,
    createChild,
    select,
  } = useWorkspace();

  useEffect(() => {
    if (!projectId) {
      return;
    }
    if (selection?.kind === "project" && selection.projectId === projectId) {
      return;
    }
    void select({ kind: "project", projectId });
  }, [projectId, select, selection]);

  const knownKeys = useMemo(
    () => new Set(issues.map((i) => issueRefKey(i.projectId, i.id))),
    [issues],
  );

  if (!projectId) {
    return <Navigate to="/w/roadmap" replace />;
  }

  const fromList = projects.find((p) => p.id === projectId) ?? null;
  const project =
    selectedProject?.id === projectId ? selectedProject : fromList;

  if (!project) {
    return (
      <div className={styles.placeholder}>
        <p>{booting ? "Loading project…" : "Project not found."}</p>
      </div>
    );
  }

  return (
    <ProjectDetail
      project={project}
      saveStatus={saveStatus}
      conflictPaths={conflictPaths}
      onChange={updateProjectDraft}
      onSave={() => saveDetail()}
      onConflictReload={() => void resolveConflictReload()}
      onConflictKeep={resolveConflictKeep}
      onDelete={() => {
        void (async () => {
          await handleDelete();
          await closePmPanelIfNodeSurface();
        })();
      }}
      onAddEpic={() => {
        void (async () => {
          await select({ kind: "project", projectId });
          const issue = await createChild();
          if (issue) {
            openSelection({
              kind: "issue",
              projectId: issue.projectId,
              issueId: issue.id,
            });
          }
        })();
      }}
      onClose={() => void closePmPanelIfNodeSurface()}
      onNavigateIssue={openSelection}
      knownKeys={knownKeys}
      issues={issues}
      wikiNodes={wikiNodes}
    />
  );
}
