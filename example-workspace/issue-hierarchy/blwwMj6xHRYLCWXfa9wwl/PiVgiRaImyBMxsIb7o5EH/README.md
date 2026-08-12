## What to do

Write a checklist someone else (or future you) can follow: check out the repo → `package:mac` (or equivalent CI) → produce DMG/zip → attach to the matching GitHub Release. Minimize steps that require guessing.

## Why

Today there is only `npm run package:mac` on a developer machine — no external release process. If shipping relies on memory, version, signed artifacts, and changelog drift easily, and you can’t prove “repeatable delivery.”

## Non-goals

- Full auto CI is not required up front; a locally repeatable checklist is enough; CI is a bonus
- Don’t put how to obtain signing certificates in this subtask (that belongs under “product trust”)

## Done when

- There is a followable release checklist (steps, commands, artifact paths, which Release to upload to)
- Following it can produce DMG/zip from a clean checkout and attach to a Release (may cross-reference signing/notarization steps; don’t reinvent them)
- Checklist states which places version / tag / changelog must stay aligned, so “ship from memory” stops
