## What to do

Choose and document the single external distribution entry point: **Releases** on a given GitHub repo, with installable **macOS DMG / zip** artifacts (not a source tarball, not an `npm` package).

## Why

v0 “shipped” means users can download **software**. If the carrier isn’t nailed first, signing, notarization, versioning, and the landing-page Download link all float and point different places.

## Non-goals

- Homebrew / App Store / self-hosted CDN are not the v0 entry
- No Windows / Linux packages

## Done when

- External docs (README or release notes) state: **sole download entry** = GitHub Releases on the designated repo
- Artifact shape is agreed: macOS **DMG and/or zip** (installable app); source packages explicitly excluded as the primary download
- The repo meets prerequisites for public Releases (visibility / permissions allow outsiders to download)
