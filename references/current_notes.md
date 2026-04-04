# Current Notes

This file tracks active reminders for the current implementation block.

## Active Implementation Block
- The focused Phase 1 combat encounter completion pass is complete.
- The follow-up character-sheet and encounter action-flow pass is also complete.
- New follow-up design work has been recorded around a standalone knowledge-card system.
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
- `Brute Defiance` is now a manual encounter action instead of a turn-advance auto trigger.

## Known Structural Gaps
- Encounter action resolution is split across cast prep, route execution, and effect builders.
- Encounter upkeep and cast execution still live mostly in the route layer.
- Shared item editing is intentionally minimal and does not yet cover full authoring or knowledge-sharing UX.
- Knowledge gained from spells is still stored too narrowly as history entries instead of revisioned standalone knowledge records.

## Recorded Knowledge-Card Direction
- Keep `History` as an event log.
- Introduce standalone revisioned knowledge records rather than treating history as the storage model.
- Detailed implementation notes now live in `references/knowledge_card_design.md`.
- Working terminology:
  - `KnowledgeEntity` = the subject, such as a character, item, place, faction, or story topic.
  - `KnowledgeRevision` = one immutable version/snapshot of that subject's known information.
  - character ownership stores which revisions a character currently possesses.
- A character may own multiple revisions of the same subject at once.
- Edited/shared copies should create descendant revisions rather than overwriting the prior one.
- History entries should be able to reference an exact knowledge revision so the UI can open or preview the specific version involved in that event.
- Character sheets should eventually expose a dedicated `Knowledge` area for browsing owned subjects and revisions separately from `History`.
- The agreed data-model direction is:
  - standalone `KnowledgeEntity` / `KnowledgeRevision` / `KnowledgeOwnership` collections
  - immutable revisions with lineage metadata
  - history entries storing exact revision links instead of embedding full knowledge as the primary record

## Deferred But Recorded
- `ARCH-REM-01` remains as a reminder to extract an encounter controller/engine layer later.
- `Brute Defiance` is still using the temporary manual-trigger implementation; the recorded follow-up is to restore it as a passive delayed stand-up with HP scaling `1 / 2 / 4 / 8 / 16` by `Body Reinforcement` level.
- Full item-authoring UX and multi-target `AA` knowledge-sharing UI remain deferred.
- Revisioned knowledge-card storage, character-sheet knowledge browsing, and history-to-card linking are now recorded future work.
- Backend sync and encounter persistence remain out of scope.
