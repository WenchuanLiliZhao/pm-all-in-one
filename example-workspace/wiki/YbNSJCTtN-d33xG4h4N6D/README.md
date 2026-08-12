Each person's absolute checkout paths differ, so they must not enter git. This page is the **current truth** for where machine-local path notes live, and how that relates to the future product binding.

## Layers

| Layer | Where | Enters git? | Role |
| --- | --- | --- | --- |
| Shared identity (future) | `project.ts` `repos[].key` (+ optional remote / subpath hints) | Yes | "Which library" — same for everyone |
| Structured local paths (future) | `.pm/local.json` `repos` | No | App resolution for Open folder / terminals |
| AI path notes (now) | `.pm/local.md` | No | Natural-language map for agents and humans on this machine |
| Signing identity | `.pm/local.json` `me` | No | Who creates nodes on this machine — see @wiki-7j0Ak3N2wsnQodOSxSzZ9 |

## Soft convention (shipped)

- Write checkout locations in **`.pm/local.md`** when you have something useful to say. Do **not** seed an empty file at workspace create.
- The file is gitignored (template + open-time ensure). Never commit it.
- There is **no UI** for this file. Agents and editors read it from disk.
- It is **not** the app's resolution source of truth. When `project.repos` and the local path table land, the app will resolve via `key` → `.pm/local.json` `repos`; `local.md` may remain as prose alongside that table.

## Future product binding (decided, not shipped)

Commit **which library** (`project.ts` `repos[].key`, human-readable, unique in the workspace). Keep **where it is on this machine** only in `.pm/local.json` `repos` (gitignored). Optional git `remote` is a hint for claim / mismatch / discovery — not identity. No reverse `.pm-link` in code repos. Code may live inside or outside the PM library (user preference); never under `issue-hierarchy/`. Contract change (`types` / `PmApi` / disk law) is a separate vibe session from UI.

## Do not

- Do not put machine-absolute paths in `members/*/README.md` or any tracked body.
- Do not put absolute paths in `project.ts`, wiki, issues, or Home.
- Do not treat `local.md` as something the Electron app parses for Open folder / PTY cwd.

## Related

- Browser chrome prefs (also machine-local, different store): @wiki-5FG_8PUrpU4edQeivzJcx
- Members / `me`: @wiki-7j0Ak3N2wsnQodOSxSzZ9
