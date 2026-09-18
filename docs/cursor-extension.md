# Cursor extension (Open VSX)

Cursor’s extension panel does **not** read the Visual Studio Marketplace. The public channel for this host is [Open VSX](https://open-vsx.org). Do not `vsce publish` unless we later decide to list on VS Code as well.

| | |
| --- | --- |
| Extension id | `wenchuanlilizhao.pm-all-in-one` |
| `package.json` `publisher` | `wenchuanlilizhao` (must equal the Open VSX namespace) |
| Version | `extension/package.json` `version` — independent of the Electron / npm CLI semver |
| Listing (after first publish) | https://open-vsx.org/extension/wenchuanlilizhao/pm-all-in-one |

This file is the followable checklist. Host/bridge law stays on library wiki @wiki-knmfR1w4iT7_IMK1ZN6va.

## Package a VSIX

From a clean checkout of this product tree:

```sh
cd app && npm install
cd ../extension && npm install
npm run package
```

`vscode:prepublish` runs `compile` (copies workspace templates, Vite-builds the webview into `media/webview/`, esbuild-bundles `out/extension.js`). Output: `extension/pm-all-in-one-<version>.vsix` (gitignored).

Do **not** pass `--no-dependencies`. Activation loads `esbuild` and `chokidar` from the VSIX; omitting them dies with `Cannot find module 'esbuild'`.

Sideload smoke (required before upload): Cursor → **Extensions: Install from VSIX…** → **Developer: Reload Window** → open a real `.pmws` workspace → Open in pm-all-in-one and New PM Workspace…. Expect the webview chrome to follow the Cursor theme.

## First publish (human, once)

`ovsx` cannot create the Eclipse identity for you.

1. GitHub login at [open-vsx.org](https://open-vsx.org).
2. Eclipse account at https://accounts.eclipse.org/user/register — **GitHub Username** must be the same account.
3. Open VSX → Settings → Profile → **Log in with Eclipse**.
4. Same page → **Publisher Agreement** (not the Eclipse Contributor Agreement) → Agree.
5. Profile → Access Tokens → generate one.
6. Create the namespace (once; must match `publisher`):

```sh
npx ovsx create-namespace wenchuanlilizhao -p <OPEN_VSX_TOKEN>
```

If the CLI still says the agreement is missing, wait a few minutes and retry — Open VSX often lags the signature.

Store the token in an env var, not in git: `export OVSX_PAT=…`

## Upload

Same version string cannot be reused on Open VSX. Bump `extension/package.json` `version` (and `CHANGELOG.md`) before a re-ship.

```sh
cd extension
npx ovsx publish pm-all-in-one-<version>.vsix -p "$OVSX_PAT"
```

Or, with `OVSX_PAT` set, `npx ovsx publish` from `extension/` (packages then uploads).

Confirm the listing page, then search **pm-all-in-one** in Cursor’s Extensions panel. Cursor proxies Open VSX and runs its own scan — search can lag minutes to hours after a successful `ovsx publish`. Sideload still works meanwhile.

Cursor “verified” listing is optional later (public site + forum post). It is not required to appear in search.

## Out of scope

- Visual Studio Marketplace / `vsce publish` / Azure PAT
- Attaching the VSIX to a GitHub Release (not the Cursor install path)
- Bumping Electron or npm CLI versions in lockstep with the extension
