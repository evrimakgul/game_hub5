---
title: Current Objective And Roadmap
topic: project
kind: roadmap
status: active
updated: 2026-04-24
confidence: high
---

## Summary

The current branch objective is no longer broad combat stabilization, and the repo has now closed the DM/player auction split, player combat-view gap, and live DM/player session layer. The next planned follow-up is `VIEW-PERSONALIZATION-01`: safe personalized page design for player and DM views.

## Current State

- `AA-01` is now complete: inventory `Identify` grants or refreshes the current canonical item-card revision, appends linked history entries, and uses current-revision ownership for hidden bonus visibility.
- `KNOW-V2-01` is now complete: knowledge cards now support DM-authored `place`, `faction`, `story`, and `custom` subjects through `/dm/knowledge`.
- `ITEM-VAL-01` is now complete: shared items now persist `baseStrength`, computed `anchorValue`, and optional `anchorValueOverride`, with DM-only value authoring/display.
- `UNARMORED-BASELINE-01` is now complete: characters now persist `apparelMode: humanoid | none`, clothing/robes stay at `Initiative +2, DR +0`, and humanoid characters with no chest/body item now receive a separate `+3 Initiative` naked-state baseline.
- `AUTHORING-WORKSHOP-01` is now complete: DM tooling now includes standalone mob templates, reusable mob groups, portal templates with nested stages, a manual Codex import/export bridge, a new portal-first `portal_bundle` workflow on `/dm/portals`, explicit CR controls across mobs/groups/portals, and combat-dashboard export of saved groups or portal stages into encounter-owned mobs.
- `ITEM-AUTO-01`, `ITEM-CREATE-01`, and `AUCTION-HOUSE-01` are now complete: the repo now persists auction-house catalog entries, exposes `/dm/auction-house`, and lets DMs auto-create shared item drafts from auction rows while preserving raw bonus text as draft notes.
- `AUCTION-PLAYER-01` is now complete: player character sheets now link into `/player/auction-house`, completed `Bid` and `Buyout` actions spend character money, purchased items land in the buying character's `Items` section, and live auction stock now decrements until it reaches `0`.
- `COMBAT-PLAYER-01` is now complete: DM-started encounters now also expose `/player/combat`, player character sheets and the player hub now link into `Combat Mode` for participating characters, hidden opponents stay masked unless the viewing character owns `Assess Entity` knowledge for that target, and the active encounter persists locally so DM/player windows stay aligned.
- `REALTIME-SESSION-01` is now complete: optional Supabase Auth/session wiring now backs `/dm/screen` and `/player/session` with persistent events, secret rolls, limited sharing, card sharing, and reward packets.
- `VIEW-PERSONALIZATION-01` is now the planned next item: browser-local personalized page design with safe manual controls, page section registries, reversible presets, and auto-design recommendations.
- `COMBAT-ACT-01` is now intentionally parked at the very end of the project and may be skipped entirely unless priorities change.
- Recent completed milestone groups include:
  - cast UI standardization
  - aura lifecycle cleanup
  - item multi-slot and hand-state cleanup
  - supplementary-slot and item knowledge UX
  - World Casting V1
- `references/plan.md`, `references/current_notes.md`, and `project_tracking/tasks_todo.md` now all reflect the closed `AA-01` state.
- `references/current_notes.md` records successful validation for `typecheck`, `test`, and `build` at the end of the latest major pass.
- `references/project_objective.md` is no longer fully aligned with current implementation; it still mentions the older manual `Brute Defiance` trigger while current code/notes record the passive version.

## Intended Direction

- Start future implementation from the earliest unfinished item in `references/plan.md`, but verify against `references/current_notes.md` and live code first because the plan can lag reality.
- Treat the deferred list as a holding area, not an immediate queue. `COMBAT-ACT-01` should stay parked until the very end of the project and may never be taken.
- Treat full portal-run automation as later follow-up work, not as part of the just-completed authoring workshop pass.
- Treat the wiki as the place that reconciles roadmap intent against current implementation facts.
- Keep future work disciplined around explicit open items rather than restarting already-closed architecture debates.
- Treat personalization as constrained customization: safe tokens, registered sections, presets, and recommendations rather than arbitrary CSS/JS or unrestricted page building.

## Key Decisions

- Current roadmap interpretation should prefer explicit "active" and "deferred" lists over stale earlier assumptions.
- Completed domains should be preserved, not reopened casually.
- The wiki should surface where `references/plan.md` and current implementation no longer line up.
- The wiki should also surface partial repo-doc drift when a current-state document lags live code or notes.
- Inventory `Identify` remains the intended user-facing `Artifact Appraisal` surface; AA does not need a second generic world-cast UI.
- The current portal/mob AI workflow is explicitly manual import/export through Codex request packets, not a live website-to-LLM integration.

## Deferred / Open

- reconcile `references/project_objective.md` with the passive `Brute Defiance` behavior now reflected in code and `references/current_notes.md`
- structured parsing of auction-house bonus/effect text into real item mechanics instead of preserved draft-note text
- richer player-side auction behavior such as pending bids, timers, and delayed bid settlement
- richer player-side combat participation beyond the current own-turn action surface
- Supabase RLS policy verification against a real local/project Supabase environment
- email/display-name lookup for adding campaign members instead of user UUID entry
- `VIEW-PERSONALIZATION-01` safe player/DM page personalization, including ViewProfile persistence, manual controls, page layouts, presets, and auto-design recommendations.
- `COMBAT-ACT-01` timing and action-economy layer, explicitly deferred to the end and possibly out of scope.
- `PORTAL-RUNNER-01` full portal-run state, boss-clear reward automation, exit unlocking, and persistent run orchestration.
- `REPO-CLEANUP-01` remove temporary `python.ipynb` as the literal last cleanup step.

## Sources

- [references/plan.md](../../references/plan.md)
- [references/project_objective.md](../../references/project_objective.md)
- [references/current_notes.md](../../references/current_notes.md)
- [project_tracking/tasks_todo.md](../../project_tracking/tasks_todo.md)
- [src/routes/PlayerAuctionHousePage.tsx](../../src/routes/PlayerAuctionHousePage.tsx)
- [src/routes/PlayerCombatPage.tsx](../../src/routes/PlayerCombatPage.tsx)
- [src/routes/DmScreenPage.tsx](../../src/routes/DmScreenPage.tsx)
- [src/routes/PlayerSessionPage.tsx](../../src/routes/PlayerSessionPage.tsx)
- [wiki/domains/view-personalization.md](../domains/view-personalization.md)
- [wiki/domains/realtime-sessions.md](../domains/realtime-sessions.md)

## Raw

- [THREAD-3](../../raw/codex-threads/thread-3-019ce29e-55fb-70b1-913c-5307603ac0f6.md)
- [THREAD-4](../../raw/codex-threads/thread-4-019d567a-df4a-70b0-8e63-b2138fa9b337.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)
- [USER-AUCTION-PLAYER-2026-04-20](../../raw/user-approved/2026-04-20-player-auction-house-shopping.md)
- [USER-COMBAT-PLAYER-2026-04-20](../../raw/user-approved/2026-04-20-player-combat-mode.md)
- [USER-VIEW-PERSONALIZATION-2026-04-24](../../raw/user-approved/2026-04-24-view-personalization-roadmap.md)
- [USER-REALTIME-SESSION-2026-04-24](../../raw/user-approved/2026-04-24-realtime-dm-screen-session.md)

