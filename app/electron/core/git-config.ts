import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitIdentity {
  name: string | null;
  email: string | null;
}

const TIMEOUT_MS = 2000;

/**
 * Best-effort read of git user.name / user.email (optional prefills).
 * Never authoritative — 1.0 has no in-app roster; collab identity is git.
 * Any failure (no git, not a repo, unset config) returns nulls; never throws.
 *
 * Isolated module: this is the only core shell-out. Safe to delete wholesale.
 */
export async function readGitIdentity(
  workspaceRoot: string,
): Promise<GitIdentity> {
  const name = await readGitConfig(workspaceRoot, "user.name");
  const email = await readGitConfig(workspaceRoot, "user.email");
  return { name, email };
}

async function readGitConfig(
  cwd: string,
  key: string,
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["config", "--get", key], {
      cwd,
      timeout: TIMEOUT_MS,
      encoding: "utf8",
    });
    const value = stdout.trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
