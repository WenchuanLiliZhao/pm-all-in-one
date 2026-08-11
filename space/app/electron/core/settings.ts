import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

export interface AppSettings {
  lastWorkspaceRoot?: string;
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

export function setLastWorkspaceRoot(root: string): void {
  writeSettings({ lastWorkspaceRoot: root });
}
