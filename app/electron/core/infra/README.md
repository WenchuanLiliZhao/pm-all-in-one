# `electron/core/infra/`

<!-- ↔ ../README.md — category map -->
<!-- ↔ ../desktop/esbuild-binary.ts — asar binary path (load order) -->

Load/transform plumbing used by domain writers: evaluate/write `props.ts`, generate `schema.d.ts`, system timestamps, and the single esbuild import site.

**Who may import:** Other core modules (domain / workspace). Prefer not to reach here from main/server directly.

| File | Role |
| --- | --- |
| `esbuild-runtime.ts` | Sole `import "esbuild"` (after desktop binary path) |
| `props-load.ts` | Evaluate/write `props.ts` via esbuild + zod |
| `schema-dts.ts` | Per-project `schema.d.ts` for agents |
| `timestamps.ts` | ISO-Z `created` / `updated` helpers |

**Load-bearing:** `esbuild-runtime.ts` must import `../desktop/esbuild-binary.js` **before** `esbuild` — do not reorder.
