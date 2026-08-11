#!/usr/bin/env node
/**
 * Assemble a standalone, publishable `local-pm` CLI package from the compiled
 * Electron output. The CLI is pure Node, so people without the desktop app can
 * reach the same allocator via `npx local-pm …`.
 *
 * Usage: node ./scripts/build-cli-package.mjs <targetDir>   (build:cli → dist-cli)
 *
 * Only the modules `cli.js` actually reaches are copied, which keeps
 * Electron-importing siblings such as `core/settings.js` out of the package.
 *
 * ↔ electron/cli.ts — entry whose import graph defines the package contents
 * ↔ scripts/copy-templates.mjs — same template pair, different output root
 * ↔ DEVELOPMENT.md — § CLI distribution
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "local-pm";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetArg = process.argv[2];
if (!targetArg) {
  console.error("Usage: node ./scripts/build-cli-package.mjs <targetDir>");
  process.exit(1);
}
const targetDir = path.resolve(appRoot, targetArg);
const distDir = path.join(appRoot, "dist-electron");
const entry = path.join(distDir, "cli.js");

if (!fs.existsSync(entry)) {
  console.error(`Missing ${path.relative(appRoot, entry)} — run build:electron first.`);
  process.exit(1);
}

/**
 * Anchored at column 0 so `from "…"` quoted inside emitted string literals
 * (schema-dts.ts writes example imports into generated comments) is not read
 * as a real edge.
 */
const IMPORT_RE = /^(?:import|export)[^"']*?from\s+"([^"]+)";/gm;

/** Walk relative imports from the entry; collect files and bare specifiers. */
function collect(entryFile) {
  const files = new Set();
  const externals = new Set();
  const queue = [entryFile];
  while (queue.length > 0) {
    const file = queue.pop();
    if (files.has(file)) {
      continue;
    }
    if (!fs.existsSync(file)) {
      console.error(`Unresolved import target: ${file}`);
      process.exit(1);
    }
    files.add(file);
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[1];
      if (spec.startsWith("node:")) {
        continue;
      }
      if (spec.startsWith(".")) {
        if (spec.endsWith(".js")) {
          queue.push(path.resolve(path.dirname(file), spec));
        }
        continue;
      }
      externals.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
    }
  }
  return { files, externals };
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const appPkg = JSON.parse(
  fs.readFileSync(path.join(appRoot, "package.json"), "utf8"),
);
const { files, externals } = collect(entry);

const dependencies = {};
for (const name of [...externals].sort()) {
  const range = appPkg.dependencies?.[name];
  if (!range) {
    console.error(`CLI imports "${name}" but it is not in app dependencies.`);
    process.exit(1);
  }
  dependencies[name] = range;
}

fs.rmSync(targetDir, { recursive: true, force: true });
for (const file of files) {
  copyRecursive(file, path.join(targetDir, path.relative(distDir, file)));
}
for (const name of ["workspace-template", "project-template"]) {
  const src = path.join(distDir, name);
  if (!fs.existsSync(src)) {
    console.error(`Missing template in dist-electron: ${name}`);
    process.exit(1);
  }
  copyRecursive(src, path.join(targetDir, name));
}
fs.chmodSync(path.join(targetDir, "cli.js"), 0o755);

const pkg = {
  name: PACKAGE_NAME,
  version: appPkg.version,
  description:
    "Command line interface for local-pm workspaces — allocate ids, create and move issues, run doctor.",
  license: appPkg.license ?? "UNLICENSED",
  type: "module",
  bin: { [PACKAGE_NAME]: "./cli.js" },
  engines: appPkg.engines,
  dependencies,
};
fs.writeFileSync(
  path.join(targetDir, "package.json"),
  `${JSON.stringify(pkg, null, 2)}\n`,
  "utf8",
);

fs.writeFileSync(
  path.join(targetDir, "README.md"),
  `# ${PACKAGE_NAME}

Command line interface for [local-pm](https://github.com/) workspaces. Runs on
plain Node — the desktop app is not required.

\`\`\`sh
npx ${PACKAGE_NAME} doctor
npx ${PACKAGE_NAME} issue create --project <projectId> --parent root --title "…"
\`\`\`

The workspace root is resolved from \`--workspace <path>\`, then
\`LOCAL_PM_WORKSPACE\`, then by searching upward from the current directory.

Ids are allocated here. Never create workspace directories by hand.
`,
  "utf8",
);

console.log(
  `Built ${PACKAGE_NAME}@${pkg.version} → ${path.relative(appRoot, targetDir)} ` +
    `(${files.size} modules, deps: ${Object.keys(dependencies).join(", ") || "none"})`,
);
