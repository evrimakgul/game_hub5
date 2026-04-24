---
title: Combat Encounter
topic: domains
kind: domain
status: active
updated: 2026-04-20
confidence: high
---

## Summary

Combat encounter is a live, stable runtime surface. The current system already handles prepared cast execution, ongoing effects, summons, status changes, encounter logging, physical attack resolution from equipped loadout state, and a player-facing masked combat view layered on top of the same encounter state.

## Current State

- `src/engine/encounterExecutionEngine.ts` applies prepared requests into character, encounter, and knowledge state.
- Encounter-visible combat supports initiative ordering, parties, transient combatants, ongoing maintained states, summon lifecycle, aura-linked effects, and encounter activity logs.
- DM combat continues to run through `/dm/combat/encounter`, while `/player/combat` now exposes a masked player surface over the same encounter with initiative order, encounter activities, AE-based reveal, and turn-limited action controls for the viewing character.
- `activeCombatEncounter` now persists locally, which is what lets the DM and player routes stay aligned without backend sync.
- Physical attacks resolve from equipped loadout state through `src/lib/combatEncounterPhysicalAttacks.ts`, including `unarmed`, `brawl`, one-handed, two-handed, oversized, and ranged profiles.
- Current notes lock in several combat-adjacent rules:
  - negative HP stays valid and visible
  - `Crowd Control` auto-resolves in-system
  - healing damages undead and necrotic heals undead
  - aura behavior is source-linked
  - `Brute Defiance` is passive again with the agreed recovery values

## Intended Direction

- Preserve the current encounter runtime and avoid reintroducing removed monolith assumptions.
- Keep combat behavior aligned with the current power/item systems instead of duplicating rule logic in UI code.
- Reopen major encounter architecture only through explicit roadmap items.

## Key Decisions

- Equipped item state drives physical attack behavior.
- Prepared cast execution is the encounter mutation path.
- Encounter log output is a first-class runtime artifact.
- Classic ranged timing/action-cost rules are still notes only; they are not yet a full runtime timing engine.

## Deferred / Open

- `ARCH-REM-01` controller/engine extraction follow-up remains recorded.
- Full timing/action-budget enforcement and broader player-side combat permissions beyond the current own-turn action surface remain deferred.
- Encounter persistence beyond the current local browser-storage surface remains deferred.
- `COMBAT-ACT-01` timing/action-budget work remains open.

## Sources

- [references/project_objective.md](../../references/project_objective.md)
- [references/current_notes.md](../../references/current_notes.md)
- [src/engine/encounterExecutionEngine.ts](../../src/engine/encounterExecutionEngine.ts)
- [src/routes/PlayerCombatPage.tsx](../../src/routes/PlayerCombatPage.tsx)
- [src/lib/combatEncounterPhysicalAttacks.ts](../../src/lib/combatEncounterPhysicalAttacks.ts)
- [references/session_handoff_2026-03-12.md](../../references/session_handoff_2026-03-12.md)

## Raw

- [THREAD-2.1](../../raw/codex-threads/thread-2.1-019cdf06-a91b-7df2-82ee-50051261f7f4.md)
- [THREAD-3](../../raw/codex-threads/thread-3-019ce29e-55fb-70b1-913c-5307603ac0f6.md)
- [THREAD-4](../../raw/codex-threads/thread-4-019d567a-df4a-70b0-8e63-b2138fa9b337.md)
- [USER-COMBAT-PLAYER-2026-04-20](../../raw/user-approved/2026-04-20-player-combat-mode.md)

