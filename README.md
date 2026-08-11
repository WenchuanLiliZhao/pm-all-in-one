# pm all in one

Local-first project manager: workspace data lives as Markdown and directories on disk, next to your code. Collaboration is git — no account, no server, no permission system.

This repository is the product home (macOS app + `local-pm` CLI).

## Status: open-source stage

Builds here are **unsigned and not notarized**. There is no Apple Developer ID on the build machine yet, so macOS treats a downloaded build as an unidentified app. Signed, notarized `v1.0.0` is a later stage.

Practically that means: this is currently aimed at developers who are comfortable clearing the quarantine attribute or building from source. It is not yet a "download and double-click" product for a general audience.

## Get it

### Build from source (no Gatekeeper friction)

A locally built app carries no quarantine attribute, so it just opens.

```sh
cd app
npm install
npm run dev        # Electron window — not the bare Vite tab
npm run package:mac   # or produce a local .app / DMG
```

### Download a release

Prebuilt macOS artifacts: [GitHub Releases](https://github.com/WenchuanLiliZhao/pm-all-in-one/releases) (DMG + zip, Apple Silicon).

Because the build is unsigned, macOS will refuse the first open — on Apple Silicon it usually reports the app as *damaged* rather than *unsigned*. Clear the quarantine attribute after moving it into `/Applications`:

```sh
xattr -dr com.apple.quarantine "/Applications/pm all in one.app"
```

Only do that if you trust this source. The app embeds a terminal and reads/writes your workspace directory, so it is a reasonable thing to be careful about — which is also why signing and notarization are on the roadmap rather than permanently skipped.

## Package and release

See [docs/releasing.md](docs/releasing.md).

## Names

| Surface | Value |
| --- | --- |
| Display / app bundle | pm all in one |
| Repo / slug | `pm-all-in-one` |
| CLI | `local-pm` |
| macOS `appId` | `com.pm-all-in-one.desktop` |
