Per-node optional `assets/` folder: binary and non-Markdown files that belong to that node. Disk pattern overview: @wiki-WZ_eBxLpaAG_HYKecNZeW.

## Disk

Every node may have a sibling folder (absent when empty):

```text
<node>/
├── <meta>.ts
├── README.md
└── assets?/          # files only; flat basenames
```

One bag — do not split `images/` vs `files/`. Directory name collisions are resolved at copy time (`diagram.png` → `diagram-2.png`).

## Cite in the body (SoT)

No `@asset-`. Paths are always **this node’s** relative `assets/<basename>` (no `../`, no other node’s folder).

| Intent | Markdown |
| --- | --- |
| Embed in reading flow (images) | `![one-line caption](assets/foo.png)` |
| Point at an attachment (PDF, zip, …) | `[one-line label](assets/foo.pdf)` |
| Belong only | Leave the README silent; the Assets panel lists the file |

Mis-writing `![](assets/x.pdf)` is allowed — the app degrades to an attachment card, not an error. Cross-node meaning uses `@wiki-…` / `@issue-…`; reuse a file by **copying** into each node’s `assets/`.

## Caption = alt (one slot)

The text in `[]` is both accessibility alt and visible caption — one short sentence. Inline Markdown (`**` / `*` / `~~` / `code` / links) renders in Live idle and Preview via a **string fragment** re-parse (CommonMark does not parse markup inside image alt). Important equations belong in the body; if `$` math arrives later, caption math hangs on that same fragment seam and does **not** share the body AST pipeline.

## App behaviour

- Live: whole `![]()` / asset link replaced when idle; caret reveals source.
- Images → `figure` + optional `figcaption`; non-images → small attachment card.
- Assets panel **Reveal** shows the folder in Finder / Explorer.
- Paste or drop files into the body → copy into this node’s `assets/` and insert `![](assets/…)` (images) or `[](assets/…)` (other files).
- Autocomplete (same menu as `@`): only when the caret is in `![](assets/<here>)` or `[](assets/<here>)`; picking a row inserts the **basename** only. Index is this node’s `listNodeAssets`.

## Do not

- Cross-directory or cross-node `assets/` URLs
- Invent `@asset-` locators
- Put library-wide binaries only on the workspace root and expect every node to deep-link them (copy into the node instead)
