The v0.1.0 pre-release on GitHub Releases is unusable: the packaged app opens a
window but cannot open **any** workspace. This is strictly worse than shipping
nothing — "unsigned" only makes installation awkward, whereas this makes the
app do nothing after installation. It is also not a signing or Gatekeeper
problem, and a locally built `.app` from the same config reproduces it, so
clearing quarantine does not help.

```text
Error occurred in handler for 'pm:restoreWorkspace': Error: spawn ENOTDIR
  at ensureServiceIsRunning (…/app.asar/node_modules/esbuild/lib/main.js:2268)
  at evaluatePropsExport (…/app.asar/dist-electron/core/props-load.js:130)
  at readMemberMeta → ensureMembers → openWorkspaceAt (main.js:186)
```

## Root cause

`core/props-load.ts` evaluates every `props.ts` through esbuild, and esbuild
works by spawning a platform executable. In a packaged build that executable
resolves to a path inside `app.asar`, which is an archive rather than a
directory, so `spawn` fails with `ENOTDIR`. `openWorkspaceAt` calls
`ensureMembers`, which reads a member `props.ts`, so the very first step of
opening a workspace trips it and the failure is total rather than partial.
`npm run dev` never shows it because there `node_modules` is a real directory.

The deeper lesson is about QA surface, not about esbuild: nothing in the
release path ever opened a workspace inside a packaged build. Launching the app
and seeing a window was treated as a successful packaging smoke.

## Done when

- Assets on Releases come from a build where opening a workspace works end to end
- The broken v0.1.0 DMG / zip are no longer downloadable
- The release checklist has a step that would have caught this — open a real
  workspace in the packaged app, not just launch it — see
  @issue-blwwMj6xHRYLCWXfa9wwl::PiVgiRaImyBMxsIb7o5EH
- Cold-path install smoke can actually pass on a clean machine:
  @issue-blwwMj6xHRYLCWXfa9wwl::PZI5d8Hi70vYv2ZQZF9YA

## Non-goals

- Signing / notarization — that is v1, @issue-blwwMj6xHRYLCWXfa9wwl::dLYoc_w6jEXAloJa5a5ve
- Replacing esbuild as the `props.ts` evaluator
- Auto-update
