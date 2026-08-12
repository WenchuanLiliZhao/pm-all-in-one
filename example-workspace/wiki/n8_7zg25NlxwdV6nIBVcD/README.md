Editing surfaces in the app share one leave family. Same-looking surfaces must share it. Do not invent a second leave policy.

Shell chrome (**article page** / **node page** / **detail panel**): @wiki-6wChU3UIot-alcGXrfHUI — this page is save/leave law only.

## ExplicitDoc

Manual save for article pages and detail panels.

| Behavior | Rule |
| --- | --- |
| Save | Human presses **Save** or **Cmd/Ctrl+S** (`DetailSaveController.save()`). No debounce, no blur save, no navigation flush |
| Leave while dirty | Dialog: **Save** (persist then leave) / **Discard** (drop draft then leave) / **Cancel** (stay). Via `confirmUnsavedLeave` → `resolveUnsavedLeave` / `useUnsavedLeaveGuard` |
| Tab close | Browser `beforeunload` prompt when dirty (cannot offer three buttons) |

### Surfaces

**Article pages — node page**

- Wiki (title + body) — Contents / `@wiki-<id>` / `wiki/<id>/`
- Member (title, membership, README body)
- Handoff (title, fields, body)
- Future: issue (or project) **full-page** route, if shipped — still a node page, not a detail panel

**Article pages — other**

- Workspace Home (title + README body)
- Settings → workspace title

**Detail panels**

- Issue detail (today)
- Project detail (today)

Wiki / Member / Handoff each own a `DetailSaveController` instance with the same policy as Home/Issue/Project. Writes use OCC (`expected` baseline); external disk changes merge via three-way classify and surface as Conflict when needed.

Hub hosts (Home / Issue / Project) share one controller in `workspace-context`. Detail-panel switches call the same Save / Discard / Cancel helper before changing selection.

## ExplicitForm

Admin schema form — same leave dialog as ExplicitDoc.

| Behavior | Rule |
| --- | --- |
| Save | Human presses Save (or Cmd/Ctrl+S) |
| Leave while dirty | **Save** / **Discard** / **Cancel** (same `confirmUnsavedLeave`) |
| Tab close | Browser `beforeunload` prompt when dirty |

### Surfaces

- Project settings → Custom fields (`custom-props.ts` editor)

## Cmd/Ctrl+S

One window listener dispatches to the **active save host** (last mounted editor). Hosts register `save()`. PreventDefault so the browser “Save page” dialog does not win inside the app.

## Out of scope (not “dirty docs”)

Immediate writes that are not part of these contracts:

- Roadmap date edits
- View order / tree reorder
- “Who you are” local signing identity (`.pm/local.json`)

When a roadmap/table quick-edit targets the same issue that has an unsaved draft, the leave dialog runs first (Save / Discard / Cancel) before the immediate write.

## Why one leave family

Autosave is gone — typed text is **not** already safe. Leave must warn. Save on leave stays on the dialog; the toolbar Save and Cmd+S remain the normal persist paths.

## Related

- Article page / node page / detail panel: @wiki-6wChU3UIot-alcGXrfHUI
- Product charter: @wiki-6HxCNuSO6tZMP6Te6JRY5
- System vs custom props (schema editing is ExplicitForm): @wiki-mzvgnLTWniBW9NTCAOjC7
- Identity / membership fields on members: @wiki-7j0Ak3N2wsnQodOSxSzZ9

## Implementation index

- `app/src/lib/workspace/detail-save.ts` — dirty + explicit `save()`
- `app/src/lib/workspace/unsaved-leave.ts` — `resolveUnsavedLeave`
- `app/src/lib/workspace/use-unsaved-leave-guard.ts` — RR blocker + beforeunload
- `app/src/lib/bridge/pm-api.ts` — `confirmUnsavedLeave`
