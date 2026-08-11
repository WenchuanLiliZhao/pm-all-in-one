---
aliases:
  - save dirty clarity
  - save button contrast
updated: 2026-08-06
description: >-
  Save 脏/净视觉；save/leave 合同见 save-leave-contracts。
topic: save-dirty-clarity
---

# Handoff: Save 脏/净视觉

↔ [[save-leave-contracts|save-leave-contracts]] — AutosaveDoc vs ExplicitForm leave law  
↔ `space/app/src/components/doc-edit-shell/save-status.tsx` — shared AutosaveDoc status

## Outcome

- AutosaveDoc hosts use shared `SaveStatusIndicator` (wiki / member) or local equivalents (issue / project / home — still duplicated until a follow-up extract).
- ExplicitForm (custom-props) keeps its own Save button + leave Stay/Discard.
- Cmd+S via `active-save-host` registry.

## Surfaces

| Surface | Notes |
| --- | --- |
| issue / project / workspace-home | AutosaveDoc; local SaveStatusLabel ×3 still |
| wiki / member | AutosaveDoc; `SaveStatusIndicator`; no Save button |
| Settings General | AutosaveDoc title; thin hint + Save still |
| custom-props | ExplicitForm; `dirty` bool；文案 `Save props` / `Save` |

## Do not

- 不要为「白字 + 任意底色」新增 Button variant。
- 不要改 `DetailSaveController` / `PmApi` 只为视觉。
- 不要发明第三种 leave 政策 — 见 [[save-leave-contracts|save-leave-contracts]]。
