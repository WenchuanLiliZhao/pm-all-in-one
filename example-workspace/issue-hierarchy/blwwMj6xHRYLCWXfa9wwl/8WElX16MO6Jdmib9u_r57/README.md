Bare name `local-pm` cannot be published: npm returns 403 because it is too similar to existing package `local-pkg`. Scoped `@wenchuanlilizhao/local-pm` works but makes `npx` too long for the cold path.

**Chosen name:** bare `pm-all-in-one` — package name and CLI `bin` are the same string. Cold path is `npx pm-all-in-one …`.

## Done when

- Chosen name is written down and usable for `npm publish`
- If scoped, the scope owner and public access policy are decided
- `build:cli` emits that name in `dist-cli/package.json`

## Resolution (2026-08-11)

- Name: `pm-all-in-one` (bare)
- Scope: n/a
- `build:cli` PACKAGE_NAME / bin updated accordingly

Standing technical doc: @wiki-MEJy28mhBISjYTGCr8IIo
