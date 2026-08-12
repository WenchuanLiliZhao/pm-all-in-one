Minimal brand surface so people can **find it and want to download**. Not a large marketing campaign.

## Open questions resolved

| Question | Decision |
| --- | --- |
| Do we need storytelling | **Yes, minimal**: GitHub README + Release notes explain pm-all-in-one, local-file SoT, and who it’s for |
| Do we need GitHub.io | **Yes, but not in v0**: a Download-button landing page promises zero friction, so it waits for a signed build — moved to @issue-blwwMj6xHRYLCWXfa9wwl::s3ooz65doturFfX2sBPbd |
| Illustration system | **No**: use screenshots when visuals are needed; no new task |

## Scope

- Consistent naming: product **`pm-all-in-one`** (display, CLI, npm, repo slug), `appId` **`com.pm-all-in-one.desktop`**; **`local-pm`** is workspace format only
- README narrative and Release notes
- Thin field-scenario stories(self-dogfood fully public)— not a case site

The audience here is a developer reading the repo, not a stranger reading a landing page. Voice should assume the reader can build from source and will accept an unsigned `0.x` download if told plainly what it costs.

## Done when

An outsider opening the repo can understand what it is in about a minute, reach the latest Release, and know before downloading what will happen on first open.
