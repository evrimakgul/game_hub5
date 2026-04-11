# Tasks TODO
## Active
- `ITEM-MULTISLOT-01` After `ITEM-REFAC-01`, add first-class multi-slot occupancy for items. The target model should support `allowedEquipSlots[]`, `occupiedSlots[]`, and an `anchorSlot` or equivalent resolved-equip slot so shields, two-handed weapons, and future body-plus-head items can be represented without special-case slot hacks.

## Completed
### Group 1: Encounter Cast UI Standardization
- `CAST-UI-STD-01` completed. Active cast forms now expose `Power > Spell` first, then only the selected spell's extra fields. `Necromancy` summon casting now uses `Power > Spell: Non-Living Warriors > Summon`.
- `SUMMON-UI-01` completed. `Necromancy` and `Shadow Control` summons now expose contextual `Dismiss Summon` actions in the caster action menu.

### Group 2: Aura Targeting And Lifecycle
- `AURA-LIFECYCLE-01` completed. Aura spells remain dedicated aura spells, beneficiaries are explicitly selected where needed, linked effects stay source-linked to the caster aura, and source removal clears linked beneficiary effects.

### Group 3: Ingestion Reference Sync
- `INGEST-REF-01` completed. The four reverse-engineered power/spell ingestion reference files now describe the updated cast UI, aura lifecycle, and summon dismiss behavior.

## Blocked / Deferred
### Deferred Group D1: Future Expansion
- `B01` Expand the shared item UI into a full item-authoring and multi-target knowledge-sharing flow.
- `CHAR-APPAREL-01` During future character-creation / encounter-creation work, add an `unarmored humanoid baseline` rule so humanoid characters can receive `+3 Initiative` to their naked-state baseline when no chest armor is equipped, while mobs/animals can intentionally have no clothing-based baseline but still optionally equip armor or weapons. Implement with a per-character/template flag such as `apparelMode: humanoid | none`.
- `EQUIP-SUP-01` Defer the three supplementary equipment slots until a later phase. Add DM-controlled per-character activation for `orbital`, `earring`, and `charm/talisman` slots, and keep those slots hidden from the player-facing character sheet until the DM activates them for that specific character.
- `KNOW-V2-01` Expand the new knowledge-card system beyond character cards so item, place, faction, story, and custom subjects get first-class creation flows and sheet/browser surfaces.
- `AA-01` Defer full `Artifact Appraisal (AA)` integration until item mechanics and item UI are ready.
- `ITEM-RANGE-01` After refactoring, tune ranged blueprint identities. Current locked direction: `Short Bow` = `5d10`, `+1 hit`, and may move `10m` instead of `5m` with an attack action; `Long Bow` = `6d10` with longer range; `Light Crossbow` = `5d10`, `armorPenetration 1`, uses both attack and move actions; `Heavy Crossbow` = `8d10`, `armorPenetration 2`, uses all non-free actions (`attack`, `bonus`, `move`). Add a follow-up tuning pass for modern ranged weapons as well.
- `COMBAT-ACT-01` After item refactoring, design and implement the timing / action-economy extension for `actionBudget`, `action cost`, `weapon speed`, and multi-attack throughput. Preserve the summary of the discussion: this is intended to support characters gaining more than one attack in a standard action, weapons consuming different portions of a turn, and a future timing engine that can express combinations such as slower heavy weapons, faster brawl strings, and expanded character action budgets.
- `REPO-CLEANUP-01` Deferred cleanup: `python.ipynb` is intentionally allowed in the repo for temporary checking during development, but it must be removed before the project is considered done. Keep new threads aware that the notebook is temporary and should not become a permanent project artifact.
