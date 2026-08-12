## What to do

Make the unsigned state explicit everywhere a stranger can download the app: repo README, every Release's notes, and the packaging doc. State what happens on first open, give the exact command to clear quarantine, and offer building from source as the friction-free alternative.

## Why

The artifacts we ship today are unsigned. On Apple Silicon macOS reports an unsigned downloaded app as **damaged**, not as unsigned — so a user with no warning concludes the software is broken and leaves. Saying it up front converts a bug report into an informed choice.

It also protects the trust narrative. This app embeds a terminal and reads the user's whole workspace directory. Telling people to strip a macOS protection from that binary is a real ask; it should be stated plainly, with the reason and the alternative, not buried.

## Scope

- README: a status section saying builds are unsigned, who this stage is for, the `xattr -dr com.apple.quarantine` step, and the build-from-source path
- Release notes template: same warning on every unsigned Release, marked as prerelease so GitHub does not surface it as Latest
- `docs/releasing.md`: the unsigned smoke procedure and the rule that unsigned Releases must carry the notice

## Non-goals

- Do not teach the right-click bypass as the official route; it no longer works on current macOS anyway
- Do not fix the underlying problem here — signing is @issue-blwwMj6xHRYLCWXfa9wwl::XO6LXu93_KMVTOi3b7VBx
- Do not add a Download button aimed at non-developers while this state holds

## Done when

- README states the unsigned status, the open instructions, and the source-build alternative
- Every published Release carries the notice and is marked prerelease
- A reader who has never seen this project can predict what will happen on first open, before downloading
