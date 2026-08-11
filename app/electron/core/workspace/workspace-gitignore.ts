/**
 * Ensure workspace `.gitignore` lists machine-local `.pm/local.json` and
 * `.pm/local.md`.
 * ↔ workspace-template.ts — create-when-missing reads template `.gitignore`
 * ↔ electron/main.ts / server/main.ts — called on open
 */
import fs from "node:fs";
import path from "node:path";

import { workspaceTemplateDir } from "./workspace-template.js";

const LOCAL_GITIGNORE_LINES = [".pm/local.json", ".pm/local.md"] as const;

/**
 * Ensure `.gitignore` lists machine-local `.pm/local.json` (`me` / future
 * repos) and `.pm/local.md` (AI path notes). Creates `.gitignore` from the
 * workspace template when missing; otherwise appends any absent lines.
 */
export function ensureLocalJsonGitignore(workspaceRoot: string): void {
  const gitignorePath = path.join(workspaceRoot, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    const templateIgnore = path.join(workspaceTemplateDir(), ".gitignore");
    fs.writeFileSync(
      gitignorePath,
      fs.readFileSync(templateIgnore, "utf8"),
      "utf8",
    );
    return;
  }
  let text = fs.readFileSync(gitignorePath, "utf8");
  const present = new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const missing = LOCAL_GITIGNORE_LINES.filter((line) => !present.has(line));
  if (missing.length === 0) {
    return;
  }
  const suffix = text.endsWith("\n") || text.length === 0 ? "" : "\n";
  text = `${text}${suffix}${missing.join("\n")}\n`;
  fs.writeFileSync(gitignorePath, text, "utf8");
}
