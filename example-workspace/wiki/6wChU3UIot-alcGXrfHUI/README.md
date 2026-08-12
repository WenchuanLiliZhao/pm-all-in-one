Workspace chrome uses two surface names. Use them in product talk and dogfood; do not invent a third shell word for the same slots.

Inside **article page**, say **node page** when the surface is a full-page view of a disk node — not Home / settings chrome.

## Article page

A **full main-column** editing surface. The body fills the page; chrome is page-level (title, Save, status). Leaving usually means **route navigation**.

### Sticky nav (shared `DocEditNav`)

Every article page and detail panel pins an internal nav at the top of the scroll column (`DocEditShell` header). The bar is **full view width** (WikiShell main / detail aside), not the reading-column max-width; it stays put when sticky engages (no pad snap).

| Surface | Left | Right |
| --- | --- | --- |
| **Node page** (wiki / member / handoff) | Click-to-copy locator (`@wiki-…` / `@member-…` / `@handoff-…`) — ellipsis when compressed | Icon-only: **Save**; wiki also **···** → Delete (icon+label in menu) |
| **Other article** (Overview, …) | Channel title (e.g. Overview) | Icon-only **Save** (no Delete / no ··· when there is nothing to overflow) |
| **Detail panel** (issue / project) | Click-to-copy locator (`@issue-…`; project = bare id) | Icon-only: Settings (project), Save, Add epic (project), **···** (issue: Add child; Delete), Close |

Overflow (`DocEditOverflowMenu`): issue Add child + Delete today; more low-frequency actions go in the menu later (see code comment). Menu rows stay icon + label.

Implementation: `app/src/components/doc-edit-shell/doc-edit-nav.tsx`, `doc-edit-overflow-menu.tsx`, `locator-copy-text.tsx`.

### Node page

A node page is an article page that edits one **node** (its own directory on disk) in the main column.

**Today**

- Wiki — `wiki/<id>/`, `@wiki-<id>`, must sit in Contents (`wiki/sidebar.ts`)
- Member — `members/<id>/`, `@member-<id>`
- Handoff — `handoffs/<id>/`, `@handoff-<id>`

**Future**

If **issue** (or project) gains a **full-page** route — not only the side panel — that surface is also a **node page**. It does **not** stay a detail panel just because issues used to open in a panel.

Prefer **node page** over bare “article page” when the subject is a concrete node.

### Other article pages

Same shell chrome, **not** a node directory:

- Workspace Home / Overview (`README.md` at workspace root)
- Settings sections that own the main column (e.g. workspace title)

Do not call these node pages. Standing topic truth still belongs in wiki node pages, not only on Home.

## Detail panel

A **panel** beside or over the current view for a selected project or issue. Same ExplicitDoc save rules as article pages, but the leave path is often **panel switch / close**, not only a route change.

**Today**

- Issue detail
- Project detail

When a full-page issue (or project) view ships, call that a **node page**; keep **detail panel** for the side/overlay chrome.

## Same save family, different chrome

Article pages (including node pages) and detail panels are ExplicitDoc hosts — Save / Cmd+S / leave Save·Discard·Cancel. The split is **where they live in the shell**, not a second leave policy.

Standing save/leave law: @wiki-n8_7zg25NlxwdV6nIBVcD

## Not this axis

| Axis | Examples |
| --- | --- |
| Shell chrome | article page / detail panel |
| Node page vs not | wiki / member / handoff (/ future issue full page) vs Home / settings |
| Disk node kind | `project` / `issue` / `wiki` / `member` / `handoff` |
| Save contract family | ExplicitDoc vs ExplicitForm (custom props) |

Nodes disk pattern: @wiki-WZ_eBxLpaAG_HYKecNZeW
