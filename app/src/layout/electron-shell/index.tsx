import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { GitSyncPanel } from "@/components/git-sync-panel";
import { Button } from "@/components/ui/button";
import { Lucide } from "@/components/ui/lucide";
import { getPm } from "@/lib/bridge";
import {
  useWorkspace,
  workspaceNameFromPath,
} from "@/lib/workspace/workspace-context";
import { useGitSync } from "@/lib/workspace/git-sync-context";
import styles from "./styles.module.scss";
import { useRouterHistoryControls } from "./use-router-history-controls";

const isMacElectron = window.pm?.platform === "darwin";

interface ElectronShellProps {
  children?: ReactNode;
}

/** macOS native hidden titlebar wrapper; passthrough on other platforms. */
export function ElectronShell({ children }: ElectronShellProps) {
  const body = children ?? <Outlet />;
  // Toast `top` uses this so fixed layers clear the Mac titlebar + workspace topbar.
  useLayoutEffect(() => {
    if (!isMacElectron) {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty(
      "--layout--shell-titlebar-height",
      "var(--layout--titlebar-height)",
    );
    return () => {
      root.style.removeProperty("--layout--shell-titlebar-height");
    };
  }, []);
  if (!isMacElectron) {
    return body;
  }
  return (
    <div className={styles.shell}>
      <MacTitlebar />
      <div className={styles.content}>{body}</div>
    </div>
  );
}

/**
 * Native macOS fullscreen (traffic lights hidden). Preload pulls current state
 * on subscribe; main also re-pushes after did-finish-load — so Cmd+R / HMR
 * remount keeps the no-inset titlebar while traffic lights are gone.
 */
function useNativeFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    return getPm().onFullscreenChange(setFullscreen);
  }, []);
  return fullscreen;
}

function MacTitlebar() {
  const location = useLocation();
  const { root, meta, hasWorkspace, revealPath } = useWorkspace();
  const { available } = useGitSync();
  const fullscreen = useNativeFullscreen();
  const { canBack, canForward, goBack, goForward } = useRouterHistoryControls();
  const inLab = location.pathname.startsWith("/lab");
  const titlebarClass = fullscreen
    ? `${styles.titlebar} ${styles.titlebarFullscreen}`
    : styles.titlebar;

  if (inLab || !hasWorkspace || !root) {
    return <div className={titlebarClass} aria-hidden />;
  }

  const title = meta?.title ?? workspaceNameFromPath(root);

  return (
    <div className={titlebarClass}>
      <div className={styles.sideCluster}>
        <Button
          type="button"
          variant="ghost"
          size="small"
          className={styles.titlebarButton}
          aria-label="Back"
          disabled={!canBack}
          onClick={goBack}
          startIcon={<Lucide.ChevronLeft aria-hidden />}
        />
        <Button
          type="button"
          variant="ghost"
          size="small"
          className={styles.titlebarButton}
          aria-label="Forward"
          disabled={!canForward}
          onClick={goForward}
          startIcon={<Lucide.ChevronRight aria-hidden />}
        />
      </div>

      <span className={styles.workspaceName} title={title}>
        {title}
      </span>

      <div className={`${styles.sideCluster} ${styles.sideClusterEnd}`}>
        {available ? <GitSyncPanel variant="titlebar" /> : null}
        <Button
          type="button"
          variant="ghost"
          size="small"
          className={styles.titlebarButton}
          aria-label="Reveal in Finder"
          title={root}
          onClick={() => void revealPath(root)}
          startIcon={<Lucide.FolderOpen aria-hidden />}
        />
      </div>
    </div>
  );
}
