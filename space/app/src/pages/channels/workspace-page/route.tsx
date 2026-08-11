import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useMatch,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  CustomPropsEditor,
  IssueDetail,
  ProjectDetail,
  TerminalPanel,
  WorkspaceHomeDetail,
  WikiShell,
  WikiNodeEditor,
  WikiAllPages,
  MembersAllPages,
  MemberEditor,
  CollaborationCards,
  HandoffEditor,
  MemberPerson,
  MemberPersonSelect,
  type TerminalPanelHandle,
} from "@/components";
import { getPm, isWebPm } from "@/lib/bridge";
import type { WikiNodeMeta, WorkspaceView } from "@/lib/types";
import { issueRefKey } from "@/lib/types";
import {
  useWorkspace,
  workspaceNameFromPath,
  type Selection,
} from "@/lib/workspace/workspace-context";
import { getActiveSaveHost } from "@/lib/workspace/active-save-host";
import { useActiveSaveHost } from "@/lib/workspace/use-active-save-host";
import { WikiProvider, useWiki } from "@/lib/workspace/wiki-context";
import { MemberProvider, useMember } from "@/lib/workspace/member-context";
import { OrderedHierarchyOutline } from "./sub-components/ordered-hierarchy-outline";
import { IssueTable } from "./sub-components/issue-table";
import { RoadmapBoard } from "./sub-components/roadmap";
import {
  isFillViewportPath,
  needsFillDetailScroll,
} from "./is-fill-viewport-path";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./styles.module.scss";
import roadmapStyles from "./sub-components/roadmap/styles.module.scss";

function searchToSelection(params: URLSearchParams): Selection {
  const issue = params.get("issue");
  if (issue) {
    const m = /^([A-Za-z0-9_-]{21})::([A-Za-z0-9_-]{21})$/.exec(issue);
    if (m) {
      return {
        kind: "issue",
        projectId: m[1]!,
        issueId: m[2]!,
      };
    }
  }
  const project = params.get("project");
  if (project && /^[A-Za-z0-9_-]{21}$/.test(project)) {
    return { kind: "project", projectId: project };
  }
  return null;
}

function selectionEquals(a: Selection, b: Selection): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === "project" && b.kind === "project") {
    return a.projectId === b.projectId;
  }
  if (a.kind === "issue" && b.kind === "issue") {
    return a.projectId === b.projectId && a.issueId === b.issueId;
  }
  return false;
}

function WikiNodesBridge({
  children,
}: {
  children: (wikiNodes: WikiNodeMeta[]) => ReactNode;
}) {
  const { wiki } = useWiki();
  return <>{children(wiki?.nodes ?? [])}</>;
}

/** Display-only signing identity in the workspace topbar. */
function TopbarLocalMe() {
  const { localMe } = useMember();
  return (
    <span className={styles.topbarMe} aria-label="Who you are (for signing)">
      <MemberPerson
        memberId={localMe}
        size="lg"
        showName={false}
        link={false}
        emptyLabel="Not set"
      />
    </span>
  );
}

