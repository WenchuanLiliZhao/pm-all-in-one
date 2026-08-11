# Releasing (macOS)

Repeatable local path: clean checkout → package → attach to GitHub Release.

## Channel

- **Entry:** GitHub Releases on `WenchuanLiliZhao/pm-all-in-one`
- **Artifacts:** `*.dmg` and `*-mac.zip` from `space/app/release/`
- **Not primary:** source archives, npm tarball

## Version alignment

Keep these the same string for a given ship:

| Place | Field |
| --- | --- |
| `space/app/package.json` | `version` |
| Git tag | `vX.Y.Z` |
| Release title | `vX.Y.Z` … |
| In-app About / display | must match after install |

First **trusted** external download build is locked to **`1.0.0`** (Developer ID + notarization). Unsigned packaging smokes may use the current `package.json` version (e.g. `0.1.0`) as a **prerelease**, not as the trusted `v1.0.0`.

## Steps

1. Checkout this repo (clean working tree).
2. Bump `space/app/package.json` `version` if needed; commit.
3. Package:

   ```sh
   cd space/app
   npm install
   npm run package:mac
   ```

4. Confirm outputs (names follow electron-builder `productName` + version + arch):

   - `space/app/release/<Product>-<version>-arm64.dmg`
   - `space/app/release/<Product>-<version>-arm64-mac.zip`

5. Create / update the Release for tag `vX.Y.Z` and upload **only** the DMG and zip (optional: `.blockmap` for auto-update later). Do not treat the source tarball GitHub adds as the install story.
6. Signing / notarization: follow the product-trust checklist when shipping a Gatekeeper-clean build (`hardenedRuntime`, staple, cold-path smoke). Until then, label the Release as unsigned / prerelease.

## Smoke (unsigned)

Open the DMG, copy the app, launch. Expect Gatekeeper warnings without Developer ID. For trusted `v1.0.0`, use the cold-path Release download checks under product trust.
