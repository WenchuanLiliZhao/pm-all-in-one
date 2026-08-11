/**
 * Resolve esbuild's platform binary for packaged (asar) builds.
 *
 * A packaged app runs from `app.asar`, which is an archive rather than a
 * directory: esbuild's JS layer resolves its executable next to itself and
 * `spawn` then fails with ENOTDIR. electron-builder keeps the real executable
 * in `app.asar.unpacked`, so point `ESBUILD_BINARY_PATH` there.
 *
 * Runs as a module side effect because esbuild reads the variable once, when
 * its own module body loads.
 *
 * ↔ electron/core/infra/esbuild-runtime.ts — imports this before "esbuild"
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function unpackedBinary(): string | null {
  const here = fileURLToPath(import.meta.url);
  const marker = `${path.sep}app.asar${path.sep}`;
  const at = here.indexOf(marker);
  if (at < 0) {
    return null;
  }
  const pkg = path.join(
    here.slice(0, at),
    "app.asar.unpacked",
    "node_modules",
    "@esbuild",
    `${process.platform}-${process.arch}`,
  );
  const candidate =
    process.platform === "win32"
      ? path.join(pkg, "esbuild.exe")
      : path.join(pkg, "bin", "esbuild");
  return existsSync(candidate) ? candidate : null;
}

function apply(): string | null {
  if (process.env.ESBUILD_BINARY_PATH) {
    return process.env.ESBUILD_BINARY_PATH;
  }
  const binary = unpackedBinary();
  if (binary) {
    process.env.ESBUILD_BINARY_PATH = binary;
  }
  return binary;
}

/** Null when unpackaged (dev, CLI on plain Node) — esbuild resolves its own. */
export const esbuildBinaryPath: string | null = apply();
