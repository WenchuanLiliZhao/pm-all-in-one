## Why now

**pm-all-in-one** already carries daily dogfooding under Electron, and product management for the product itself lives in this workspace. The next step is to stop being a private tree: an outsider should be able to find the repo, understand what it is, and run it.

## Version rule

Epics are named `vN`. **`vN` ships only when this epic ends.** Semver follows that:

| Epic | Ends with release | Audience |
| --- | --- | --- |
| **v0 (this epic)** | unsigned `0.x` | developers who can clear quarantine or build from source |
| **v1 — @issue-blwwMj6xHRYLCWXfa9wwl::fSADO94-kHCGNxYFFe_10** | signed, notarized `1.0.0` | people who will not run a terminal command |

v0 must **not** claim Gatekeeper trust it has not earned. UI polish and product feature improvements live under v1 (draft until scheduled); v0 keeps only what is needed to open-source an honest developer preview.

## Scope

- `pm-all-in-one` reachable without the app, via npm — @issue-blwwMj6xHRYLCWXfa9wwl::7IqV4uCACewDyRFOpeFfP
- A working download channel with honest labelling — @issue-blwwMj6xHRYLCWXfa9wwl::-HzCzzYwR1WFqz7dOkK2u
- Minimal narrative: README, release notes, naming, dogfood story — @issue-blwwMj6xHRYLCWXfa9wwl::6ajhL_9NTJC6v7eE847sE
- Separate repos and the flip to public — @issue-blwwMj6xHRYLCWXfa9wwl::-p7Rkr1ks6rjrIk8LvqTV
- Prompt / template harness already landed under this epic (done)

## Non-goals (v0)

- Developer ID signing, notarization, Gatekeeper-clean cold open (v1)
- The `1.0.0` version lock (v1)
- A Download-button landing page aimed at non-developers (v1)
- UI/UX polish and non-blocking feature improvements (v1)
- Windows / Linux distribution, App Store, SaaS hosting
- Full illustration system

## Done when

1. The product repo is public, with a README an outsider can read in about a minute.
2. Releases carry installable macOS artifacts, each one **stating plainly** that the build is unsigned and how to open it.
3. Building and running from source works from a clean checkout, and is documented as the friction-free path.
4. `pm-all-in-one` is installable without the desktop app.
5. Nothing in the public copy claims Gatekeeper trust we have not earned.
6. Tag / package / in-app version agree on a `0.x` prerelease (not `1.0.0`).

## Verification

An outsider path, not a dev-machine path: clone fresh → `npm install` → `npm run dev` opens; separately, download the Release artifact, follow the documented open instructions, and confirm they actually work on a machine that has not trusted this app before. Cold-path evidence for a *trusted* download belongs to v1 and must not be claimed here.
