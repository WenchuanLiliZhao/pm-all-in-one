Publish installable macOS artifacts to **GitHub Releases** on the product repo (DMG + zip).

Depends on the private product repo existing — @issue-blwwMj6xHRYLCWXfa9wwl::FODeeUBGWNGIN0vOy6E6c.

## Scope after the v0 / v1 split

This is the v0 version of "publish": get real artifacts onto the Releases page under a `0.x` tag, unsigned, honestly labelled. The signed `v1.0.0` story belongs to @issue-blwwMj6xHRYLCWXfa9wwl::dLYoc_w6jEXAloJa5a5ve under v1 and must not be claimed here.

## Progress

- **2026-08-11 (early):** `v0.1.0` published as a prerelease — channel proof only. Artifacts carried the old `Local PM` name and later proved unable to open any workspace (`spawn ENOTDIR`). That Release is labelled **BROKEN — do not download**; assets removed.
- **2026-08-11 (later):** `v0.1.1` published — bundle **`pm all in one.app`** (then-name; pre-rename), tag / `package.json` / in-app version agree on `0.1.1`, unsigned noted and marked prerelease. Packaged-workspace `doctor` smoke passed before upload. Fixes @issue-blwwMj6xHRYLCWXfa9wwl::ApZCFHYWEXalEXCaRDJJx.

Release: https://github.com/WenchuanLiliZhao/pm-all-in-one/releases/tag/v0.1.1

## Done when

- A Release on the product repo carries downloadable macOS artifacts
- Tag, `package.json` version, and in-app version agree
- Unsigned status is stated in the Release notes, and the Release is marked prerelease
- Artifacts carry the current product name (`pm-all-in-one`)
