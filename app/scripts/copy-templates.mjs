#!/usr/bin/env node
/**
 * Copy electron/workspace-template and electron/project-template into a
 * compiled outDir (tsc does not emit non-.ts files).
 *
 * Usage: node ./scripts/copy-templates.mjs <targetDir>
 *   build:electron → dist-electron
 *   build:server   → dist-server/electron
 *
 * ↔ electron/core/workspace-template.ts — runtime resolver expects these siblings
 * ↔ electron/core/agent-md.ts — factory `.pm/agent.md` (incl. `.agents/skills/`) lives here
 * ↔ DEVELOPMENT.md — § Workspace templates
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetArg = process.argv[2];
if (!targetArg) {
  console.error("Usage: node ./scripts/copy-templates.mjs <targetDir>");
  process.exit(1);
}
const targetDir = path.resolve(appRoot, targetArg);

function copyRecursive(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

for (const name of ["workspace-template", "project-template"]) {
  const src = path.join(appRoot, "electron", name);
  const dest = path.join(targetDir, name);
  if (!fs.existsSync(src)) {
    console.error(`Missing template source: ${src}`);
    process.exit(1);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  copyRecursive(src, dest);
  console.log(`Copied ${name} → ${path.relative(appRoot, dest)}`);
}
