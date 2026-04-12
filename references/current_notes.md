# Current Notes

This file tracks active reminders for the current implementation block.

## Active Implementation Block
- The focused Phase 1 combat encounter completion pass is complete.
- The follow-up character-sheet and encounter action-flow pass is also complete.
- Knowledge System V1 is now implemented for character cards.
- The remaining power TODO rewrite pass is now complete.
- The encounter cast UI standardization, aura lifecycle cleanup, summon dismiss UI, and ingestion reference sync pass is now complete.
- The persisted item-definition refactor is now complete.
- The anchor-slot / multi-slot equipment pass is now complete.
- The hand-state combat cleanup and classic ranged split pass is now complete.
- Validation passed at the end of the pass: `npm run typecheck`, `npm test`, and `npm run build`.

## Confirmed Rules For This Block
- HP must stay capable of going negative.
- `Heal Living (HL)` mana cost is always `2`.
- `Holy Purge (HP)` unlocks at level `3` and mana cost is always `2`.
- `Healing Touch (HT)` stays at `2 uses per target per day`.
- `Crowd Control` initial cast costs `0`; upkeep only spends mana.
- `Crowd Control` auto-resolves in-system using caster `CHA + INT` at levels `1-3`, caster `CHA + INT + CC level` at levels `4-5`, vs target `CHA + WITS`; ties fail.
- Encounter-visible `Crowd Control` exposes `Control Entity (CE)` only; release is contextual.
- `Shadow Walk` is an encounter mobility action with no direct numeric damage effect.
- Healing damages undead; necrotic heals undead.
- `Lessen Darkness (LD)` is now a separate linked Light Support cast at level `5`.
- Items will move to shared standalone records outside character sheets.
- Encounter physical attacks now resolve automatically from equipped loadout state.
- `Brute Defiance` is passive again: 1/day, HP `0` to `-5`, resolves after one turn, and restores `1 / 2 / 4 / 8 / 16` HP by BR level.
- Item blueprints now resolve through persisted `ItemCategoryDefinition` and `ItemSubcategoryDefinition` records instead of hardcoded category/subtype branching.
- Equipment entries now persist explicit `anchorSlot` values, and multi-slot items occupy canonical follower slots through the anchor model.
- Shields still resolve to the secondary hand.
- One-handed hand items still prefer primary then secondary.
- Rings still resolve left then right.
- `unarmed` now means both weapon hands are empty.
- `brawl` now means at least one equipped `melee:brawl` item is present and no non-brawl hand item occupies either weapon hand.
- `melee:unarmed` remains readable for compatibility, but it is deprecated for normal new-item authoring.
- Classic ranged blueprints are now split so `Short Bow` and `Light Crossbow` are separate identities.
- Crossbow armor penetration now reduces DR during physical attack resolution.
- Older saves now backfill missing seeded item blueprints and item definitions during hydration without overwriting same-id persisted edits.

## Known Structural Gaps
- Shared item editing is intentionally minimal and does not yet cover full authoring or knowledge-sharing UX.
- DM item tooling now includes dedicated definition management for item categories and subcategories.
- Encounter cast UI now uses a stable `Power > Spell > ...` flow for active casts.
- Aura behavior now uses explicit beneficiary selection where needed and keeps linked effects tied to the caster-owned aura source.
- `Necromancy` and `Shadow Control` summon dismissal is now exposed as contextual caster action UI.
- The four reverse-engineered power/spell ingestion reference JSON files now describe the updated cast UI / aura lifecycle / summon-dismiss behavior.
- Classic bow / crossbow action-cost and movement rules are still represented only as visible notes; runtime timing support remains deferred to the later combat-action pass.

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
- Future creation/template work should distinguish humanoid apparel logic from mobs/animals:
  - humanoids can use default clothing and naked-state initiative rules
  - beasts/mobs can intentionally have no clothing baseline
  - both should still be able to equip armor/weapons when explicitly assigned
  - recommended implementation hint: per-character/template flag such as `apparelMode: humanoid | none`
- Expansion of the knowledge system beyond character cards remains deferred.
- Backend sync and encounter persistence remain out of scope.

## Resolved Design Direction
- Aura spells should stay modeled as dedicated aura spells, not as normal targeted buffs.
- `AuraSpellAction` remains the right action category.
- The required follow-up is not a new spell-class introduction; it is a targeting and lifecycle cleanup so aura targets are explicit and source-linked.
