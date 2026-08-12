## 2026-08-11 (closed)

**Status:** done — fix shipped as `v0.1.1`; broken `v0.1.0` assets removed / release labelled do-not-download.

**Fix**
- `electron/core/esbuild-binary.ts` — points `ESBUILD_BINARY_PATH` at the `app.asar.unpacked` copy of the platform binary
- `electron/core/esbuild-runtime.ts` — sole esbuild importer; binary module declared first (load-order)
- `package.json` `asarUnpack` for `@esbuild` / `esbuild/bin` / `node-pty`
- `docs/releasing.md` — required packaged-workspace `doctor` smoke before upload

**Verified before upload**
- Packaged CLI via the app Electron binary: `doctor --workspace <new-world>` → `OK`
- `issue list` against the same workspace succeeds (props load path)
- Bundle name then `pm all in one` (pre-rename), version `0.1.1`

**Release**
- https://github.com/WenchuanLiliZhao/pm-all-in-one/releases/tag/v0.1.1 — DMG + zip uploaded
- `v0.1.0` retitled “BROKEN — do not download”, zero assets
- npm `pm-all-in-one@0.1.1` published to match
