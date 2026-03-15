# Current Notes

This file tracks active reminders for the current implementation block.

## Active Implementation Block
- The previous branch state marked the T1 power runtime as complete, but this is no longer the active assumption.
- The combat encounter fix pass and the first shared item-domain model are now implemented.
- The current branch state is green and ready for defect-driven follow-up work.

## Confirmed Rules For This Block
- HP must stay capable of going negative.
- `Heal` mana cost is always `2`.
- `Cure` unlocks at level `3` and mana cost is always `3`.
- Healing cantrip stays at `2 uses per target per day`.
- `Crowd Control` initial cast costs `0`; upkeep only spends mana.
- `Shadow Walk` is an encounter mobility action with no direct numeric damage effect.
- `Expose Darkness` targets enemy parties only and ignores allies.
- Items will move to shared standalone records outside character sheets.

## Known Structural Gaps
- Encounter action resolution is split across cast prep, route execution, and effect builders.
- Encounter upkeep and cast execution still live mostly in the route layer.
- Shared item editing is intentionally minimal and does not yet cover full authoring or knowledge-sharing UX.

## Deferred But Recorded
- Full item-authoring UX and multi-target `AA` knowledge-sharing UI remain deferred.
- Backend sync and encounter persistence remain out of scope.
