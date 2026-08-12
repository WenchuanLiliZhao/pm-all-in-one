What users get from GitHub is an **installable macOS app**, not "clone the source and build it yourself."

In v0 that app is unsigned, so this task owns both halves of the download path: the mechanics (channel, repeatable packaging, artifacts) and the honesty (saying what will happen on first open). Making the download actually frictionless is v1 — @issue-blwwMj6xHRYLCWXfa9wwl::dLYoc_w6jEXAloJa5a5ve.

## Progress (2026-08-11)

- Channel settled and exercised: GitHub Releases on the product repo, DMG + zip artifacts. @issue-blwwMj6xHRYLCWXfa9wwl::ITBTuMzaaVtFiJBUdzNZ6
- Packaging checklist done: clean checkout → DMG/zip → Release upload, written in `docs/releasing.md`. @issue-blwwMj6xHRYLCWXfa9wwl::PiVgiRaImyBMxsIb7o5EH
- Measured cost worth remembering: the build is fast, the **upload** is the slow step — roughly 15 minutes for ~250 MB of artifacts.
- Honest unsigned notice done: README Status + Get it, every published Release (prerelease), and a copy-paste template in `docs/releasing.md`. @issue-blwwMj6xHRYLCWXfa9wwl::fkH6ZVefM9NIkGZBpZIb-

## Done when

- A clear distribution channel exists: GitHub repo + Releases with macOS DMG/zip
- Packaging → upload is repeatable from a clean checkout by someone following the checklist
- Every unsigned Release states its status and the steps to open it
- Building from source is documented as the path with no Gatekeeper friction

Cold-path proof for a *trusted* download is not part of this task; it belongs to @issue-blwwMj6xHRYLCWXfa9wwl::PZI5d8Hi70vYv2ZQZF9YA under v1.
