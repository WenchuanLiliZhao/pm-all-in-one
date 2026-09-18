# `extension/`

Cursor host for the same React UI and `electron/core/` as the desktop app. Package id: `wenchuanlilizhao.pm-all-in-one`.

Standing facts: library wiki @wiki-knmfR1w4iT7_IMK1ZN6va. Ship to Cursor via Open VSX: product `docs/cursor-extension.md`.

## Commands

From this directory, after `cd ../app && npm install` (Vite lives in the app):

```sh
npm install
npm run compile    # templates + webview + host bundle
npm run package    # VSIX (runs compile via vscode:prepublish)
```

Do **not** pass `--no-dependencies` to vsce — `esbuild` and `chokidar` must ship in the VSIX.

Do **not** publish to the Visual Studio Marketplace for Cursor users. Cursor reads Open VSX.

The VSIX is gitignored. After a local install: **Developer: Reload Window**.
