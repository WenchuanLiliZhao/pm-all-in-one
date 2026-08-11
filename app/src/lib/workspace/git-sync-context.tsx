/**
 * Desktop git sync status + unsynced node list for the shell.
 *
 * ↔ electron/core/desktop/git-sync.ts — status fields
 * ↔ electron/core/desktop/git-changes.ts — UnsyncedChanges
 * ↔ components/git-sync-panel — consumer
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
import { getPm, isWebPm } from "@/lib/bridge";
import { useToast } from "@/lib/toast";
import type {
  GitPullResult,
  GitSyncStatus,
  UnsyncedChanges,
} from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-context";

const FOCUS_INTERVAL_MS = 60_000;
const LOCAL_REFRESH_DEBOUNCE_MS = 1_000;

const EMPTY_CHANGES: UnsyncedChanges = {
  kind: "not-repo",
  nodes: [],
  otherFiles: [],
};

export type GitSyncFeedback = {
  tone: "success" | "error";
  message: string;
};

type GitSyncContextValue = {
  /** Desktop + git repo (or checking); false on web / not-repo. */
  available: boolean;
  status: GitSyncStatus | null;
  changes: UnsyncedChanges;
  /** ISO from last status check (network or local). */
  checkedAt: string | null;
  checking: boolean;
  syncing: boolean;
  /** In-page result after Sync. */
  feedback: GitSyncFeedback | null;
  clearFeedback: () => void;
  /** Network fetch + status (also refreshes changes). */
  refreshStatus: () => Promise<void>;
  /** Local-only status + changes (no fetch). */
  refreshLocal: () => Promise<void>;
  refreshChanges: () => Promise<void>;
  sync: () => Promise<GitPullResult>;
};

const GitSyncContext = createContext<GitSyncContextValue | null>(null);

