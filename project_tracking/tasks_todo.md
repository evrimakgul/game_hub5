# Tasks TODO
## Active
No active TODOs.

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
- `KNOW-V2-01` Expand the new knowledge-card system beyond character cards so item, place, faction, story, and custom subjects get first-class creation flows and sheet/browser surfaces.
- `AA-01` Defer full `Artifact Appraisal (AA)` integration until item mechanics and item UI are ready.
