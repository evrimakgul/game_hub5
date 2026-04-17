---
title: Current Objective And Roadmap
topic: project
kind: roadmap
status: active
updated: 2026-04-16
confidence: high
---

## Summary

The current branch objective is no longer broad combat stabilization, and `AA-01` is no longer the active blocker. The repo has already closed the major combat, power, item, knowledge, world-casting, and Artifact Appraisal passes, so the roadmap should now be read as "preserve the completed systems, then choose the next explicit follow-up without reopening closed foundations."

## Current State

- `AA-01` is now complete: inventory `Identify` grants or refreshes the current canonical item-card revision, appends linked history entries, and uses current-revision ownership for hidden bonus visibility.
- No new active implementation item is recorded in `project_tracking/tasks_todo.md`; the next queued follow-ups are the deferred list.
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
- Treat the deferred list as the next queue: `KNOW-V2-01`, `ITEM-VAL-01`, and `COMBAT-ACT-01` are the clearest remaining functional follow-ups.
- Treat the wiki as the place that reconciles roadmap intent against current implementation facts.
- Keep future work disciplined around explicit open items rather than restarting already-closed architecture debates.

## Key Decisions

- Current roadmap interpretation should prefer explicit "active" and "deferred" lists over stale earlier assumptions.
- Completed domains should be preserved, not reopened casually.
- The wiki should surface where `references/plan.md` and current implementation no longer line up.
- The wiki should also surface partial repo-doc drift when a current-state document lags live code or notes.
- Inventory `Identify` remains the intended user-facing `Artifact Appraisal` surface; AA does not need a second generic world-cast UI.

## Deferred / Open

- reconcile `references/project_objective.md` with the passive `Brute Defiance` behavior now reflected in code and `references/current_notes.md`
- `KNOW-V2-01` expand knowledge cards beyond character and item cards.
- `ITEM-VAL-01` persisted item value support.
- `COMBAT-ACT-01` timing and action-economy layer.
- `CHAR-APPAREL-01` humanoid-vs-none apparel baseline.
- `REPO-CLEANUP-01` remove temporary `python.ipynb` before final cleanup.

## Sources

- [references/plan.md](../../references/plan.md)
- [references/project_objective.md](../../references/project_objective.md)
- [references/current_notes.md](../../references/current_notes.md)
- [project_tracking/tasks_todo.md](../../project_tracking/tasks_todo.md)

## Raw

- [THREAD-3](../../raw/codex-threads/thread-3-019ce29e-55fb-70b1-913c-5307603ac0f6.md)
- [THREAD-4](../../raw/codex-threads/thread-4-019d567a-df4a-70b0-8e63-b2138fa9b337.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)

