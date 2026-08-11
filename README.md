# pm all in one

Local-first project manager: workspace data lives as Markdown and directories on disk; collaboration is git.

This repository is the **product** home (macOS app + `local-pm` CLI).

## Download

**Sole external download entry:** [GitHub Releases](https://github.com/WenchuanLiliZhao/pm-all-in-one/releases) on this repo.

- Primary artifacts: macOS **DMG** and/or **zip** (installable `.app`)
- Not the primary path: source tarball, `npm` package, Homebrew, App Store

Current builds may be **unsigned / not notarized**. Gatekeeper may block open until Developer ID signing + notarization land (tracked for the trusted `v1.0.0` release). Prefer the latest Release labeled for your use; treat prereleases as packaging smoke unless notes say otherwise.

## Develop

```sh
cd space/app
npm install
npm run dev   # Electron window — not the bare Vite tab
```

## Package

See [docs/releasing.md](docs/releasing.md). Short form:

```sh
cd space/app
npm install
npm run package:mac
```

Artifacts land in `space/app/release/` (DMG + zip). Upload those to the matching GitHub Release tag.

## Names

| Surface | Value |
| --- | --- |
| Display | pm all in one |
| Repo / slug | `pm-all-in-one` |
| CLI | `local-pm` |
