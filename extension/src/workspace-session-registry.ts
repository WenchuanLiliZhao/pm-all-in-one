import * as path from "node:path";
import * as vscode from "vscode";
import { PmSession, type HostUi } from "./pm-host";

export type AcquiredSession = {
  root: string;
  session: PmSession;
  release: () => void;
};

export type PmSurface = "map" | "node";

type Entry = {
  root: string;
  session: PmSession;
  panels: Map<vscode.WebviewPanel, PmSurface>;
  openPromise: Promise<void>;
};

function workspaceTitleFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("meta" in payload)) {
    return undefined;
  }
  const title = (payload as { meta?: { title?: unknown } }).meta?.title;
  if (typeof title !== "string") {
    return undefined;
  }
  const trimmed = title.trim();
  return trimmed || undefined;
}

export class WorkspaceSessionRegistry {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly ui: HostUi) {}

  async acquire(
    root: string,
    panel: vscode.WebviewPanel,
    surface: PmSurface,
  ): Promise<AcquiredSession> {
    const key = path.resolve(root);
    let entry = this.entries.get(key);
    if (!entry) {
      const panels = new Map<vscode.WebviewPanel, PmSurface>();
      const session = new PmSession(this.ui, (event, payload) => {
        const live = this.entries.get(key);
        if (!live) {
          return;
        }
        const mapTitle = workspaceTitleFromPayload(payload);
        for (const [p, kind] of live.panels) {
          void p.webview.postMessage({ type: "event", event, payload });
          if (kind === "map" && mapTitle) {
            p.title = mapTitle;
          }
        }
      });
      entry = {
        root: key,
        session,
        panels,
        openPromise: session.openWorkspaceAt(key).then(() => undefined),
      };
      this.entries.set(key, entry);
    }
    try {
      await entry.openPromise;
    } catch (e) {
      this.entries.delete(key);
      entry.session.dispose();
      throw e;
    }
    entry.panels.set(panel, surface);
    let released = false;
    return {
      root: key,
      session: entry.session,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        const live = this.entries.get(key);
        if (!live) {
          return;
        }
        live.panels.delete(panel);
        if (live.panels.size === 0) {
          live.session.dispose();
          this.entries.delete(key);
        }
      },
    };
  }

  disposeAll(): void {
    for (const entry of this.entries.values()) {
      entry.session.dispose();
    }
    this.entries.clear();
  }
}
