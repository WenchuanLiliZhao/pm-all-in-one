/**
 * Clipboard text for workspace doctor warnings — paste into a CLI or another AI.
 */
import type { DoctorWarning } from "@/lib/types";

const FACTORY_AGENT_MD =
  "pm-all-in-one/app/electron/workspace-template/.pm/agent.md";

function warningHeader(
  warning: DoctorWarning,
  workspaceRoot: string,
): string {
  const file = warning.relPath ?? warning.path ?? "(unknown path)";
  const lines = [
    "Fix this local-pm workspace doctor warning.",
    "",
    `Workspace: ${workspaceRoot || "(unknown)"}`,
    `Kind: ${warning.kind}`,
    `File: ${file}`,
  ];
  if (warning.line != null) {
    lines.push(`Line: ${warning.line}`);
  }
  lines.push(`Message: ${warning.message}`);
  return lines.join("\n");
}

const SHARED_CONSTRAINTS = [
  "Hard rules:",
  "- Never invent or rename nanoid directory ids.",
  "- Do not hand-edit parentId / level / created / updated / createdBy.",
  "- Do not add library conventions to .pm/agent.md; those belong in .agents/skills/custom/ (see pm-create-skill).",
].join("\n");

function agentMdOutdatedRecipe(workspaceRoot: string): string {
  const ws = workspaceRoot || "<this workspace>";
  return [
    "Task: refresh this workspace's `.pm/agent.md` to the current product template.",
    "The app does not auto-refresh this file (detection only).",
    "",
    "Steps:",
    `1. Open the pm-all-in-one product repo and read \`${FACTORY_AGENT_MD}\`. Line 1 is \`<!-- local-pm agent.md rev N -->\`.`,
    `2. Read \`${ws}/.pm/agent.md\` if it exists. If it has library-specific additions that are not in the factory file, move those into \`${ws}/.agents/skills/custom/\` first. Do not keep them in agent.md.`,
    `3. Replace \`${ws}/.pm/agent.md\` with the factory file byte-for-byte, including the rev stamp on line 1. If the file is missing, create it from the factory file.`,
    "4. Do not edit the factory file. Do not bump its rev. Only this workspace copy.",
    "5. After the write, doctor kind `agent-md-outdated` should clear (same rev and body as the template).",
    "",
    SHARED_CONSTRAINTS,
  ].join("\n");
}

function agentMdModifiedRecipe(workspaceRoot: string): string {
  const ws = workspaceRoot || "<this workspace>";
  return [
    "Task: this workspace's `.pm/agent.md` is at the same product rev as the shipped template, but the body was edited.",
    "",
    "Steps:",
    `1. Diff \`${ws}/.pm/agent.md\` against \`${FACTORY_AGENT_MD}\` (ignore the first-line rev stamp).`,
    `2. Move any library-specific additions into \`${ws}/.agents/skills/custom/\` (see pm-create-skill).`,
    `3. Restore \`${ws}/.pm/agent.md\` from the factory file byte-for-byte, including the rev stamp.`,
    "4. Do not edit the factory file. Do not bump its rev.",
    "5. After the write, doctor kind `agent-md-modified` should clear.",
    "",
    SHARED_CONSTRAINTS,
  ].join("\n");
}

function genericRecipe(): string {
  return [
    "Task: diagnose and fix this warning using the disk law in this workspace's `.pm/agent.md`.",
    "",
    SHARED_CONSTRAINTS,
  ].join("\n");
}

export function doctorWarningFixPrompt(
  warning: DoctorWarning,
  workspaceRoot: string,
): string {
  const header = warningHeader(warning, workspaceRoot);
  const recipe =
    warning.kind === "agent-md-outdated"
      ? agentMdOutdatedRecipe(workspaceRoot)
      : warning.kind === "agent-md-modified"
        ? agentMdModifiedRecipe(workspaceRoot)
        : genericRecipe();
  return `${header}\n\n${recipe}\n`;
}
