import chokidar, { type FSWatcher } from "chokidar";
import path from "node:path";

import { loadCustomProps } from "./custom-props.js";
import { scanStrays, type DoctorReport } from "./doctor.js";
import { rebuildIndex } from "./index.js";
import { listIssues, listProjects } from "./store.js";
import type { CustomPropsSchema, WorkspaceMeta } from "./types.js";
import {
  readWorkspaceMeta,
  workspacePropsPath,
  workspaceReadmePath,
} from "./workspace-meta.js";

export type WorkspaceChangePayload = {
  projects: Awaited<ReturnType<typeof listProjects>>;
  tree: Awaited<ReturnType<typeof rebuildIndex>>;
  issues: Awaited<ReturnType<typeof listIssues>>;
  strays: DoctorReport;
  meta: WorkspaceMeta;
  /** projectId → custom-props schema */
  customProps: Record<string, CustomPropsSchema>;
};

export type WorkspaceWatchError = {
  message: string;
  at: string;
};

export class WorkspaceWatcher {
  private watcher: FSWatcher | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  start(
    workspaceRoot: string,
    onChange: (payload: WorkspaceChangePayload) => void,
    onError?: (err: WorkspaceWatchError) => void,
  ): void {
    this.stop();
    const hierarchy = path.join(workspaceRoot, "issue-hierarchy");
    const wiki = path.join(workspaceRoot, "wiki");
    const members = path.join(workspaceRoot, "members");
    const handoffs = path.join(workspaceRoot, "handoffs");
    const pmDir = path.join(workspaceRoot, ".pm");
    const sep = path.sep;

    this.watcher = chokidar.watch(
      [
        hierarchy,
        wiki,
        members,
        handoffs,
        workspacePropsPath(workspaceRoot),
        workspaceReadmePath(workspaceRoot),
      ],
      {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
        // persistIndex / persistAgentTree write unconditionally under .pm/
        // and would self-trigger if the workspace root were watched broadly.
        ignored: (watchedPath: string) => {
          const normalized = path.resolve(watchedPath);
          const pm = path.resolve(pmDir);
          return (
            normalized === pm ||
            normalized.startsWith(pm + sep) ||
            // Project-local .pm dirs under issue-hierarchy
            normalized.includes(`${sep}.pm${sep}`) ||
            normalized.endsWith(`${sep}.pm`)
          );
        },
      },
    );

    const bump = () => {
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this.timer = setTimeout(() => {
        void (async () => {
          try {
            const tree = await rebuildIndex(workspaceRoot);
            const projects = await listProjects(workspaceRoot);
            const issues = await listIssues(workspaceRoot);
            const strays = scanStrays(workspaceRoot);
            const meta = await readWorkspaceMeta(workspaceRoot);
            const customProps: Record<string, CustomPropsSchema> = {};
            for (const project of projects) {
              customProps[project.id] = await loadCustomProps(project.path);
            }
            onChange({ projects, tree, issues, strays, meta, customProps });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            onError?.({
              message,
              at: new Date().toISOString(),
            });
            // Still swallow for the callback chain so mid-write parse flakes
            // do not crash the watcher; callers can surface the last error.
          }
        })();
      }, 150);
    };

    this.watcher.on("all", bump);
    this.watcher.on("error", (err) => {
      onError?.({
        message: err instanceof Error ? err.message : String(err),
        at: new Date().toISOString(),
      });
    });
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = null;
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
  }
}
