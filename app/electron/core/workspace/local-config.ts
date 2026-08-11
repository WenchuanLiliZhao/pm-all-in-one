/**
 * Per-workspace local (gitignored) config: `.pm/local.json`.
 * Holds machine-local facts that must not enter git — today: `me` (current member).
 *
 * Never cache the result as a module singleton; callers pass actor as a parameter.
 */
import fs from "node:fs";
import path from "node:path";

import { isValidEntityId, type EntityId } from "../identity/dir-id.js";
import { workspacePmDir } from "../identity/ids.js";

export interface LocalConfig {
  /** Current member id for create-time createdBy; omit / null = unsigned. */
  me?: EntityId | null;
  /** Reserved for repo-links local path table (future). */
  repos?: Record<string, string>;
}

export function localConfigPath(workspaceRoot: string): string {
  return path.join(workspacePmDir(workspaceRoot), "local.json");
}

export function readLocalConfig(workspaceRoot: string): LocalConfig {
  const file = localConfigPath(workspaceRoot);
  if (!fs.existsSync(file)) {
    return {};
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {};
    }
    const obj = raw as Record<string, unknown>;
    const out: LocalConfig = {};
    if (obj.me === null) {
      out.me = null;
    } else if (typeof obj.me === "string" && isValidEntityId(obj.me)) {
      out.me = obj.me;
    }
    if (obj.repos && typeof obj.repos === "object" && !Array.isArray(obj.repos)) {
      const repos: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj.repos as Record<string, unknown>)) {
        if (typeof v === "string") {
          repos[k] = v;
        }
      }
      out.repos = repos;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeLocalConfig(
  workspaceRoot: string,
  config: LocalConfig,
): LocalConfig {
  const pm = workspacePmDir(workspaceRoot);
  fs.mkdirSync(pm, { recursive: true });
  const prev = readLocalConfig(workspaceRoot);
  const next: LocalConfig = { ...prev, ...config };
  if (config.me === undefined) {
    next.me = prev.me;
  }
  if (next.me != null && !isValidEntityId(next.me)) {
    throw new Error(`Invalid me member id: ${JSON.stringify(next.me)}`);
  }
  const file = localConfigPath(workspaceRoot);
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

/** Resolve create-time actor: explicit option wins, else local.json me. */
export function resolveActorMemberId(
  workspaceRoot: string,
  explicit?: EntityId | null,
): EntityId | null {
  if (explicit !== undefined) {
    if (explicit === null) {
      return null;
    }
    if (!isValidEntityId(explicit)) {
      throw new Error(`Invalid actor member id: ${JSON.stringify(explicit)}`);
    }
    return explicit;
  }
  const me = readLocalConfig(workspaceRoot).me;
  return me ?? null;
}
