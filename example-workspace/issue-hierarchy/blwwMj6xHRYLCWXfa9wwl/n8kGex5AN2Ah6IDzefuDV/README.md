Flip the product repo from **private → public**.

## What changed

This used to be gated on "the first trustworthy app Release is published," meaning signed and notarized. Under the v0 / v1 split that gate moved: v0 open-sources an **unsigned** developer build, and trust is v1 (@issue-blwwMj6xHRYLCWXfa9wwl::dLYoc_w6jEXAloJa5a5ve). So going public no longer waits on Apple enrollment.

What replaces it is a smaller, achievable gate: the public copy must be **honest and consistent**. An unsigned build is fine to open-source. An unsigned build presented as if it were a polished download is not.

## Gates

- @issue-blwwMj6xHRYLCWXfa9wwl::XcSxLCLtrFJJDr8F_7QJf — a Release with artifacts exists
- @issue-blwwMj6xHRYLCWXfa9wwl::fkH6ZVefM9NIkGZBpZIb- — README and Release notes state the unsigned status and how to open it
- @issue-blwwMj6xHRYLCWXfa9wwl::sGbl0oas6bGRhpUFdl7CH — one product name across README, bundle, appId, and artifact filenames

## Done when

- Repo is public
- README, license, and Release notes are fit for an open-source landing, with no vault-private content
- Existing prerelease artifacts built under the old `Local PM` name are either removed or clearly marked as pre-rename history
- Source clone / build stays documented as the friction-free path; the Release download is the convenience path, not a trust claim
