Run `npm run build:cli`, then publish `dist-cli/` so a clean machine can
`npx pm-all-in-one --help` without the desktop app or the source tree.

## Done when

- Package is on the public registry at the decided name and version
- From a temp directory with only Node: `npx pm-all-in-one --help` succeeds
- Publish steps (login, access, dry-run) are recorded for the release checklist

## Resolution (2026-08-11)

- Published **`pm-all-in-one@0.1.0`** (public) to https://www.npmjs.com/package/pm-all-in-one
- Auth: granular access token (bypass 2FA). Interactive OTP is easy to rate-limit — prefer the token for publish.
- Bare `local-pm` rejected by registry similarity to `local-pkg`; see @issue-blwwMj6xHRYLCWXfa9wwl::8WElX16MO6Jdmib9u_r57

Standing technical doc: @wiki-MEJy28mhBISjYTGCr8IIo
