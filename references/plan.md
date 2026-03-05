# Roadmap Reset v2 (Cleanup-First, Combat-First)

This roadmap is the active implementation source of truth for the current branch.

## Phase 0 - Documentation Cleanup
0.1 Archive prior roadmap and stale direction docs.
    - Move legacy roadmap to `retired_files/reference_archive/`.
    - Move old scope/wireframe docs to `retired_files/reference_archive/`.
0.2 Keep relevant references active and update stale notes.
    - Refresh outdated items in `references/state_vs_derived.md`.
0.3 Create one reference index that marks documents as `active` or `legacy`.

## Phase 1 - Combat Core + Scheduler
1.1 Define engine-owned combat runtime types.
    - `CombatState`, `CombatantProfile`, `TurnCursor`, `ActionBudget`, `CombatEvent`.
1.2 Implement deterministic scheduler APIs.
    - `startCombat`, `advanceTurn`, `dispatchAction`, `resolve`, `finalize`.
1.3 Keep combat math and action-economy enforcement in engine code only.

## Phase 2 - NPC Mechanics (DM-Ready Ownership Model)
2.1 Implement NPC combat profile model (combat-only fields).
2.2 Add ownership metadata on combatants (`player`, `dm`, `system`).
2.3 Add authorization mode switch:
    - `sandbox` for local testing where one operator can run both sides.
    - `role_enforced` for DM/player ownership checks.

## Phase 3 - Power Mechanics
3.1 Add structured engine-facing power mechanics (no runtime parsing from prose).
3.2 Implement power lifecycle:
    - cost validation
    - apply effects
    - maintenance handling
    - expiration/removal
3.3 Ensure power effects are consumed by derived and combat resolution paths.

## Phase 4 - DM Dashboard
4.1 Build encounter setup and participant management.
4.2 Build initiative/turn/action controls and combat event log.
4.3 Add NPC control actions and combat finalization controls.
4.4 Keep authorization checks centralized to support smooth `sandbox` -> `role_enforced` transition.

## Phase 5 - Persistence Handoff
5.1 Keep local-first while mechanics stabilize.
5.2 Introduce storage adapters under stable engine contracts.
5.3 Add Supabase-backed adapter and realtime pass without changing engine behavior.

## Validation
- Cleanup validation: reference index matches active/legacy placement.
- Combat validation: initiative ordering, turn progression, and action legality.
- NPC/auth validation: same scenario works in `sandbox` and rejects unauthorized commands in `role_enforced`.
- Power validation: costs, targets, passive/active effects, and maintenance/expiration behavior.
- Integration validation: PC + pseudo NPC encounter from setup to finalization.
