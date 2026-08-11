/**
 * The one place core loads esbuild.
 *
 * The import order below is load-bearing: `./esbuild-binary.js` must be
 * evaluated before `esbuild`, whose module body captures
 * `ESBUILD_BINARY_PATH` at load time. Do not reorder these two lines and do
 * not let an import sorter do it either.
 *
 * ↔ core/esbuild-binary.ts — sets the variable for packaged (asar) builds
 */
import { esbuildBinaryPath } from "./esbuild-binary.js";
import * as esbuild from "esbuild";

export { esbuild, esbuildBinaryPath };
