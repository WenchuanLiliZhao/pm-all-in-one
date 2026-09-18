import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import fs from "node:fs";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.join(__dirname, "..");
const appDir = path.join(extensionDir, "../app");
const watch = process.argv.includes("--watch");

function assertAppVite() {
  const viteBin = path.join(appDir, "node_modules/vite/bin/vite.js");
  if (fs.existsSync(viteBin)) {
    return viteBin;
  }
  throw new Error(
    "Missing app/node_modules/vite. From a clean tree:\n" +
      "  cd ../app && npm install\n" +
      "  cd ../extension && npm install\n" +
      "  npm run compile",
  );
}

function copyTemplates() {
  const destRoot = path.join(extensionDir, "templates");
  fs.rmSync(destRoot, { recursive: true, force: true });
  fs.mkdirSync(destRoot, { recursive: true });
  for (const name of ["workspace-template", "project-template"]) {
    const src = path.join(appDir, "electron", name);
    const dest = path.join(destRoot, name);
    fs.cpSync(src, dest, { recursive: true });
  }
}

function runVite() {
  const viteBin = assertAppVite();
  const config = path.join(extensionDir, "vite.config.ts");
  const args = [viteBin, "build", "--config", config];
  if (watch) {
    args.push("--watch");
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: appDir,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0 || watch) {
        resolve(undefined);
      } else {
        reject(new Error(`vite build exited ${code}`));
      }
    });
    child.on("error", reject);
  });
}

async function bundleHost() {
  await build({
    absWorkingDir: extensionDir,
    entryPoints: [path.join(extensionDir, "src/extension.ts")],
    outfile: path.join(extensionDir, "out/extension.js"),
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    sourcemap: true,
    external: ["vscode", "esbuild", "chokidar"],
    banner: {
      js: 'const import_meta_url = require("url").pathToFileURL(__filename).href;',
    },
    define: {
      "import.meta.url": "import_meta_url",
    },
    logLevel: "info",
  });
}

copyTemplates();
await runVite();
await bundleHost();
