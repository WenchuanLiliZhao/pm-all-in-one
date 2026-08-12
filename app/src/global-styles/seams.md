# Seams registry

Cross-parent spatial lines. Both implementing files carry a header `↔` comment pointing here.

| id | line | side A | side B | computed px | verdict | owner token |
| --- | --- | --- | --- | --- | --- | --- |
| `titlebar↔topbar` | left edge | `layout/electron-shell/styles.module.scss` · `.titlebar` | `pages/channels/workspace-page/styles.module.scss` · `.topbar` | A: 78 · B: 12 | legal-exception | `--layout--titlebar-traffic-inset` (A) / `--layout--topbar-pad-x` (B) — clears macOS traffic lights |
| `left-edge--topbar-page-banner` | content-column left edge | `.topbar` pad-x | `.tablePage` / wiki-shell PageWidth padded / `.strayBanner` | topbar: 12 · page+banner: 28 | page↔banner aligned; topbar vs page is chrome vs content | `--layout--page-pad-x` (page+banner); topbar stays `--layout--topbar-pad-x` |
| `rail↔mainBody` | wiki rail width vs main pad | `wiki-shell/styles.module.scss` · `.rail` | `ui/page-width` padded reading/full (WikiShell `.mainBodyFull` extras) | rail: 280 · main pad-x: 28 · reading max: 52rem | aligned | `--layout--wiki-rail-width` · `--layout--page-pad-x` · `--layout--content-max` |
| `rail-bleed↔cndt-wiki` | left-rail bleed model | pm `wiki-shell` · `.rail` + `.railNavRow`/`.tocRow` | cndt-wiki `layout-sidebar` + `SidebarTree` · `__item` | both: rail pad-x 0 · L 16 · wash full column · radius 0 · rail-w 280 · pad-y 16; **R: pm 8 / cndt 4**; Contents nest via `--toc-indent` on row pad-L (not `<li>`) | legal-exception on R | `--layout--wiki-rail-width` · `--space--16` (L + pad-y) · `--space--8` (pm R — air for Add / ···; cndt stays 4) · `--toc-indent` (Contents depth) |
| `rail-section-stack` | wiki rail section ↔ section / row density | `wiki-shell` · `.rail` gap + `.section` | `.sectionTitle`/`.sectionHeader` margin-bottom + `.railNavRow`/`.tocRow*` / `.tocList` | section↔section: 16 · chrome→rows: 4 · row↔row: 0 (pad-y owns density; was Workspace `.section` gap 4 stacking vs Contents `tocList` gap 0) | aligned | `--space--16` (rail gap) · `--space--4` (chrome margin) · `--space--8` (row pad-y) |
| `detail-prop-controls` | issue detail props strip control height | `issue-detail` Status/Priority/boolean Buttons | `MemberPersonSelect controlSize` · `Input size` · Created-by `MemberPerson` card | all: Button/Input **small** (22) | aligned | Button `size="small"` · Input `size="small"` · `controlSize="small"` · card `size="sm"` → chrome small |
| `detailHeader↔detail-body` | horizontal pad of detail chrome vs body | `doc-edit-shell` · `.chrome` | `.content` / panel `--doc-edit-content-pad-x` | chrome: 12 (topbar) · body: 12 panel / 28 article | chrome↔topbar aligned; body stays content pad | `--layout--topbar-pad-x` (chrome) · `--space--12` / `--layout--page-pad-x` (body) |
| `topbar↔doc-edit-chrome` | chrome pad-x vs universal nav | `workspace-page` · `.topbar` | `doc-edit-shell` · `.chrome` | both: 12 | aligned | `--layout--topbar-pad-x` |
| `row-family` | tree lead / overflow icon button | `ui/tree-row` · `.lead` · wiki-shell `.rowMenuBtn` · roadmap `.coarseRow` | hosts: hierarchy-outline `.stubRow`, wiki `.rowSelect`/`.tocRow`, issue-table cells | lead: 20 (was 22) | aligned | `--layout--tree-lead-size` |
| `rail-row↔section-chrome` | wiki left-rail content left/right inset | `wiki-shell` · `.railNavRow` / `.tocRow` / `.tocRowStatic` | `.sectionTitle` / `.sectionHeader` / `.emptyHint` / `.railError` | row+chrome: L 16 / R 8 (was R 4 — tight against Add / ···) | aligned | `--space--16` (L) · `--space--8` (R) |
| `rail-section-chrome-height` | wiki rail section label band height | `wiki-shell` · bare `.sectionTitle` (Workspace) | `wiki-shell` · `.sectionHeader` (Contents + Add) | both: min-height 24 (+ margin-below 4); was ~21.3 bare vs ~22 with Add | aligned | `--space--24` (band) · `--space--4` (margin-below) |
| `roadmap-label-rail` | roadmap label column width | `roadmap/styles.module.scss` · `.sheet` `--label-w` / `.corner` / `.labelRail` | TS `LABEL_W` (inline `--label-w`) | 280 | aligned | `--layout--roadmap-label-width` (CSS default; JS may set `--label-w`) |
| `roadmap-row-height` | roadmap track / label row height | `roadmap/styles.module.scss` · `.labelRow` / `.trackRow` | TS `ROW_H` (inline heights) | 36 | aligned | `--layout--roadmap-row-height` |
| `welcome↔not-found` | out-of-workspace page pad | `welcome-page` · `.root` | `not-found-page` · `.root` | both: 24 (was 1.5rem) | aligned | `--space--24` |

### Design prompt — `rail-row↔section-chrome`

Also documented on `ui/tree-row` + `wiki-shell` styles. TreeRow is pad-free (`.select` = 0); host hover wrappers own row pad **and** lead↔title `gap` so icon/title spacing stays consistent across sections; non-hover labels in the same rail must reuse that pad-x — do not pad/gap only the select `className` (select `gap` is kind↔title only). Bleed model: rail column pad-x 0; rows paint wash edge-to-edge with no radius; content inset is pad-L 16 / pad-R 8 (section title bar and items share the same R so Add and ··· align to one right edge). Contents nest depth adds to that pad-L via `--toc-indent` on `.tocRow*` — never `padding-left` on the `<li>`, or the wash shrinks with depth.

### Design prompt — `rail-section-stack`

Wiki left-rail vertical rhythm is one rule for every section (Workspace / Contents):

1. **Section ↔ section** — only `.rail` `gap` (`--space--16`). Do not add extra margin on `.section`.
2. **Chrome → first row** — only `.sectionTitle` / `.sectionHeader` `margin-bottom` (`--space--4`). Never also put a non-zero `.section` `gap` (that double-counts and made Workspace rows looser than Contents).
3. **Row ↔ row** — `.section` gap and `.tocList` gap stay `0`; density comes from shared row pad-y (`--space--8` on `.railNavRow` / `.tocRow*`).

Canonical DOM order: Workspace → Contents. Settings is a Workspace nav row (not its own section); keep new settings on that one page until it grows too long.
