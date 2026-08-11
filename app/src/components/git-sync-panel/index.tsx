/**
 * Single entry for inbound (remote) + outbound (local-only) workspace changes.
 *
 * ↔ lib/workspace/git-sync-context — status / changes / sync
 * ↔ layout/electron-shell — mac titlebar host
 * ↔ pages/channels/workspace-page/route — non-mac topbar host
 * ↔ lab/pages/git-sync-panel — state matrix
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Lucide } from "@/components/ui/lucide";
import type {
  GitSyncStatus,
  UnsyncedChanges,
  UnsyncedNodeChange,
  UnsyncedNodeRef,
} from "@/lib/types";
import { useGitSync } from "@/lib/workspace/git-sync-context";
import { useHandoffMetas } from "@/lib/workspace/use-handoff-metas";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import styles from "./styles.module.scss";

export type GitSyncPanelVariant = "titlebar" | "topbar";

export type GitSyncPanelProps = {
  variant?: GitSyncPanelVariant;
  /** Lab / tests: override live status. */
  statusOverride?: GitSyncStatus | null;
  /** Lab / tests: override live changes. */
  changesOverride?: UnsyncedChanges;
  /** Lab / tests: controlled open. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Lab: skip workspace navigation / terminal. */
  demo?: boolean;
  onOpenTerminal?: () => void;
  resolveTitle?: (ref: UnsyncedNodeRef) => string;
};

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function formatCheckedAt(iso: string | null | undefined): string {
  if (!iso) {
    return "unknown";
  }
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function summarizeNodes(nodes: UnsyncedNodeChange[]): string {
  const counts: Record<string, number> = {};
  for (const n of nodes) {
    const k = n.ref.kind;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const parts: string[] = [];
  const label: Record<string, [string, string]> = {
    issue: ["issue", "issues"],
    project: ["project", "projects"],
    wiki: ["wiki page", "wiki pages"],
    member: ["member", "members"],
    handoff: ["handoff", "handoffs"],
    workspace: ["workspace", "workspace"],
  };
  for (const key of Object.keys(counts)) {
    const n = counts[key]!;
    const [one, many] = label[key] ?? [key, key];
    parts.push(`${n} ${n === 1 ? one : many}`);
  }
  return parts.join(", ");
}

function defaultTitle(ref: UnsyncedNodeRef): string {
  switch (ref.kind) {
    case "workspace":
      return "Workspace";
    case "project":
      return `Project · ${shortId(ref.projectId)}`;
    case "issue":
      return `Issue · ${shortId(ref.issueId)}`;
    case "wiki":
      return `Wiki · ${shortId(ref.wikiNodeId)}`;
    case "member":
      return `Member · ${shortId(ref.memberId)}`;
    case "handoff":
      return `Handoff · ${shortId(ref.handoffId)}`;
    default: {
      const _e: never = ref;
      return String(_e);
    }
  }
}

export function GitSyncPanel({
  variant = "topbar",
  statusOverride,
  changesOverride,
  open,
  onOpenChange,
  demo = false,
  onOpenTerminal,
  resolveTitle: resolveTitleProp,
}: GitSyncPanelProps) {
  const navigate = useNavigate();
  const {
    available,
    status: liveStatus,
    changes: liveChanges,
    syncing,
    sync,
  } = useGitSync();
  const { meta, projects, issues, select, setTerminalOpen } = useWorkspace();
  const handoffs = useHandoffMetas();

  const status = statusOverride !== undefined ? statusOverride : liveStatus;
  const changes = changesOverride ?? liveChanges;

  const resolveTitle = useCallback(
    (ref: UnsyncedNodeRef): string => {
      if (resolveTitleProp) {
        return resolveTitleProp(ref);
      }
      switch (ref.kind) {
        case "workspace":
          return meta?.title?.trim() || "Workspace";
        case "project": {
          const p = projects.find((x) => x.id === ref.projectId);
          return p?.title?.trim() || defaultTitle(ref);
        }
        case "issue": {
          const iss = issues.find(
            (x) => x.projectId === ref.projectId && x.id === ref.issueId,
          );
          return iss?.title?.trim() || defaultTitle(ref);
        }
        case "handoff": {
          const h = handoffs.find((x) => x.id === ref.handoffId);
          return h?.title?.trim() || defaultTitle(ref);
        }
        default:
          return defaultTitle(ref);
      }
    },
    [resolveTitleProp, meta, projects, issues, handoffs],
  );

  const hasLocal = changes.nodes.length > 0 || changes.otherFiles.length > 0;
  const localCount = changes.nodes.length;
  // behind is trustworthy after a successful fetch; also ok after local refresh
  // (rev-list vs last-known upstream). Only hide when fetch failed (error set).
  const fetchFailed =
    status?.kind === "ok" &&
    status.fetched === false &&
    Boolean(status.error);
  const showRemoteIncoming =
    status?.kind === "ok" && status.behind > 0 && !fetchFailed;

  // Titlebar keeps a red dot (not a count). Pulse when the signal changes so
  // an already-dirty workspace still shows that something new landed.
  const badgeSignal = `${localCount}:${status?.behind ?? 0}:${hasLocal}:${showRemoteIncoming}`;
  const [badgePulse, setBadgePulse] = useState(false);
  const prevBadgeSignal = useRef<string | null>(null);
  useEffect(() => {
    if (prevBadgeSignal.current === null) {
      prevBadgeSignal.current = badgeSignal;
      return;
    }
    if (prevBadgeSignal.current === badgeSignal) {
      return;
    }
    prevBadgeSignal.current = badgeSignal;
    if (!(hasLocal || showRemoteIncoming)) {
      return;
    }
    setBadgePulse(true);
    const id = window.setTimeout(() => setBadgePulse(false), 600);
    return () => window.clearTimeout(id);
  }, [badgeSignal, hasLocal, showRemoteIncoming]);

  const triggerLabel = useMemo(() => {
    if (!status || status.kind === "not-repo") {
      return "Changes";
    }
    if (status.kind === "no-upstream") {
      return "Changes";
    }
    if (showRemoteIncoming && hasLocal) {
      return `Changes (${status.behind}↓ · ${localCount || "·"}↑)`;
    }
    if (showRemoteIncoming) {
      return `Changes (${status.behind})`;
    }
    if (hasLocal && localCount > 0) {
      return `Changes (${localCount})`;
    }
    return "Changes";
  }, [status, showRemoteIncoming, hasLocal, localCount]);

  const triggerTitle = useMemo(() => {
    if (!status || status.kind === "not-repo") {
      return "Workspace changes";
    }
    if (status.kind === "no-upstream") {
      return "This workspace has no remote configured";
    }
    if (fetchFailed) {
      return "Could not reach remote — showing local state";
    }
    if (hasLocal) {
      return "Only on this computer";
    }
    if (showRemoteIncoming) {
      return "Remote has new changes";
    }
    return "Synced to remote";
  }, [status, hasLocal, showRemoteIncoming, fetchFailed]);

  const onSelectNode = useCallback(
    async (ref: UnsyncedNodeRef) => {
      if (demo) {
        return;
      }
      switch (ref.kind) {
        case "workspace":
          navigate("/w/home");
          break;
        case "project":
          await select({ kind: "project", projectId: ref.projectId });
          navigate("/w/table");
          break;
        case "issue":
          await select({
            kind: "issue",
            projectId: ref.projectId,
            issueId: ref.issueId,
          });
          navigate("/w/table");
          break;
        case "wiki":
          navigate(`/w/wiki/${ref.wikiNodeId}`);
          break;
        case "member":
          navigate(`/w/members/${ref.memberId}`);
          break;
        case "handoff":
          navigate(`/w/handoffs/${ref.handoffId}`);
          break;
        default:
          break;
      }
    },
    [demo, navigate, select],
  );

  const openTerminal = useCallback(() => {
    if (onOpenTerminal) {
      onOpenTerminal();
      return;
    }
    if (!demo) {
      setTerminalOpen(true);
    }
  }, [demo, onOpenTerminal, setTerminalOpen]);

  if (!demo && !available && statusOverride === undefined) {
    return null;
  }

  const syncDisabled =
    !status ||
    status.kind === "no-upstream" ||
    status.kind === "not-repo" ||
    (status.kind === "ok" && status.dirty);

  const button =
    variant === "titlebar" ? (
      <Button
        type="button"
        variant="ghost"
        size="small"
        aria-label={triggerTitle}
        title={triggerTitle}
        loading={syncing}
        startIcon={<Lucide.RefreshCw aria-hidden />}
      >
        {hasLocal || showRemoteIncoming ? (
          <span
            className={[
              styles.badgeDot,
              badgePulse ? styles.badgeDotPulse : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          />
        ) : null}
      </Button>
    ) : (
      <Button
        type="button"
        size="medium"
        variant="outlined"
        title={triggerTitle}
        loading={syncing}
        startIcon={<Lucide.RefreshCw aria-hidden />}
      >
        {triggerLabel}
      </Button>
    );

  let footer: ReactNode = null;
  if (status?.kind === "no-upstream") {
    footer = (
      <p className={styles.footer}>
        This workspace has no remote configured.
      </p>
    );
  } else if (fetchFailed) {
    footer = (
      <p className={styles.footer}>
        Offline — could not reach remote · last checked{" "}
        {formatCheckedAt(status?.checkedAt)}
      </p>
    );
  } else if (status?.kind === "ok" && !hasLocal && !showRemoteIncoming) {
    footer = <p className={styles.footerMuted}>Synced to remote</p>;
  } else if (status?.error && !fetchFailed) {
    footer = <p className={styles.footer}>{status.error}</p>;
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{button}</DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        side="bottom"
        className={styles.panel}
      >
        {/*
          Scroll body + pinned action: DropdownMenu Content scrolls as a whole
          (overflow-y: auto). We override that on `.panel` and scroll only here —
          do not teach the menu primitive about sticky footers.
          ↔ styles.module.scss — .panel / .scroll / .stickyAction
        */}
        <div className={styles.scroll}>
          <div className={styles.section}>
            <div className={styles.sectionHead}>Incoming</div>
            {showRemoteIncoming ? (
              <div className={styles.sectionBody}>
                <p className={styles.blurb}>
                  Remote has {status!.behind} new change
                  {status!.behind === 1 ? "" : "s"}.
                </p>
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  disabled={syncDisabled}
                  loading={syncing}
                  onClick={() => void sync()}
                >
                  Sync
                </Button>
                {status?.dirty ? (
                  <p className={styles.hint}>
                    Local edits block Sync — finish them in the terminal first.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className={styles.empty}>Nothing new from remote</p>
            )}
          </div>

          <DropdownMenu.Separator />

          <div className={styles.section}>
            <div className={styles.sectionHead}>Only on this computer</div>
            {hasLocal ? (
              <div className={styles.sectionBody}>
                {localCount > 0 ? (
                  <p className={styles.blurb}>
                    {summarizeNodes(changes.nodes)}
                  </p>
                ) : null}
                <ul className={styles.nodeList}>
                  {changes.nodes.map((node) => (
                    <li key={nodeKey(node.ref)}>
                      <button
                        type="button"
                        className={styles.nodeRow}
                        onClick={() => void onSelectNode(node.ref)}
                      >
                        <span className={styles.nodeTitle}>
                          {resolveTitle(node.ref)}
                        </span>
                        <span className={styles.marks}>
                          {node.propsChanged ? (
                            <span className={styles.mark}>Props</span>
                          ) : null}
                          {node.bodyChanged ? (
                            <span className={styles.mark}>Body</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {changes.otherFiles.length > 0 ? (
                  <details className={styles.other}>
                    <summary>
                      Other files ({changes.otherFiles.length})
                    </summary>
                    <ul className={styles.otherList}>
                      {changes.otherFiles.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : (
              <p className={styles.empty}>Nothing waiting to share</p>
            )}
          </div>

          {footer ? (
            <>
              <DropdownMenu.Separator />
              {footer}
            </>
          ) : null}
        </div>

        {hasLocal ? (
          <div className={styles.stickyAction}>
            <Button
              type="button"
              size="small"
              variant="ghost"
              onClick={openTerminal}
            >
              Push from terminal
            </Button>
          </div>
        ) : null}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function nodeKey(ref: UnsyncedNodeRef): string {
  switch (ref.kind) {
    case "workspace":
      return "workspace";
    case "project":
      return `project:${ref.projectId}`;
    case "issue":
      return `issue:${ref.projectId}::${ref.issueId}`;
    case "wiki":
      return `wiki:${ref.wikiNodeId}`;
    case "member":
      return `member:${ref.memberId}`;
    case "handoff":
      return `handoff:${ref.handoffId}`;
    default: {
      const _e: never = ref;
      return String(_e);
    }
  }
}
