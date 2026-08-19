/**
 * Required workspace dirs that may be empty keep `.gitkeep` so git can track them.
 * ↔ ../identity/ids.ts — ensureDirWithGitkeep primitive
 * ↔ scaffold-workspace.ts — create-time
 * ↔ electron/main.ts / server/main.ts — open-time
 * ↔ workspace-template.ts — template ships the same placeholders
 * ↔ DEVELOPMENT.md — § Workspace templates
 */
import path from "node:path";

import {
  ensureDirWithGitkeep,
  handoffsRoot,
  hierarchyRoot,
  membersRoot,
} from "../identity/ids.js";

export function customSkillsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".agents", "skills", "custom");
}

/**
 * Ensure members/, handoffs/, issue-hierarchy/, and .agents/skills/custom/
 * exist and contain `.gitkeep`. Safe to call on every open.
 */
export function ensureStructuralGitkeeps(workspaceRoot: string): void {
  ensureDirWithGitkeep(membersRoot(workspaceRoot));
  ensureDirWithGitkeep(handoffsRoot(workspaceRoot));
  ensureDirWithGitkeep(hierarchyRoot(workspaceRoot));
  ensureDirWithGitkeep(customSkillsDir(workspaceRoot));
}
