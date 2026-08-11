---
aliases:
  - save leave contracts
  - AutosaveDoc ExplicitForm
updated: 2026-08-06
description: >-
  Two save/leave contracts — AutosaveDoc vs ExplicitForm. Do not invent a third.
topic: save-leave-contracts
---

# Save / leave contracts

↔ `space/app/src/lib/workspace/detail-save.ts` — AutosaveDoc controller  
↔ `space/app/src/lib/workspace/active-save-host.ts` — Cmd+S dispatch  
↔ [[save-dirty-clarity|save-dirty-clarity]] — Save button / status visuals

Same-looking pages must share one family. **Do not invent a third leave policy.**

| Contract | Feels like | Save | Cmd/Ctrl+S | Leave while dirty |
| --- | --- | --- | --- | --- |
| **AutosaveDoc** | Notion / Linear / Google Docs | Debounced autosave via `DetailSaveController` | Flush now (Retry on conflict) | Silent **flush-then-leave**. Block only when flush cannot complete (conflict / blank title / persist error). No “Discard?” dialog. |
| **ExplicitForm** | Admin schema / settings form | Human presses Save | Save now | **Warn** Stay / Discard (`confirmDangerous`). `beforeunload` when dirty. No silent discard. |

## Surface map

| Surface | Contract |
| --- | --- |
| Home / Issue / Project / Settings title | AutosaveDoc (`DetailSaveController` in workspace-context) |
| Wiki / Member | AutosaveDoc (local `DetailSaveController` + same policy; OCC on write) |
| Custom props | ExplicitForm |
| Roadmap dates / view-order | Out of scope (immediate writes) |

## Why not warn on AutosaveDoc

Plan A Decision 8: typed text is expected to already be safe. Discard dialogs fight autosave.
