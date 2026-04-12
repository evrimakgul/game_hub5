# Tasks TODO
## Active
- No active task recorded yet. Pick the next item from deferred after reviewing current notes and roadmap.

## Completed
### Group 1: Encounter Cast UI Standardization
- `CAST-UI-STD-01` completed. Active cast forms now expose `Power > Spell` first, then only the selected spell's extra fields. `Necromancy` summon casting now uses `Power > Spell: Non-Living Warriors > Summon`.
- `SUMMON-UI-01` completed. `Necromancy` and `Shadow Control` summons now expose contextual `Dismiss Summon` actions in the caster action menu.

### Group 2: Aura Targeting And Lifecycle
- `AURA-LIFECYCLE-01` completed. Aura spells remain dedicated aura spells, beneficiaries are explicitly selected where needed, linked effects stay source-linked to the caster aura, and source removal clears linked beneficiary effects.

### Group 3: Ingestion Reference Sync
- `INGEST-REF-01` completed. The four reverse-engineered power/spell ingestion reference files now describe the updated cast UI, aura lifecycle, and summon dismiss behavior.

### Group 4: Item Equip Core And Hand-State Cleanup
- `ITEM-MULTISLOT-01` completed. Equipment entries now persist a real `anchorSlot`, canonical multi-slot occupancy is normalized during hydration and live state updates, equip/unequip logic clears whole anchor groups, and follower slots render as occupied/locked instead of looking like duplicate equips.
- `ITEM-HAND-LOGIC-01` completed. Physical attack profile resolution now distinguishes `unarmed` as both hands empty and `brawl` as at least one equipped brawl item with no non-brawl hand item occupying either hand.
- `ITEM-RANGE-01` completed for the classic subset. `Short Bow` and `Light Crossbow` are now separate blueprint identities, `weapon:ranged_light` migrates to `range:light_crossbow`, older saves backfill missing seeded blueprints/definitions during hydration, and unsupported classic crossbow timing / armor-penetration details are carried as visible notes instead of fake runtime mechanics.

## Blocked / Deferred
### Deferred Group D1: Future Expansion
- `B01` Expand the shared item UI into a full item-authoring and multi-target knowledge-sharing flow.
- `CHAR-APPAREL-01` During future character-creation / encounter-creation work, add an `unarmored humanoid baseline` rule so humanoid characters can receive `+3 Initiative` to their naked-state baseline when no chest armor is equipped, while mobs/animals can intentionally have no clothing-based baseline but still optionally equip armor or weapons. Implement with a per-character/template flag such as `apparelMode: humanoid | none`.
- `EQUIP-SUP-01` Defer the three supplementary equipment slots until a later phase. Add DM-controlled per-character activation for `orbital`, `earring`, and `charm/talisman` slots, and keep those slots hidden from the player-facing character sheet until the DM activates them for that specific character.
- `KNOW-V2-01` Expand the new knowledge-card system beyond character cards so item, place, faction, story, and custom subjects get first-class creation flows and sheet/browser surfaces.
- `AA-01` Defer full `Artifact Appraisal (AA)` integration until item mechanics and item UI are ready.
- `COMBAT-ACT-01` After item refactoring, design and implement the timing / action-economy extension for `actionBudget`, `action cost`, `weapon speed`, and multi-attack throughput. Preserve the summary of the discussion: this is intended to support characters gaining more than one attack in a standard action, weapons consuming different portions of a turn, and a future timing engine that can express combinations such as slower heavy weapons, faster brawl strings, and expanded character action budgets.
- `REPO-CLEANUP-01` Deferred cleanup: `python.ipynb` is intentionally allowed in the repo for temporary checking during development, but it must be removed before the project is considered done. Keep new threads aware that the notebook is temporary and should not become a permanent project artifact.