export function WorkspaceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMatch = useMatch("/w/views/:viewId");
  // Fill-viewport / detail-scroll path SoT:
  // ↔ is-fill-viewport-path.ts
  // ↔ styles.module.scss (.layoutFillViewport / .layoutFillDetail)
  const fillViewport = isFillViewportPath(location.pathname);
  const fillDetailScroll = needsFillDetailScroll(location.pathname);
  const terminalRef = useRef<TerminalPanelHandle>(null);
  const prevPathnameRef = useRef(location.pathname);
  const {
    root,
    meta,
    tree,
    issues,
    strays,
    selection,
    selectedIssue,
    selectedProject,
    booting,
    hasWorkspace,
    saveStatus,
    error,
    terminalOpen,
    setError,
    createProject,
    createChild,
    updateIssueDraft,
    updateProjectDraft,
    saveDetail,
    flushDetail,
    resolveConflictReload,
    resolveConflictKeep,
    conflictPaths,
    select,
    handleDelete,
    adoptStray,
    revealPath,
    dismissStray,
    warnings,
    dismissWarnings,
    moveIssueTo,
  } = useWorkspace();

  const [views, setViews] = useState<WorkspaceView[]>([]);
  const [viewsReady, setViewsReady] = useState(false);
  const [viewsError, setViewsError] = useState<string | null>(null);

  const refreshViews = useCallback(async () => {
    try {
      const next = await getPm().listViews();
      setViews(next);
      setViewsError(null);
    } catch (e) {
      setViewsError(e instanceof Error ? e.message : String(e));
    } finally {
      setViewsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!hasWorkspace) {
      setViews([]);
      setViewsReady(false);
      return;
    }
    setViewsReady(false);
    void refreshViews();
  }, [hasWorkspace, root, refreshViews]);
  useEffect(() => {
    if (!terminalOpen) {
      return;
    }
    void (async () => {
      await terminalRef.current?.ensureSession();
      // After panel mounts / fits, focus prompt for the user.
      requestAnimationFrame(() => {
        terminalRef.current?.focus();
      });
    })();
  }, [terminalOpen]);

  // ↔ lib/workspace/active-save-host.ts — Cmd+S dispatches to current host
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

  // URL → selection
  useEffect(() => {
    if (!hasWorkspace) {
      return;
    }
    const fromUrl = searchToSelection(searchParams);
    if (!selectionEquals(fromUrl, selection)) {
      void (async () => {
        const ok = await select(fromUrl);
        if (!ok) {
          // Revert URL when flush-before-leave blocked (conflict / blank title).
          const next = new URLSearchParams();
          if (selection?.kind === "project") {
            next.set("project", String(selection.projectId));
          } else if (selection?.kind === "issue") {
            next.set("issue", `${selection.projectId}::${selection.issueId}`);
          }
          setSearchParams(next, { replace: true });
        }
      })();
    }
    // Only react to URL changes; selection updates from select() are intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from URL
  }, [searchParams, hasWorkspace]);

  const openSelection = useCallback(
    (sel: Selection) => {
      void (async () => {
        const ok = await select(sel);
        if (!ok) {
          return;
        }
        const next = new URLSearchParams();
        if (sel?.kind === "project") {
          next.set("project", String(sel.projectId));
        } else if (sel?.kind === "issue") {
          next.set("issue", `${sel.projectId}::${sel.issueId}`);
        }
        setSearchParams(next, { replace: true });
      })();
    },
    [select, setSearchParams],
  );

  const closeDetail = useCallback(() => {
    void (async () => {
      const ok = await select(null);
      if (!ok) {
        return;
      }
      setSearchParams({}, { replace: true });
    })();
  }, [select, setSearchParams]);

  // Detail is page-scoped: switching Home / Roadmap / Table / views closes it.
  useEffect(() => {
    if (prevPathnameRef.current === location.pathname) {
      return;
    }
    prevPathnameRef.current = location.pathname;
    void (async () => {
      const ok = await select(null);
      if (!ok) {
        return;
      }
      setSearchParams({}, { replace: true });
    })();
  }, [location.pathname, setSearchParams, select]);

  const knownKeys = useMemo(
    () => new Set(issues.map((i) => issueRefKey(i.projectId, i.id))),
    [issues],
  );

  const addChildUnderSelection = async () => {
    const issue = await createChild();
    if (issue) {
      openSelection({
        kind: "issue",
        projectId: issue.projectId,
        issueId: issue.id,
      });
    }
  };

  const detailOpen = Boolean(selectedIssue || selectedProject);

  const addView = async () => {
    try {
      const view = await getPm().createView({ name: "New view", kind: "list" });
      await refreshViews();
      navigate(`/w/views/${view.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeView = async (viewId: string) => {
    const name = views.find((v) => v.id === viewId)?.name ?? viewId;
    const confirmed = await getPm().confirmDangerous({
      title: "Delete view?",
      message: `Delete view "${name}"? Filters and order for this tab will be gone.`,
      detail: "Issues and projects are not deleted.",
    });
    if (!confirmed) {
      return;
    }
    try {
      await getPm().deleteView(viewId);
      await refreshViews();
      if (viewMatch?.params.viewId === viewId) {
        // Replace so Back cannot return to the deleted view URL.
        navigate("/w/home", { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onDeleteCurrent = async () => {
    await handleDelete();
    closeDetail();
  };

  // Keep /w/* in the URL while restore is in flight. Navigating away early
  // would wipe the channel (e.g. roadmap) and boot would then send "/" → home.
  if (booting) {
    return null;
  }

  if (!hasWorkspace || !tree || !root) {
    return <Navigate to="/" replace />;
  }

  const layoutClass = [
    styles.layout,
    fillViewport ? styles.layoutFillViewport : "",
    fillDetailScroll ? styles.layoutFillDetail : "",
    terminalOpen ? styles.layoutTerminalOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  const pageRowClass = [
    styles.pageRow,
    detailOpen ? styles.pageRowDetailOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  /** mac titlebar: history + workspace name + Reveal; keep topbar tabs/actions only. */
  const identityInTitlebar = window.pm?.platform === "darwin";

  return (
    <WikiProvider>
      <MemberProvider>
      <WikiNodesBridge>
        {(wikiNodes) => (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarRow}>
          {identityInTitlebar ? null : (
            <div className={styles.topbarTitle}>
              <span className={styles.workspaceName}>
                {meta?.title ?? workspaceNameFromPath(root)}
              </span>
              <span className={styles.topbarPath}>{root}</span>
            </div>
          )}

          <nav className={styles.viewBar} aria-label="Views">
            {(
              [
                { to: "/w/home", label: "Home" },
                { to: "/w/roadmap", label: "Roadmap" },
                { to: "/w/table", label: "Table" },
                { to: "/w/handoffs", label: "Handoffs" },
              ] as const
            ).map(({ to, label }) => {
              const active =
                location.pathname === to ||
                (to !== "/w/home" && location.pathname.startsWith(`${to}/`));
              return (
                <Button
                  key={to}
                  type="button"
                  size="medium"
                  variant={active ? "fill" : "ghost"}
                  selected={active}
                  aria-current={active ? "page" : undefined}
                  onClick={() => navigate(to)}
                >
                  {label}
                </Button>
              );
            })}
            {views.map((v) => {
              const active = viewMatch?.params.viewId === v.id;
              return (
                <div key={v.id} className={styles.viewTabGroup}>
                  <Button
                    type="button"
                    size="medium"
                    variant={active ? "fill" : "ghost"}
                    selected={active}
                    aria-current={active ? "page" : undefined}
                    onClick={() => navigate(`/w/views/${v.id}`)}
                  >
                    {v.name}
                  </Button>
                  <Button
                    type="button"
                    size="medium"
                    variant="ghost"
                    title={`Delete ${v.name}`}
                    aria-label={`Delete ${v.name}`}
                    colors={{
                      fg: "var(--color-use--danger)",
                      hoverBg: "var(--color-use--danger-soft)",
                    }}
                    onClick={() => void removeView(v.id)}
                  >
                    ×
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              size="medium"
              variant="ghost"
              onClick={() => void addView()}
            >
              + View
            </Button>
          </nav>

          <div className={styles.topbarActions}>
            <Button type="button" size="medium" variant="outlined" onClick={() => void createProject()}>
              New project
            </Button>
            <TopbarLocalMe />
          </div>
        </div>
      </header>

      {error || viewsError ? (
        <Banner
          tone="error"
          onDismiss={() => {
            setError(null);
            setViewsError(null);
          }}
        >
          {error ?? viewsError}
        </Banner>
      ) : null}

      {strays.length > 0 ? (
        <Banner tone="warn" className={styles.strayBanner} role="status">
          <span className={styles.strayTitle}>
            Unadopted directories ({strays.length}) — not indexed as issues.
            Issue directories are named by id alone; use Adopt below (or the
            CLI <code>adopt</code> command) to give one an id.
          </span>
          <ul className={styles.strayList}>
            {strays.map((s) => (
              <li key={s.path} className={styles.strayItem}>
                <span className={styles.strayMeta}>
                  <code>{s.relPath}</code>
                  <span className={styles.strayKind}>{s.kind}</span>
                  <span>{s.message}</span>
                </span>
                <span className={styles.strayActions}>
                  {s.adoptable ? (
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => void adoptStray(s.path)}
                    >
                      Adopt
                    </Button>
                  ) : null}
                  {!isWebPm() ? (
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => void revealPath(s.path)}
                    >
                      Reveal
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.chromeBtn}
                    onClick={() => dismissStray(s.path)}
                  >
                    Dismiss
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Banner>
      ) : null}

      {warnings.length > 0 ? (
        <Banner tone="warn" role="status" onDismiss={dismissWarnings}>
          <span className={styles.strayTitle}>
            Workspace warnings ({warnings.length})
          </span>
          <ul className={styles.strayList}>
            {warnings.map((w) => (
              <li key={`${w.kind}:${w.relPath ?? w.message}`}>
                <span className={styles.strayKind}>{w.kind}</span> {w.message}
              </li>
            ))}
          </ul>
        </Banner>
      ) : null}

      <div className={layoutClass}>
        <div className={styles.pageScroll}>
          <div className={pageRowClass}>
            <main className={styles.center}>
              <Outlet
                context={{ openSelection, views, viewsReady, refreshViews, wikiNodes }}
              />
            </main>

            {detailOpen ? (
              <aside className={styles.detail}>
                <div className={styles.detailHeader}>
                  <button
                    type="button"
                    className={styles.chromeBtn}
                    onClick={closeDetail}
                  >
                    Close
                  </button>
                </div>
                {selectedIssue ? (
                  <IssueDetail
                    issue={selectedIssue}
                    saveStatus={saveStatus}
                    conflictPaths={conflictPaths}
                    onChange={updateIssueDraft}
                    onSave={() => saveDetail()}
                    onFlush={() => {
                      void flushDetail();
                    }}
                    onConflictReload={() => void resolveConflictReload()}
                    onConflictKeep={resolveConflictKeep}
                    onDelete={() => void onDeleteCurrent()}
                    onAddChild={
                      selectedIssue.level === "subtask"
                        ? undefined
                        : () => void addChildUnderSelection()
                    }
                    onRepairPlacement={(newParentIssueId) =>
                      void moveIssueTo(
                        selectedIssue.projectId,
                        selectedIssue.id,
                        newParentIssueId,
                      )
                    }
                    onNavigateIssue={(sel) => openSelection(sel)}
                    knownKeys={knownKeys}
                    issues={issues}
                    wikiNodes={wikiNodes}
                  />
                ) : selectedProject ? (
                  <ProjectDetail
                    project={selectedProject}
                    saveStatus={saveStatus}
                    conflictPaths={conflictPaths}
                    onChange={updateProjectDraft}
                    onSave={() => saveDetail()}
                    onFlush={() => {
                      void flushDetail();
                    }}
                    onConflictReload={() => void resolveConflictReload()}
                    onConflictKeep={resolveConflictKeep}
                    onDelete={() => void onDeleteCurrent()}
                    onAddEpic={() => void addChildUnderSelection()}
                    onNavigateIssue={(sel) => openSelection(sel)}
                    knownKeys={knownKeys}
                    issues={issues}
                    wikiNodes={wikiNodes}
                  />
                ) : null}
              </aside>
            ) : null}
          </div>
        </div>

        {terminalOpen ? (
          <aside className={styles.terminal}>
            <TerminalPanel ref={terminalRef} />
          </aside>
        ) : null}
      </div>
    </div>
        )}
      </WikiNodesBridge>
      </MemberProvider>
    </WikiProvider>
  );
}

/** Child routes read openSelection via outlet context. */
export type WorkspaceOutletContext = {
  openSelection: (sel: Selection) => void;
  views: WorkspaceView[];
  /** False until the first listViews for this workspace settles. */
  viewsReady: boolean;
  refreshViews: () => Promise<void>;
  wikiNodes: WikiNodeMeta[];
};

export function HomeView() {
  const { openSelection, wikiNodes } = useOutletContext<WorkspaceOutletContext>();
  const {
    meta,
    issues,
    saveStatus,
    conflictPaths,
    updateWorkspaceDraft,
    saveDetail,
    flushDetail,
    resolveConflictReload,
    resolveConflictKeep,
  } = useWorkspace();

  const knownKeys = useMemo(
    () => new Set(issues.map((i) => issueRefKey(i.projectId, i.id))),
    [issues],
  );

  return (
    <WikiShell>
      <div className={styles.placeholder}>
        <h1>Overview</h1>
        <p className={styles.settingsHint}>
          Browse Contents for the wiki tree, or open{" "}
          <NavLink to="/w/wiki">All pages</NavLink> for the flat inventory.
        </p>
        {meta ? (
          <WorkspaceHomeDetail
            meta={meta}
            saveStatus={saveStatus}
            conflictPaths={conflictPaths}
            onChange={updateWorkspaceDraft}
            onSave={() => saveDetail()}
            onFlush={() => {
              void flushDetail();
            }}
            onConflictReload={() => void resolveConflictReload()}
            onConflictKeep={resolveConflictKeep}
            onNavigateIssue={openSelection}
            knownKeys={knownKeys}
            issues={issues}
            wikiNodes={wikiNodes}
          />
        ) : (
          <p>Loading workspace…</p>
        )}
      </div>
    </WikiShell>
  );
}

export function WikiAllPagesView() {
  return (
    <WikiShell contentWidth="full">
      <WikiAllPages />
    </WikiShell>
  );
}

export function MembersAllPagesView() {
  return (
    <WikiShell contentWidth="full">
      <MembersAllPages />
    </WikiShell>
  );
}

export function MemberDetailView() {
  const { memberId } = useParams<{ memberId: string }>();

  if (!memberId) {
    return <Navigate to="/w/members" replace />;
  }

  return (
    <WikiShell>
      <MemberEditor memberId={memberId} />
    </WikiShell>
  );
}

export function CollaborationView() {
  return (
    <WikiShell contentWidth="full">
      <CollaborationCards />
    </WikiShell>
  );
}

export function HandoffDetailView() {
  const { handoffId } = useParams<{ handoffId: string }>();

  if (!handoffId) {
    return <Navigate to="/w/handoffs" replace />;
  }

  return (
    <WikiShell>
      <HandoffEditor handoffId={handoffId} />
    </WikiShell>
  );
}

export function WikiNodeView() {
  const { wikiNodeId } = useParams<{ wikiNodeId: string }>();
  const { openSelection, wikiNodes } = useOutletContext<WorkspaceOutletContext>();
  const { issues } = useWorkspace();

  if (!wikiNodeId) {
    return <Navigate to="/w/home" replace />;
  }

  return (
    <WikiShell>
      <WikiNodeEditor
        wikiNodeId={wikiNodeId}
        issues={issues}
        wikiNodes={wikiNodes}
        onNavigateIssue={openSelection}
      />
    </WikiShell>
  );
}

/** Workspace settings page — rail label is "Settings" under Workspace.
 * Prefer adding new settings here; split routes only if this page grows too long.
 * ↔ components/wiki-shell/index.tsx — Workspace → Settings rail row */
export function SettingsGeneralView() {
  const {
    meta,
    saveStatus,
    updateWorkspaceDraft,
    saveDetail,
  } = useWorkspace();
  const { members, localMe, localMeError, setLocalMe } = useMember();
  const [meSaving, setMeSaving] = useState(false);

  const saveHostSave = useCallback(() => saveDetail(), [saveDetail]);
  const saveHostHasUnsaved = useCallback(
    () =>
      saveStatus === "dirty" ||
      saveStatus === "saving" ||
      saveStatus === "conflict" ||
      saveStatus === "error",
    [saveStatus],
  );
  useActiveSaveHost({
    save: saveHostSave,
    hasUnsaved: saveHostHasUnsaved,
  });

  const involvedMembers = useMemo(
    () =>
      (members?.nodes ?? [])
        .filter((m) => m.membership === "involved")
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title)),
    [members?.nodes],
  );

  const leftMe = useMemo(() => {
    if (!localMe || !members) {
      return null;
    }
    const node = members.nodes.find((m) => m.id === localMe);
    return node && node.membership === "left" ? node : null;
  }, [localMe, members]);

  const onLocalMeChange = async (value: string) => {
    const next = value === "" ? null : value;
    setMeSaving(true);
    try {
      await setLocalMe(next);
    } catch {
      // Error text lives on localMeError from MemberProvider.
    } finally {
      setMeSaving(false);
    }
  };

  if (!meta) {
    return (
      <WikiShell>
        <div className={styles.placeholder}>
          <p>Loading…</p>
        </div>
      </WikiShell>
    );
  }

  return (
    <WikiShell>
      <div className={styles.placeholder}>
        <h1>Settings</h1>
        <label className={styles.settingsField}>
          <span>Title</span>
          <Input
            value={meta.title}
            onChange={(e) => updateWorkspaceDraft({ title: e.target.value })}
          />
        </label>
        <div className={styles.settingsField}>
          <span>Created date</span>
          <span className={styles.settingsReadonly}>{meta.createdDate}</span>
        </div>
        <label className={styles.settingsField}>
          <span>Who you are (for signing)</span>
          <MemberPersonSelect
            aria-label="Who you are (for signing)"
            value={localMe}
            options={involvedMembers}
            extraOption={leftMe}
            disabled={meSaving || !members}
            onChange={(memberId) =>
              void onLocalMeChange(memberId ?? "")
            }
          />
        </label>
        <p className={styles.settingsHint}>
          Written to createdBy on create; optional. Not a login.
        </p>
        {localMeError ? (
          <p className={`${styles.settingsHint} ${styles.settingsHintError}`}>
            {localMeError}
          </p>
        ) : null}
        <div className={styles.settingsActions}>
          <Button
            type="button"
            variant={
              saveStatus === "dirty" ||
              saveStatus === "error" ||
              saveStatus === "conflict" ||
              saveStatus === "saving"
                ? "fill-inverse"
                : "fill"
            }
            disabled={
              saveStatus === "saving" ||
              saveStatus === "clean" ||
              saveStatus === "saved"
            }
            onClick={() => void saveDetail()}
          >
            {saveStatus === "saving" ? "Saving…" : "Save"}
          </Button>
          {saveStatus === "dirty" ? (
            <span
              className={`${styles.settingsHint} ${styles.settingsHintDirty}`}
            >
              Unsaved
            </span>
          ) : null}
          {saveStatus === "saved" ? (
            <span
              className={`${styles.settingsHint} ${styles.settingsHintOk}`}
            >
              Saved
            </span>
          ) : null}
          {saveStatus === "error" ? (
            <span
              className={`${styles.settingsHint} ${styles.settingsHintError}`}
            >
              Save failed
            </span>
          ) : null}
          {saveStatus === "conflict" ? (
            <span className={styles.settingsHint}>Conflict</span>
          ) : null}
        </div>
        <p className={styles.settingsHint}>
          Workspace body (README.md) is edited on Overview.
        </p>
      </div>
    </WikiShell>
  );
}

export function ProjectSettingsView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, refreshCustomProps, saveCustomProps } = useWorkspace();

  const project = projects.find((p) => p.id === projectId);

  if (!projectId) {
    return (
      <WikiShell>
        <div className={styles.placeholder}>
          <h1>Project settings</h1>
          <p>Missing project id.</p>
        </div>
      </WikiShell>
    );
  }

  if (!project) {
    return (
      <WikiShell>
        <div className={styles.placeholder}>
          <h1>Project settings</h1>
          <p>Project not found.</p>
          <Button type="button" variant="outlined" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </WikiShell>
    );
  }

  return (
    <WikiShell>
      <div className={styles.projectSettings}>
        <header className={styles.projectSettingsHeader}>
          <div>
            <p className={styles.projectSettingsEyebrow}>Project settings</p>
            <h1>{project.title}</h1>
          </div>
          <Button
            type="button"
            variant="outlined"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </header>
        <p className={styles.settingsHint}>
          Field schema for this project. Title, README, and assets stay on the
          project detail panel.
        </p>
        <CustomPropsEditor
          projectId={project.id}
          load={refreshCustomProps}
          save={saveCustomProps}
        />
      </div>
    </WikiShell>
  );
}

export function RoadmapView() {
  const { openSelection } = useOutletContext<WorkspaceOutletContext>();
  const { tree, issues, selection, persistIssueDates, persistIssueBlockedBy, setError } =
    useWorkspace();

  if (!tree) {
    return (
      <div className={styles.placeholder}>
        <h1>Roadmap</h1>
        <p>Loading hierarchy…</p>
      </div>
    );
  }

  return (
    <div className={roadmapStyles.host}>
      <RoadmapBoard
        viewKey="roadmap"
        tree={tree}
        issues={issues}
        selection={selection}
        onSelect={openSelection}
        onPersistIssueDates={async (projectId, issueId, dates) => {
          try {
            await persistIssueDates(projectId, issueId, dates);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
        onPersistIssueBlockedBy={async (projectId, issueId, blockedBy) => {
          try {
            await persistIssueBlockedBy(projectId, issueId, blockedBy);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      />
    </div>
  );
}

export function TableView() {
  const { openSelection } = useOutletContext<WorkspaceOutletContext>();
  const { tree, selection } = useWorkspace();

  if (!tree) {
    return (
      <div className={styles.tablePage}>
        <div className={styles.tablePageHeader}>
          <h1>Table</h1>
          <p>Loading hierarchy…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tablePage}>
      <div className={styles.tablePageHeader}>
        <h1>Table</h1>
        <p>
          Full workspace hierarchy with all props. Drag a title to reorder
          siblings or reparent without changing level. Collapse any level;
          click a row to open the detail sidebar.
        </p>
      </div>
      <IssueTable
        viewKey="table"
        tree={tree}
        selection={selection}
        onSelect={openSelection}
      />
    </div>
  );
}

export function CustomViewPage() {
  const { viewId } = useParams<{ viewId: string }>();
  const { openSelection, views, viewsReady } =
    useOutletContext<WorkspaceOutletContext>();
  const { tree, selection } = useWorkspace();

  const view = views.find((v) => v.id === viewId);

  if (!viewId) {
    return <Navigate to="/w/home" replace />;
  }

  // Stale history entry after delete — replace so Back/Forward skip the ghost URL.
  if (viewsReady && !view) {
    return <Navigate to="/w/home" replace />;
  }

  if (!viewsReady || !tree) {
    return (
      <div className={styles.placeholder}>
        <h1>{view?.name ?? "View"}</h1>
        <p>Loading hierarchy…</p>
      </div>
    );
  }

  if (!view) {
    return <Navigate to="/w/home" replace />;
  }

  return (
    <div className={styles.placeholder}>
      <h1>{view.name}</h1>
      <p>
        Custom list view — drag order is independent of Table / Roadmap.
      </p>
      <OrderedHierarchyOutline
        viewKey={viewId}
        tree={tree}
        selection={selection}
        onSelect={openSelection}
      />
    </div>
  );
}
