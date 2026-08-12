Parent: @issue-blwwMj6xHRYLCWXfa9wwl::-p7Rkr1ks6rjrIk8LvqTV

This subtask is **only a log**. Use it for small product-repo changes that do not deserve their own issue — naming tweaks, docs, template polish, drive-by fixes landed on `v0`. Do not turn it into a second backlog; if something needs its own done criteria, open a real sibling instead.

Product-repo pointer (temporary): `docs/v0-misc-log.md` in `WenchuanLiliZhao/pm-all-in-one` on branch `v0`. Agents and humans landing misc work there should append a short dated note here (or under `## Log` below) and keep the pointer accurate.

## When this closes

1. Delete the pointer file `docs/v0-misc-log.md` from the product repo.
2. Remove its row from the product repo root `README.md` Docs table (if still present).
3. Then mark this issue `done`.

Do not leave the pointer after the catch-all is finished — the whole point of the pointer is that it is temporary.

## Log

- 2026-08-11 — Issue created; pointer added in product repo.
- 2026-08-11 — Pause MarkdownEditor Live/Source/Preview switching: UI always Live; keep `defaultMode` / `MarkdownEditorMode` / `variant` props. Product docs pointer: `docs/v0-misc-log.md`.
- 2026-08-12 — CLI `parseArgs` treated nanoid values that start with `-` as options (`--parent -p7Rkr1…` failed). Fixed via `electron/cli-args.ts` value-flag parsing + tests; `--parent=-id` still works.
