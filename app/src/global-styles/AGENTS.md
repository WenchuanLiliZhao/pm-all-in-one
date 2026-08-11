---
aliases:
  - global-styles
  - color-use
updated: 2026-07-31
description: >-
  Self-contained app stylesheet — color SoT is --color-use--*; palette
  --color--* is for color-use only; spacing/layout SoT is --space--* /
  --layout--*.
---

# `src/global-styles/`

App-owned global stylesheet. Entry: [`0-index.scss`](0-index.scss) imported from [`main.tsx`](../main.tsx).

## Rules

1. **Color SoT:** UI chrome colors use `--color-use--*` only. Primitives live in [`color.scss`](color.scss) as `--color--*`; component/page SCSS must not hardcode slate/Tailwind hex or invent `--pm-*`.
2. **Themes:** Every new `--color-use--*` must be defined in all four blocks in [`color-use.scss`](color-use.scss) (light, dark, auto-light, auto-dark). Prefer referencing `--color--*`.
3. **Status / accent:** Destructive / banner error → `--color-use--danger*`; warnings → `--warn*`; positive / drop-ok / save-ok → `--success*`; links / guides → `--accent*`.
4. **Other foundations:** fonts → [`font.scss`](font.scss); shadows → [`shadow.scss`](shadow.scss); icons → [`icon.scss`](icon.scss) (`--icon-stroke-width`); z-index → [`z-index.scss`](z-index.scss); **spacing** → [`space.scss`](space.scss) (`--space--*`); **shell geometry** → [`layout.scss`](layout.scss) (`--layout--*`); **cross-parent seams** → [`seams.md`](seams.md). Component visuals live in CSS modules + these tokens — do not restore global `button` / `input` element skins.
5. **Exceptions (allowed):** (a) roadmap bar fills via inline `style` using status-mapped `--color-use--*` (same tokens as status icons); (b) `shadow.scss` rgba; (c) Electron `BrowserWindow` `backgroundColor` hex. Terminal chrome uses `--color-use--terminal-*` (follows app theme).
6. **Lab:** Tokens page may sample `--color--*`, `--color-use--*` (including status), `--space--*`, and `--layout--*`.
