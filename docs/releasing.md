# Releasing (macOS app + `pm-all-in-one` CLI)

Repeatable local path: clean checkout → package app → publish CLI → attach GitHub Release.

## Channel

- **App entry:** GitHub Releases on `WenchuanLiliZhao/pm-all-in-one`
- **App artifacts:** `*.dmg` and `*-mac.zip` from `app/release/`
- **CLI entry:** public npm package [`pm-all-in-one`](https://www.npmjs.com/package/pm-all-in-one) (from `app/dist-cli/`)
- **Not primary:** source archives

Bare name `local-pm` is **not** usable on npm (403: too similar to `local-pkg`). Do not try to reclaim it.

## Version alignment

Keep these the same string for a given ship:

| Place | Field |
| --- | --- |
| `app/package.json` | `version` |
| npm `pm-all-in-one` | same `version` (emitted into `dist-cli/package.json`) |
| Git tag | `vX.Y.Z` |
| Release title | `vX.Y.Z` … |
| In-app About / display | must match after install |

The npm package **tracks `app/package.json` for every ship**, including `0.x`. Epic naming: **`vN` ships only when epic vN ends.** Unsigned packaging smokes and the public open-source cut are **v0** → keep shipping `0.x` as **prerelease**. First **trusted** external app download is locked to **`1.0.0`** and is the end of **v1** (Developer ID + notarization + product surface ready enough to put behind that trust). That reservation is about Gatekeeper trust and epic boundaries, not a separate CLI version line.

Who publishes: the same person cutting the Release runs both the app upload and `npm publish`. Shipping an app version without a reachable matching CLI on npm is a checklist miss.

Bump template `.pm/agent.md` only when the **install path or package name** changes (rev stamp) — not on every version bump.

## Steps

1. Checkout this repo (clean working tree).
2. Bump `app/package.json` `version` if needed; commit.
3. Package the macOS app:

   ```sh
   cd app
   npm install
   npm run package:mac
   ```

4. Confirm outputs (names follow electron-builder `productName` + version + arch):

   - `app/release/pm-all-in-one-<version>-arm64.dmg`
   - `app/release/pm-all-in-one-<version>-arm64-mac.zip`

5. **Packaged workspace smoke (required).** Launching the window is not enough — v0.1.0 shipped an app that could not open any workspace because esbuild's binary lived inside `app.asar` (`spawn ENOTDIR`). From the tree just packaged:

   ```sh
   APP="release/mac-arm64/pm-all-in-one.app"
   ELECTRON_RUN_AS_NODE=1 "$APP/Contents/MacOS/pm-all-in-one" \
     "$APP/Contents/Resources/app.asar/dist-electron/cli.js" \
     doctor --workspace /absolute/path/to/a/real/workspace
   ```

   That must print `OK — no strays, warnings, or ladder violations.` Then also open the `.app` GUI and open the same workspace (or restore it) and confirm Home / Contents render — not a blank error. If either fails, do not upload.

6. Publish the CLI at the same version:

   ```sh
   cd app
   npm run build:cli
   npm publish ./dist-cli --access public
   ```

   Dry-run first when unsure: `npm publish ./dist-cli --dry-run`. If npm rejects the version (previously used under this name), bump patch and retry both app and CLI together. Prefer a granular access token with Bypass 2FA for publish (interactive OTP is easy to rate-limit).

7. Create / update the Release for tag `vX.Y.Z` and upload **only** the DMG and zip (`.blockmap` files are for future auto-update; skip them). Do not treat the source tarball GitHub adds as the install story.
8. While unsigned, paste the **Unsigned Release notes template** below (fill `X.Y.Z` / changelog), mark the Release as a **prerelease** so GitHub does not surface it as Latest, and keep the title honest (e.g. `vX.Y.Z (unsigned …)`). Bundle name must be `pm-all-in-one.app` (not the retired `Local PM`).
9. Signing / notarization: follow the product-trust checklist when shipping a Gatekeeper-clean build (`hardenedRuntime`, staple, cold-path smoke). Drop the unsigned template once Developer ID + notarization are in place.

Uploading both app artifacts takes on the order of 15 minutes on a home connection (~250 MB total). Budget for it; the upload, not the build, is the slow step. CLI publish is seconds once logged in.

## Unsigned Release notes template

Copy into every unsigned GitHub Release body. Mark the Release **prerelease**. Do not teach the right-click Gatekeeper bypass — it is not reliable on current macOS.

**Release title:** `vX.Y.Z (unsigned — …)`

~~~~markdown
## Unsigned developer preview — not a trusted download

Tag, `package.json`, and the in-app version all read **`X.Y.Z`**. Bundle name is **`pm-all-in-one.app`**.

### What you get

- macOS **arm64 DMG** and **zip** (Apple Silicon)

### Changelog

- …what changed in this cut…

### Read this before downloading

- **Unsigned and not notarized.** There is no Apple Developer ID on the build machine. macOS will refuse the first open; on Apple Silicon it usually reports the app as *damaged* rather than *unsigned*. That is expected, and it is not a corrupted download.
- To open it anyway, after moving the app into `/Applications`:

  ```sh
  xattr -dr com.apple.quarantine "/Applications/pm-all-in-one.app"
  ```

  Only do this if you trust this source. The app embeds a terminal and reads your workspace directory.
- **Friction-free alternative:** build from source. A locally built app carries no quarantine attribute. See the README.
- **`1.0.0` is reserved** for the first signed and notarized build (end of epic v1).

Packaging steps: `docs/releasing.md` (includes the required packaged-workspace smoke).
~~~~

## Naming

`productName` is `pm-all-in-one`, so the bundle is `pm-all-in-one.app` and `appId` is `com.pm-all-in-one.desktop`. CLI command and npm package are both `pm-all-in-one`. Artifacts produced before 2026-08-11 carry the old `Local PM` name; later unsigned builds used a spaced display name until this rename. Do not reuse those as the public download.

## Smoke (unsigned)

Open the DMG, copy the app to `/Applications`, clear quarantine, launch, **then open a real workspace** (not just the welcome screen):

```sh
xattr -dr com.apple.quarantine "/Applications/pm-all-in-one.app"
```

Expect a Gatekeeper block before that step — on Apple Silicon it is usually reported as *damaged*. For the trusted `v1.0.0` (end of epic v1), use the cold-path Release download checks under product trust instead; clearing quarantine by hand invalidates that test.

The doctor command in step 5 is the fast gate that would have caught the v0.1.0 `ENOTDIR` failure before upload.
