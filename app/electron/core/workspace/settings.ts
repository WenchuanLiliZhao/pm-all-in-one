/**
 * App-level `settings.json` in userData (not the workspace). Last-opened root
 * plus an MRU list for File → Open Recent. Never cache as a module singleton.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

export const MAX_RECENT_WORKSPACES = 10;

export interface AppSettings {
  lastWorkspaceRoot?: string;
  recentWorkspaceRoots?: string[];
}

function resolveUserDataDir(): string {
  if (process.env.LOCAL_PM_USER_DATA) {
    return path.resolve(process.env.LOCAL_PM_USER_DATA);
  }
  if (process.versions.electron) {
    try {
      const require = createRequire(import.meta.url);
      const { app } = require("electron") as typeof import("electron");
      return app.getPath("userData");
    } catch {
      // fall through — e.g. unit tests without Electron
    }
  }
  return path.join(os.tmpdir(), "local-pm-web");
}

function settingsPath(): string {
  return path.join(resolveUserDataDir(), "settings.json");
}

function normalizeWorkspaceRoot(root: string): string {
  return path.resolve(root);
}

function uniqueRoots(roots: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const root of roots) {
    if (typeof root !== "string" || !root.trim()) {
      continue;
    }
    const normalized = normalizeWorkspaceRoot(root);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function readSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as AppSettings;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeSettings(patch: AppSettings): AppSettings {
  const next = { ...readSettings(), ...patch };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

/** MRU workspace folders for File → Open Recent. Migrates last-only settings. */
export function listRecentWorkspaceRoots(): string[] {
  const settings = readSettings();
  const listed = Array.isArray(settings.recentWorkspaceRoots)
    ? settings.recentWorkspaceRoots
    : undefined;
  if (listed) {
    return uniqueRoots(listed).slice(0, MAX_RECENT_WORKSPACES);
  }
  return settings.lastWorkspaceRoot
    ? uniqueRoots([settings.lastWorkspaceRoot]).slice(0, MAX_RECENT_WORKSPACES)
    : [];
}

export function setLastWorkspaceRoot(root: string): void {
  const normalized = normalizeWorkspaceRoot(root);
  const recent = uniqueRoots([normalized, ...listRecentWorkspaceRoots()]).slice(
    0,
    MAX_RECENT_WORKSPACES,
  );
  writeSettings({ lastWorkspaceRoot: normalized, recentWorkspaceRoots: recent });
}

export function removeRecentWorkspaceRoot(root: string): void {
  const normalized = normalizeWorkspaceRoot(root);
  writeSettings({
    recentWorkspaceRoots: listRecentWorkspaceRoots().filter(
      (item) => item !== normalized,
    ),
  });
}

/** Clears the Open Recent list. Restore-on-launch still uses lastWorkspaceRoot. */
export function clearRecentWorkspaceRoots(): void {
  writeSettings({ recentWorkspaceRoots: [] });
}