export function GitSyncProvider({ children }: { children: ReactNode }) {
  const { root, hasWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [status, setStatus] = useState<GitSyncStatus | null>(null);
  const [changes, setChanges] = useState<UnsyncedChanges>(EMPTY_CHANGES);
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<GitSyncFeedback | null>(null);
  const inFlight = useRef(0);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktop = !isWebPm();

  const clearFeedback = useCallback(() => {
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
    setFeedback(null);
  }, []);

  const showFeedback = useCallback(
    (next: GitSyncFeedback, autoClearMs?: number) => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
        feedbackTimer.current = null;
      }
      setFeedback(next);
      if (autoClearMs != null) {
        feedbackTimer.current = setTimeout(() => {
          feedbackTimer.current = null;
          setFeedback(null);
        }, autoClearMs);
      }
    },
    [],
  );

  const refreshChanges = useCallback(async () => {
    if (!desktop || !hasWorkspace || !root) {
      setChanges(EMPTY_CHANGES);
      return;
    }
    try {
      const next = await getPm().getUnsyncedChanges();
      setChanges(next);
    } catch (e) {
      setChanges({
        kind: "not-repo",
        nodes: [],
        otherFiles: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, [desktop, hasWorkspace, root]);

  const refreshLocal = useCallback(async () => {
    if (!desktop || !hasWorkspace || !root) {
      setStatus(null);
      setChanges(EMPTY_CHANGES);
      return;
    }
    const gen = ++inFlight.current;
    setChecking(true);
    try {
      const [nextStatus, nextChanges] = await Promise.all([
        getPm().getGitSyncStatus({ fetch: false }),
        getPm().getUnsyncedChanges(),
      ]);
      if (gen !== inFlight.current) {
        return;
      }
      setStatus(nextStatus);
      setChanges(nextChanges);
    } catch (e) {
      if (gen !== inFlight.current) {
        return;
      }
      setStatus({
        kind: "not-repo",
        behind: 0,
        ahead: 0,
        dirty: false,
        checkedAt: new Date().toISOString(),
        fetched: false,
        error: e instanceof Error ? e.message : String(e),
      });
      setChanges(EMPTY_CHANGES);
    } finally {
      if (gen === inFlight.current) {
        setChecking(false);
      }
    }
  }, [desktop, hasWorkspace, root]);

  const refreshStatus = useCallback(async () => {
    if (!desktop || !hasWorkspace || !root) {
      setStatus(null);
      setChanges(EMPTY_CHANGES);
      return;
    }
    const gen = ++inFlight.current;
    setChecking(true);
    try {
      const [nextStatus, nextChanges] = await Promise.all([
        getPm().getGitSyncStatus({ fetch: true }),
        getPm().getUnsyncedChanges(),
      ]);
      if (gen !== inFlight.current) {
        return;
      }
      setStatus(nextStatus);
      setChanges(nextChanges);
    } catch (e) {
      if (gen !== inFlight.current) {
        return;
      }
      setStatus({
        kind: "not-repo",
        behind: 0,
        ahead: 0,
        dirty: false,
        checkedAt: new Date().toISOString(),
        fetched: false,
        error: e instanceof Error ? e.message : String(e),
      });
      setChanges(EMPTY_CHANGES);
    } finally {
      if (gen === inFlight.current) {
        setChecking(false);
      }
    }
  }, [desktop, hasWorkspace, root]);

  const sync = useCallback(async (): Promise<GitPullResult> => {
    if (!desktop || !hasWorkspace || !root) {
      const result: GitPullResult = {
        ok: false,
        reason: "git-error",
        message: "Git sync is not available here.",
      };
      showFeedback({ tone: "error", message: result.message });
      showToast({ message: result.message });
      return result;
    }
    clearFeedback();
    setSyncing(true);
    try {
      const result = await getPm().pullWorkspace();
      if (result.ok) {
        const message = "Synced — workspace is up to date.";
        showFeedback({ tone: "success", message }, 5000);
        showToast({ message, durationMs: 5000 });
      } else {
        showFeedback({ tone: "error", message: result.message });
        showToast({ message: result.message });
      }
      // Always re-read authoritative status (no optimistic rewrite).
      await refreshStatus();
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      showFeedback({ tone: "error", message });
      showToast({ message });
      await refreshStatus();
      return { ok: false, reason: "git-error", message };
    } finally {
      setSyncing(false);
    }
  }, [
    desktop,
    hasWorkspace,
    root,
    refreshStatus,
    showToast,
    showFeedback,
    clearFeedback,
  ]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Network poll + focus: update behind via fetch.
  useEffect(() => {
    if (!desktop || !hasWorkspace) {
      return;
    }
    const onFocus = () => {
      void refreshStatus();
    };
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(() => {
      if (document.hasFocus()) {
        void refreshStatus();
      }
    }, FOCUS_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, [desktop, hasWorkspace, refreshStatus]);

  // Workspace disk changes → local refresh (no network).
  useEffect(() => {
    if (!desktop || !hasWorkspace) {
      return;
    }
    const scheduleLocal = () => {
      if (localDebounce.current) {
        clearTimeout(localDebounce.current);
      }
      localDebounce.current = setTimeout(() => {
        localDebounce.current = null;
        void refreshLocal();
      }, LOCAL_REFRESH_DEBOUNCE_MS);
    };
    const unsub = getPm().onChanged(() => {
      scheduleLocal();
    });
    return () => {
      unsub();
      if (localDebounce.current) {
        clearTimeout(localDebounce.current);
        localDebounce.current = null;
      }
    };
  }, [desktop, hasWorkspace, refreshLocal]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  const available =
    desktop &&
    hasWorkspace &&
    status !== null &&
    status.kind !== "not-repo";

  const checkedAt = status?.checkedAt ?? null;

  const value = useMemo(
    () => ({
      available,
      status,
      changes,
      checkedAt,
      checking,
      syncing,
      feedback,
      clearFeedback,
      refreshStatus,
      refreshLocal,
      refreshChanges,
      sync,
    }),
    [
      available,
      status,
      changes,
      checkedAt,
      checking,
      syncing,
      feedback,
      clearFeedback,
      refreshStatus,
      refreshLocal,
      refreshChanges,
      sync,
    ],
  );

  return (
    <GitSyncContext.Provider value={value}>{children}</GitSyncContext.Provider>
  );
}

export function useGitSync(): GitSyncContextValue {
  const ctx = useContext(GitSyncContext);
  if (!ctx) {
    throw new Error("useGitSync must be used within GitSyncProvider");
  }
  return ctx;
}
