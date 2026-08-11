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
import type { GitPullResult, GitSyncStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-context";

const FOCUS_INTERVAL_MS = 60_000;
/** Ignore stale behind>0 from in-flight fetches right after a successful pull. */
const POST_SYNC_GRACE_MS = 10_000;

export type GitSyncFeedback = {
  tone: "success" | "error";
  message: string;
};

type GitSyncContextValue = {
  /** Desktop + git repo (or checking); false on web / not-repo. */
  available: boolean;
  status: GitSyncStatus | null;
  checking: boolean;
  syncing: boolean;
  /** In-page result after Sync (same band as the behind banner). */
  feedback: GitSyncFeedback | null;
  clearFeedback: () => void;
  refreshStatus: () => Promise<void>;
  sync: () => Promise<GitPullResult>;
};

const GitSyncContext = createContext<GitSyncContextValue | null>(null);

export function GitSyncProvider({ children }: { children: ReactNode }) {
  const { root, hasWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [status, setStatus] = useState<GitSyncStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<GitSyncFeedback | null>(null);
  const inFlight = useRef(0);
  const syncedAt = useRef(0);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const applyStatus = useCallback((next: GitSyncStatus) => {
    if (
      next.kind === "ok" &&
      next.behind > 0 &&
      Date.now() - syncedAt.current < POST_SYNC_GRACE_MS
    ) {
      setStatus({ ...next, behind: 0 });
      return;
    }
    setStatus(next);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!desktop || !hasWorkspace || !root) {
      setStatus(null);
      return;
    }
    const gen = ++inFlight.current;
    setChecking(true);
    try {
      const next = await getPm().getGitSyncStatus();
      if (gen !== inFlight.current) {
        return;
      }
      applyStatus(next);
    } catch (e) {
      if (gen !== inFlight.current) {
        return;
      }
      applyStatus({
        kind: "not-repo",
        behind: 0,
        ahead: 0,
        dirty: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      if (gen === inFlight.current) {
        setChecking(false);
      }
    }
  }, [desktop, hasWorkspace, root, applyStatus]);

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
        syncedAt.current = Date.now();
        setStatus((prev) =>
          prev && prev.kind === "ok"
            ? { ...prev, behind: 0, dirty: false, error: undefined }
            : { kind: "ok", behind: 0, ahead: 0, dirty: false },
        );
        const message = "Synced — workspace is up to date.";
        showFeedback({ tone: "success", message }, 5000);
        showToast({ message, durationMs: 5000 });
        // Reconcile in the background; grace window keeps banner cleared.
        void refreshStatus();
      } else {
        showFeedback({ tone: "error", message: result.message });
        showToast({ message: result.message });
        void refreshStatus();
      }
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      showFeedback({ tone: "error", message });
      showToast({ message });
      void refreshStatus();
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

  const value = useMemo(
    () => ({
      available,
      status,
      checking,
      syncing,
      feedback,
      clearFeedback,
      refreshStatus,
      sync,
    }),
    [
      available,
      status,
      checking,
      syncing,
      feedback,
      clearFeedback,
      refreshStatus,
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
