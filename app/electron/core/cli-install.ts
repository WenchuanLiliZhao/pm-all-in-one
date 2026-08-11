/**
 * Link the userData `pm-all-in-one` shim into a PATH directory so the CLI is
 * reachable from outside the app's built-in terminal (editors, plain shells).
 *
 * The link points at the userData shim rather than at the app bundle, so it
 * survives app moves and upgrades — each launch rewrites the shim in place.
 *
 * ↔ electron/core/local-pm-shim.ts — produces the shim this links to
 * ↔ electron/main.ts — "Install Command Line Tool…" menu item calls this
 * ↔ DEVELOPMENT.md — § CLI distribution
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SHIM_MARKER } from "./local-pm-shim.js";

export type CliInstallResult = {
  linkPath: string;
  onPath: boolean;
  replaced: boolean;
};

/**
 * Preferred because these are conventionally on a login shell's PATH. A GUI
 * launch gives the app a narrow PATH of its own, so membership here — not the
 * app's `process.env.PATH` alone — is what makes a link reachable.
 */
const PREFERRED_DIRS = ["/usr/local/bin", "/opt/homebrew/bin"];

function isWritableDir(dir: string): boolean {
  try {
    if (!fs.statSync(dir).isDirectory()) {
      return false;
    }
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function pathEntries(): string[] {
  return (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
}

/** First writable well-known bin dir, else the per-user fallback. */
export function chooseCliDir(): string {
  for (const dir of PREFERRED_DIRS) {
    if (isWritableDir(dir)) {
      return dir;
    }
  }
  return path.join(os.homedir(), ".local", "bin");
}

/**
 * Refuse to clobber anything we did not put there: a symlink or a previously
 * generated shim is ours to replace, an unrelated regular file is not.
 */
function clearExistingLink(linkPath: string): boolean {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(linkPath);
  } catch {
    return false;
  }
  if (!stat.isSymbolicLink()) {
    let body = "";
    try {
      body = fs.readFileSync(linkPath, "utf8");
    } catch {
      body = "";
    }
    if (!body.includes(SHIM_MARKER)) {
      throw new Error(
        `${linkPath} already exists and was not created by pm-all-in-one. Remove it first, then install again.`,
      );
    }
  }
  fs.rmSync(linkPath);
  return true;
}

export function installCliLink(
  shimPath: string,
  dir: string = chooseCliDir(),
): CliInstallResult {
  if (process.platform === "win32") {
    throw new Error(
      "Installing the pm-all-in-one command line tool is not supported on Windows yet.",
    );
  }
  if (!fs.existsSync(shimPath)) {
    throw new Error(
      `No shim at ${shimPath}. Relaunch the app so it is written, then install again.`,
    );
  }
  fs.mkdirSync(dir, { recursive: true });
  const linkPath = path.join(dir, "pm-all-in-one");
  const replaced = clearExistingLink(linkPath);
  fs.symlinkSync(shimPath, linkPath);
  const onPath = PREFERRED_DIRS.includes(dir) || pathEntries().includes(dir);
  return { linkPath, onPath, replaced };
}
