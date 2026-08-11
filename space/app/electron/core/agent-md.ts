/**
 * Product-owned `.pm/agent.md` revision stamp + drift check against the
 * shipped workspace template.
 * ↔ doctor.ts — scanStrays appends agent-md-modified / agent-md-outdated
 * ↔ workspace-template.ts — factory body lives under workspaceTemplateDir()
 * ↔ DEVELOPMENT.md — § Workspace templates (rev bump house rule)
 */
import fs from "node:fs";
import path from "node:path";

import { workspaceTemplateDir } from "./workspace-template.js";

export type AgentMdStatus =
  | "match"
  | "modified"
  | "outdated"
  | "missing";

const STAMP_RE =
  /^<!--\s*local-pm agent\.md rev (\d+)\b[^>]*-->\s*\r?\n?/;

export function agentMdPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".pm", "agent.md");
}

export function factoryAgentMdPath(): string {
  return path.join(workspaceTemplateDir(), ".pm", "agent.md");
}

/** Parse `rev N` from the optional first-line HTML comment stamp. */
export function parseAgentMdRev(text: string): number | null {
  const m = STAMP_RE.exec(text);
  if (!m) {
    return null;
  }
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Body used for byte comparison: stamp line stripped when present. */
export function stripAgentMdStamp(text: string): string {
  return text.replace(STAMP_RE, "");
}

/**
 * Compare workspace `.pm/agent.md` to the product template.
 *
 * - missing: no workspace file
 * - outdated: no stamp, or stamp rev ≠ factory rev (product moved on)
 * - modified: same rev, body differs (user edited)
 * - match: same rev and same body
 */
export function checkAgentMd(workspaceRoot: string): AgentMdStatus {
  const wsPath = agentMdPath(workspaceRoot);
  if (!fs.existsSync(wsPath)) {
    return "missing";
  }
  const factoryPath = factoryAgentMdPath();
  if (!fs.existsSync(factoryPath)) {
    // Packaged / misbuilt: cannot judge; treat as match so doctor stays quiet.
    return "match";
  }

  const workspace = fs.readFileSync(wsPath, "utf8");
  const factory = fs.readFileSync(factoryPath, "utf8");
  const wsRev = parseAgentMdRev(workspace);
  const factoryRev = parseAgentMdRev(factory);

  if (wsRev === null || factoryRev === null || wsRev !== factoryRev) {
    return "outdated";
  }

  if (stripAgentMdStamp(workspace) !== stripAgentMdStamp(factory)) {
    return "modified";
  }
  return "match";
}
