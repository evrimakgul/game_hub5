# Current Notes

This file tracks active reminders for the current implementation block.

## Active Implementation Block
- The focused Phase 1 combat encounter completion pass is complete.
- The follow-up character-sheet and encounter action-flow pass is also complete.
- Knowledge System V1 is now implemented for character cards.
- The remaining power TODO rewrite pass is now complete.
- Validation passed at the end of the pass: `npm run typecheck`, `npm test`, and `npm run build`.

## Confirmed Rules For This Block
- HP must stay capable of going negative.
- `Heal Living (HL)` mana cost is always `2`.
- `Holy Purge (HP)` unlocks at level `3` and mana cost is always `2`.
- `Healing Touch (HT)` stays at `2 uses per target per day`.
- `Crowd Control` initial cast costs `0`; upkeep only spends mana.
- `Crowd Control` auto-resolves in-system using caster `CHA + INT` vs target `CHA + WITS`, and ties fail.
- Encounter-visible `Crowd Control` exposes `Control Entity (CE)` only; release is contextual.
- `Shadow Walk` is an encounter mobility action with no direct numeric damage effect.
- Healing damages undead; necrotic heals undead.
- `Lessen Darkness (LD)` is now a separate linked Light Support cast at level `5`.
- Items will move to shared standalone records outside character sheets.
- Encounter physical attacks now resolve automatically from equipped loadout state.
- `Brute Defiance` is passive again: 1/day, HP `0` to `-5`, resolves after one turn, and restores `1 / 2 / 4 / 8 / 16` HP by BR level.

## Known Structural Gaps
- Shared item editing is intentionally minimal and does not yet cover full authoring or knowledge-sharing UX.
- Aura construction still has a recorded architecture dilemma about whether it should stay on `buildActivePowerEffect(...)` or move to a dedicated aura builder later.

## Knowledge System V1
- Keep `History` as an event log.
- Knowledge now uses standalone revisioned records rather than history-only storage.
- Detailed implementation notes now live in `references/knowledge_card_design.md`.
- Working terminology:
  - `KnowledgeEntity` = the subject, such as a character, item, place, faction, or story topic.
  - `KnowledgeRevision` = one immutable version/snapshot of that subject's known information.
  - character ownership stores which revisions a character currently possesses.
- A character may own multiple revisions of the same subject at once.
- Edited/shared copies should create descendant revisions rather than overwriting the prior one.
- History entries now reference exact revisions so the UI can preview or open the specific version involved in the event.
- Character sheets now expose a dedicated inline `Knowledge` area for browsing owned subjects and revisions separately from `History`.
- V1 implementation scope:
  - character cards only
  - duplicate / edited copy / share / archive / pin / compare
  - DM snapshot creation, manual creation, edit-before-save, and grant flows
  - legacy embedded intel history rows are intentionally removed during hydration

## Deferred But Recorded
- Full item-authoring UX and multi-target `AA` knowledge-sharing UI remain deferred.
- Expansion of the knowledge system beyond character cards remains deferred.
- Aura-builder redesign remains deferred pending the recorded architecture discussion.
- Backend sync and encounter persistence remain out of scope.
