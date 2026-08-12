## What to do

After the product display-name unification (@issue-blwwMj6xHRYLCWXfa9wwl::sGbl0oas6bGRhpUFdl7CH), **re-check every publishable surface**, then cut one aligned ship (`0.1.2` or next free `0.x`) so GitHub Release + npm match the living tree. Treat this README as the **execution plan**.

Public flip (@issue-blwwMj6xHRYLCWXfa9wwl::n8kGex5AN2Ah6IDzefuDV) must not point strangers at pre-rename artifacts.

## Snapshot (2026-08-12) — current published vs tree

| Surface | Live published | Tree / law now | Gap |
| --- | --- | --- | --- |
| Product name law | — | Single name **`pm-all-in-one`** (display, CLI, npm, repo, `.app`); `appId` `com.pm-all-in-one.desktop`; `local-pm` = workspace category only | Docs in tree updated; remote may lag until push |
| `app/package.json` | — | `version` **`0.1.1`**, `productName` **`pm-all-in-one`** | Version still equals last ship; need bump before republish |
| GitHub Release app | **`v0.1.1`** prerelease: assets `pm.all.in.one-0.1.1-arm64.dmg` + `…-mac.zip` (spaced-name era; electron-builder dotted the spaces) | Expect `pm-all-in-one-<ver>-arm64.dmg` / `-mac.zip` and bundle `pm-all-in-one.app` | **Stale — must rebuild + upload** |
| npm `pm-all-in-one` | **`0.1.1`** — package/bin name already correct; **description** still says spaced “pm all in one …” | Packager copy uses `pm-all-in-one` | Name OK; description stale → **republish with same version bump as app** |
| Repo visibility | **private** | Public is a later subtask | Does not block packaging; blocks outsider download |
| Product README / `docs/releasing.md` on remote | May still be pre-rename until commits land | Local tree already has Names + Channel for `pm-all-in-one` | **Commit + push** with the ship (not a third install artifact) |

Do **not** treat `v0.1.0` (BROKEN) or `v0.1.1` spaced-name builds as the public download once the repo opens.

## Agent plan — one subagent per surface

When executing this issue, **spawn separate subagents** (do not collapse into one pass). Each agent owns one row, returns evidence, then a coordinator decides the bump + ship.

### Subagent A — GitHub Release artifacts
- Confirm latest Release tag, prerelease flag, asset **filenames**, and that notes still claim unsigned honestly.
- Diff asset names against current `productName` (`pm-all-in-one-…` vs `pm.all.in.one-…`).
- Verdict: rebuild required? yes/no + why.

### Subagent B — npm package
- `npm view pm-all-in-one` → version, description, bin.
- Compare to `app/scripts/build-cli-package.mjs` / emitted `dist-cli` expectations.
- Verdict: name OK? description stale? must publish on next bump?

### Subagent C — local ship inputs
- `app/package.json` `version` + `productName` + `appId`.
- Confirm releasing checklist still matches (`docs/releasing.md` Channel + Naming).
- Propose next version string (default **`0.1.2`** if `0.1.1` is taken on both npm and GitHub).

### Subagent D — remote docs consistency (after code is on `main`)
- Product README Get it / Names, Release template paths (`/Applications/pm-all-in-one.app`).
- Flag any remaining spaced display name on the **default branch** (historical issue bodies may keep then-name).

### Coordinator (human or lead agent)
1. Collect A–D verdicts.
2. Bump version once; `package:mac` → required packaged-workspace `doctor` smoke → upload **DMG + zip only** → `npm publish` same version → Release body from unsigned template.
3. Record results in sibling `updates.md`; do not hand-edit `created` / `updated`.

## Non-goals

- Do not flip the repo to public here (owned by @issue-blwwMj6xHRYLCWXfa9wwl::n8kGex5AN2Ah6IDzefuDV)
- Do not sign / notarize (v1)
- Do not rewrite product positioning copy

## Done when

- Fresh `0.x` Release assets use **`pm-all-in-one-…`** filenames and install as **`pm-all-in-one.app`**
- npm version matches that ship; description no longer uses the spaced display name
- Tag / `package.json` / npm / Release title agree
- `updates.md` records what was checked (per subagent) and what was published
