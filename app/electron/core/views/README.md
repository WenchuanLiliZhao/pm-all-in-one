# `electron/core/views/`

<!-- ↔ ../README.md — category map -->

Custom views and sparse drag-order persistence under `.pm/`.

**Who may import:** Electron main + server for persist modules; renderer may import pure `view-order-apply` via `@pm-core/views/view-order-apply`.

| File | Role |
| --- | --- |
| `views.ts` | `.pm/views.json` custom views |
| `view-orders.ts` | `.pm/view-orders.json` sparse orders |
| `view-order-apply.ts` | Pure apply over title-sorted tree |

Note: the category folder is named `views/`; the persist module is `views/views.ts` — import `@pm-core/views/view-order-apply` or `./views/views.js`, never a bare `core/views.js`.
