---
aliases:
  - global-styles
  - color-use
  - color-use-vscode
  - vscode-theme
  - cursor-theme
updated: 2026-09-18
description: >-
  Self-contained app stylesheet — color SoT is --color-use--*; palette
  --color--* is for color-use only; vscode host remaps --color-use--* to
  --vscode-* in color-use-vscode.scss; spacing/layout SoT is --space--* /
  --layout--*.
---

# `src/global-styles/`

App-owned global stylesheet. Entry: [`0-index.scss`](0-index.scss) imported from [`main.tsx`](../main.tsx).

## Rules

1. **Color SoT:** UI chrome colors use `--color-use--*` only. Primitives live in [`color.scss`](color.scss) as `--color--*`; component/page SCSS must not hardcode slate/Tailwind hex or invent `--pm-*`.
2. **vscode / Cursor host:** [`color-use-vscode.scss`](color-use-vscode.scss) remaps `--color-use--*` to `--vscode-*` when `html[data-pm-host="vscode"]`. Components must **not** use `--vscode-*`. Do **not** remap `--color--*` primitives (VS Code has chrome colors, not this gray ramp). Electron never sets `data-pm-host`. Early boot: `extension/src/webview-html.ts` + `extension/media/vscode-pm.js`. JS that caches colors: [`src/lib/host-theme.ts`](../lib/host-theme.ts).
3. **Themes:** Every new `--color-use--*` must be defined in all four blocks in [`color-use.scss`](color-use.scss) (light, dark, auto-light, auto-dark) **and** in the vscode adapter table. Prefer referencing `--color--*` in the product blocks.
4. **Status / accent:** Destructive / banner error → `--color-use--danger*`; warnings → `--warn*`; positive / drop-ok / save-ok → `--success*`; links / guides → `--accent*`.
5. **Other foundations:** fonts → [`font.scss`](font.scss); shadows → [`shadow.scss`](shadow.scss); icons → [`icon.scss`](icon.scss) (`--icon-stroke-width`); z-index → [`z-index.scss`](z-index.scss); **spacing** → [`space.scss`](space.scss) (`--space--*`); **shell geometry** → [`layout.scss`](layout.scss) (`--layout--*`); **cross-parent seams** → [`seams.md`](seams.md). Component visuals live in CSS modules + these tokens — do not restore global `button` / `input` element skins.
6. **Exceptions (allowed):** (a) roadmap bar fills via inline `style` using status-mapped `--color-use--*` (same tokens as status icons); (b) `shadow.scss` rgba (VS Code has no shadow-stack tokens — still black rgba, light vs dark via `data-theme`); (c) Electron `BrowserWindow` `backgroundColor` hex. Terminal chrome uses `--color-use--terminal-*` (follows app theme in Electron; vscode host maps them to `terminal.*` / `tab.*` / `panel.*`).
7. **Lab:** Tokens page may sample `--color--*`, `--color-use--*` (including status), `--space--*`, and `--layout--*`. On the vscode host the live `--color-use--*` chips are IDE-mapped.
