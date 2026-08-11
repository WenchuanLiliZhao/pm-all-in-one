---
aliases:
  - UI Lab
  - lab
updated: 2026-08-04
description: >-
  DEV-only design harness for real pm UI primitives and self-contained
  global-styles; not a product channel.
---

# `src/lab/`

DEV-only **design-system debugging surface**. Open via **Dev → UI Lab**, `Cmd/Ctrl+Shift+D`, or Welcome. Route prefix: `#/lab/*`.

**Not** a product channel (Welcome / workspace). Independent layout (sidebar + pages); still under `AppChrome` for Toast/Electron shell, but Lab must not depend on workspace data.

## Hard rules

1. **Real components only.** Lab pages import from `@/components/ui/*` (or other shared modules the product also uses). No lab-only skins, no bare `<button>` / `<input>` presented as “the component.”
2. **Foundations exception:** the Tokens page visualizes `src/global-styles/` CSS variables — not a component, but must read the **same** tokens the app loads.
3. **One component → one route.** Register in [`nav.ts`](nav.ts) and `App.tsx` children together.
4. **Designer extraction workflow:** see a issue in the real Electron product → extract a shareable primitive under `components/ui/` → add lab route + state matrix → switch product call sites to the shared component. Done when product and lab import the same module.
5. **Global styles:** self-contained under [`src/global-styles/`](../global-styles/) (`0-index.scss` + token partials). Do not resurrect old button/input global element rules; do not `@forward` outside this app.

## Layout

| Path | Role |
| --- | --- |
| `layout.tsx` | Sidebar + `<Outlet />` |
| `nav.ts` | Catalog SoT |
| `pages/*` | Per-route matrices (Page width under Foundations) |
| `AGENTS.md` | This file |

## Out of scope

Business shells (wiki-shell, hierarchy-tree, terminal), workspace/IPC mocks, npm publishing a ui package this slice.
