Close-out for v0: ship the product from a **dedicated GitHub repository** rather than the private vault monorepo, then open-source it.

macOS trust (signing, notarization, version lock) used to live here. It moved to @issue-blwwMj6xHRYLCWXfa9wwl::dLYoc_w6jEXAloJa5a5ve under v1 when the campaign split into v0 / v1, because none of it is required to open-source an unsigned developer build.

## Chain (hard order)

1. Create the private product repo — @issue-blwwMj6xHRYLCWXfa9wwl::FODeeUBGWNGIN0vOy6E6c
2. Publish the app on GitHub Releases — @issue-blwwMj6xHRYLCWXfa9wwl::XcSxLCLtrFJJDr8F_7QJf, blocked by (1)
3. Flip the repo to public — @issue-blwwMj6xHRYLCWXfa9wwl::n8kGex5AN2Ah6IDzefuDV, blocked by (2) plus the honest unsigned notice and naming consistency

The dogfood library’s private remote is @issue-blwwMj6xHRYLCWXfa9wwl::xGKn6_1_MdrSQBnOioXaE (full live tree). Public evidence is an in-tree filtered snapshot at `pm-all-in-one/example-workspace/` (@issue-blwwMj6xHRYLCWXfa9wwl::2Xisr2bjeK2nTNzsiIQJ5) — copy/filter from the live tree, not a second live SoT and not a separate example repo.

## Progress (2026-08-11)

- Private repo exists: `WenchuanLiliZhao/pm-all-in-one`, `main`, product tree imported without `node_modules` or build output.
- First Release published: `v0.1.0`, marked prerelease, carrying arm64 DMG + zip. Unsigned. It exists to prove the channel, not as the public download.
- Packaging is reproducible from a clean checkout; steps are written down in `docs/releasing.md` in the product repo.
- Known gap in those artifacts: they were built before the naming fix, so they carry the old `Local PM` bundle name. Do not reuse them as the public download once the repo is public.

## Done when

- The product repo is the source of distribution truth, and packaging / CI target it
- A Release carries installable macOS artifacts with honest labelling
- The repo is public, deliberately, with nothing in it claiming trust the build does not have
