---
title: Current Objective And Roadmap
topic: project
kind: roadmap
status: active
updated: 2026-04-16
confidence: high
---

## Summary

The current branch objective is no longer broad combat stabilization. The repo has already closed the major combat/power/item passes and now carries a narrower active task list. The roadmap should be read as "preserve the completed systems, finish the explicit remaining work, and avoid drift."

## Current State

- The latest active TODO is `AA-01`: complete full `Artifact Appraisal` integration on top of the live item-card flow.
- Recent completed milestone groups include:
  - cast UI standardization
  - aura lifecycle cleanup
  - item multi-slot and hand-state cleanup
  - supplementary-slot and item knowledge UX
  - World Casting V1
- `references/current_notes.md` records successful validation for `typecheck`, `test`, and `build` at the end of the latest major pass.
- `references/plan.md` is still the authoritative roadmap document even though many previously unfinished items are now complete in code.
- `references/project_objective.md` is no longer fully aligned with current implementation; it still mentions the older manual `Brute Defiance` trigger while current code/notes record the passive version.

## Intended Direction

- Start future implementation from the earliest unfinished item in `references/plan.md`, but verify against `references/current_notes.md` and live code first because the plan can lag reality.
- Treat the wiki as the place that reconciles roadmap intent against current implementation facts.
- Keep future work disciplined around explicit open items rather than restarting already-closed architecture debates.

## Key Decisions

- Current roadmap interpretation should prefer explicit "active" and "deferred" lists over stale earlier assumptions.
- Completed domains should be preserved, not reopened casually.
- The wiki should surface where `references/plan.md` and current implementation no longer line up.
- The wiki should also surface partial repo-doc drift when a current-state document lags live code or notes.
- `AA-01` is the clearest currently active functional follow-up.

## Deferred / Open

- `AA-01` full `Artifact Appraisal` integration.
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

