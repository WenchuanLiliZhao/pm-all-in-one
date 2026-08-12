Publish this live dogfood library (**new-world**) as **my private personal workspace** to a dedicated GitHub repository (not the product app repo).

This is a **backup / personal remote** for the real working tree — separate from the in-tree product example snapshot (@issue-blwwMj6xHRYLCWXfa9wwl::2Xisr2bjeK2nTNzsiIQJ5 → `pm-all-in-one/example-workspace/`), which publishes only pm-all-in-one–related dogfood.

## Boundaries

**In**
- One private repo whose content is (or mirrors) this workspace
- Remote set up so day-to-day dogfood can push / pull
- Keep `.pm/local.json` and other machine-local files gitignored

**Out**
- Not the product source repo (@issue-blwwMj6xHRYLCWXfa9wwl::FODeeUBGWNGIN0vOy6E6c)
- Not the in-tree example snapshot (sibling subtask → `example-workspace/`)
- Not scrubbing for strangers — privacy is the repo visibility

## Done when

- A private GitHub repo exists and holds this workspace (or an intentional sync of it)
- Clone / push path is documented for me
- Product README does not treat this private remote as the public evidence link

## Landed (2026-08-11)

- Private repo: https://github.com/WenchuanLiliZhao/new-world
- Git remote name on this working tree: `origin` → `https://github.com/WenchuanLiliZhao/new-world.git`
- Day-to-day: `git pull` / `git push` from the live workspace root (machine checkout path stays in `.pm/local.md`, not here)
- Product README (`pm-all-in-one`) does not link here as public dogfood evidence — that is `example-workspace/` in the product repo (@issue-blwwMj6xHRYLCWXfa9wwl::2Xisr2bjeK2nTNzsiIQJ5)
