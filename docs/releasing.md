# Releasing (macOS)

Repeatable local path: clean checkout → package → attach to GitHub Release.

## Channel

- **Entry:** GitHub Releases on `WenchuanLiliZhao/pm-all-in-one`
- **Artifacts:** `*.dmg` and `*-mac.zip` from `app/release/`
- **Not primary:** source archives, npm tarball

## Version alignment

Keep these the same string for a given ship:

| Place | Field |
| --- | --- |
| `app/package.json` | `version` |
| Git tag | `vX.Y.Z` |
| Release title | `vX.Y.Z` … |
| In-app About / display | must match after install |

First **trusted** external download build is locked to **`1.0.0`** (Developer ID + notarization). Unsigned packaging smokes may use the current `package.json` version (e.g. `0.1.0`) as a **prerelease**, not as the trusted `v1.0.0`.

## Steps

1. Checkout this repo (clean working tree).
2. Bump `app/package.json` `version` if needed; commit.
3. Package:

   ```sh
   cd app
   npm install
   npm run package:mac
   ```

4. Confirm outputs (names follow electron-builder `productName` + version + arch):

   - `app/release/pm all in one-<version>-arm64.dmg`
   - `app/release/pm all in one-<version>-arm64-mac.zip`

5. Create / update the Release for tag `vX.Y.Z` and upload **only** the DMG and zip (`.blockmap` files are for future auto-update; skip them). Do not treat the source tarball GitHub adds as the install story.
6. While unsigned, every Release must say so in its notes and repeat the `xattr -dr com.apple.quarantine` step. Mark it as a prerelease so GitHub does not surface it as Latest.
7. Signing / notarization: follow the product-trust checklist when shipping a Gatekeeper-clean build (`hardenedRuntime`, staple, cold-path smoke).

Uploading both artifacts takes on the order of 15 minutes on a home connection (~250 MB total). Budget for it; the upload, not the build, is the slow step.

## Naming

`productName` is `pm all in one`, so the bundle is `pm all in one.app` and `appId` is `com.pm-all-in-one.desktop`. Artifacts produced before 2026-08-11 carry the old `Local PM` name; do not reuse them as the public download.

## Smoke (unsigned)

Open the DMG, copy the app to `/Applications`, clear quarantine, launch:

```sh
xattr -dr com.apple.quarantine "/Applications/pm all in one.app"
```

Expect a Gatekeeper block before that step — on Apple Silicon it is usually reported as *damaged*. For the trusted `v1.0.0`, use the cold-path Release download checks under product trust instead; clearing quarantine by hand invalidates that test.
