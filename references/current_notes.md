# Current Notes

This file tracks active reminders for the current implementation block.

## Active Implementation Block
- The focused Phase 1 combat encounter completion pass is complete.
- The follow-up character-sheet and encounter action-flow pass is also complete.
- Actionable implementation items have been cleared from `project_tracking/tasks_todo.md`.
- Validation passed at the end of the pass: `npm run typecheck`, `npm test`, and `npm run build`.

## Confirmed Rules For This Block
- HP must stay capable of going negative.
- `Heal` mana cost is always `2`.
- `Cure` unlocks at level `3` and mana cost is always `3`.
- Healing cantrip stays at `2 uses per target per day`.
- `Crowd Control` initial cast costs `0`; upkeep only spends mana.
- `Crowd Control` auto-resolves in-system using caster `CHA + INT` vs target `CHA + WITS`, and ties fail.
- Encounter-visible `Crowd Control` status display should show only `Controlled by <caster>`.
- `Shadow Walk` is an encounter mobility action with no direct numeric damage effect.
- Healing damages undead; necrotic heals undead.
- `Expose Darkness` is no longer treated as a separate encounter cast at Light Support level `5`; enemy debuffing is part of `Light Aura`.
- Items will move to shared standalone records outside character sheets.
- Encounter physical attacks now resolve automatically from equipped loadout state.
- `Body Reinforcement` revive is now a manual encounter action instead of a turn-advance auto trigger.

## Known Structural Gaps
- Encounter action resolution is split across cast prep, route execution, and effect builders.
- Encounter upkeep and cast execution still live mostly in the route layer.
- Shared item editing is intentionally minimal and does not yet cover full authoring or knowledge-sharing UX.

## Deferred But Recorded
- `ARCH-REM-01` remains as a reminder to extract an encounter controller/engine layer later.
- Full item-authoring UX and multi-target `AA` knowledge-sharing UI remain deferred.
- Backend sync and encounter persistence remain out of scope.
