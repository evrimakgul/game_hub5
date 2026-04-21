# Tasks TODO
## Active
- No active implementation item is currently recorded. `COMBAT-ACT-01` is explicitly deferred to the very end of the project and may be skipped entirely unless priorities change.

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
- `ITEM-RANGE-01` completed for the classic subset. `Short Bow` and `Light Crossbow` are now separate blueprint identities, `weapon:ranged_light` migrates to `range:light_crossbow`, older saves backfill missing seeded blueprints/definitions during hydration, crossbow armor penetration now reduces DR at runtime, and unsupported classic bow / crossbow timing details remain note-only until the combat-action pass.

### Group 5: Supplementary Slots And Item Knowledge UX
- `EQUIP-SUP-01` completed. Supplementary `orbital`, `earring`, and `charm/talisman` slots now use persisted per-character activation state, remain hidden until enabled, and disabling an active slot clears only that equipment slot.
- `B01` completed for item cards. Added an item-focused DM interaction hub that can activate supplementary slots for selected characters, generate or refresh canonical item knowledge cards, inspect item revisions, and share one item card revision to multiple characters at once while also syncing item learned/visible state.

### Group 6: World Casting V1
- `WORLD-CAST-V1-01` completed. `Known Powers` now exposes inline out-of-combat `Use` panels on the character sheet, backed by a shared `world` / `encounter` casting core. World casting V1 currently supports `Assess Entity`, `Body Reinforcement`, `Healing Touch`, and `Luminous Restoration`; encounter-only variants stay visible but unavailable outside combat. Inventory `Identify` now routes through the same shared world-casting backend for `Artifact Appraisal`.

### Group 7: Artifact Appraisal Integration
- `AA-01` completed. Inventory `Identify` now finishes the `Artifact Appraisal` flow on top of the live item-knowledge model: it grants or refreshes the current canonical item-card revision, writes linked history rows to the granted revision, and keeps hidden item bonus visibility keyed to ownership of the current revision instead of any stale older revision. Multi-recipient sharing continues to reuse the existing DM item-card share flow.

### Group 8: Knowledge Expansion And Item Value
- `KNOW-V2-01` completed. Knowledge cards now support DM-authored `place`, `faction`, `story`, and `custom` subjects through a dedicated DM Knowledge Hub, while the existing player-side Knowledge Library continues to browse/share/open owned revisions across mixed subject types.
- `ITEM-VAL-01` completed. Shared items now persist DM-authored `baseStrength`, computed `anchorValue`, and optional `anchorValueOverride`, with DM edit/list surfaces exposing computed and effective value without surfacing those value fields on player item views.

### Group 9: Unarmored Baseline
- `UNARMORED-BASELINE-01` completed. Characters now persist `apparelMode: humanoid | none`. Clothing / robes remain the existing chest item baseline at `Initiative +2, DR +0`, while humanoid characters with no chest/body item at all now gain a separate naked-state baseline of `+3 Initiative`. Characters using `apparelMode: none` opt out of that naked-state bonus.

### Group 10: Mob, Group, And Portal Authoring Workshop
- `AUTHORING-WORKSHOP-01` completed. DM tooling now includes dedicated `/dm/mobs`, `/dm/mob-groups`, and `/dm/portals` routes. Mobs persist as standalone `MobTemplate` records with explicit CR and live derived-combat summary output, groups persist as reusable `MobGroup` records with target/party-mean CR controls, portals persist as nested-stage `PortalTemplate` records with portal/stage difficulty controls, `/dm/portals` now supports portal-first `portal_bundle` import/export, and the combat dashboard can export saved groups or portal stages into encounter-owned mob instances without polluting the normal character library.

### Group 11: Player Auction Shopping
- `AUCTION-PLAYER-01` completed. Player character sheets now link into `/player/auction-house`, auction entries expose completed `Bid` and `Buyout` transactions against character money, purchased items are created/assigned directly into the buying character's shared-item inventory, and auction stock now decrements live until it reaches `0`.

## Blocked / Deferred
### Deferred Group D1: Future Expansion
- `COMBAT-ACT-01` Explicitly defer the timing / action-economy extension for `actionBudget`, `action cost`, `weapon speed`, and multi-attack throughput until the very end of the project, if it is done at all. Preserve the summary of the discussion for future reference only: this would support characters gaining more than one attack in a standard action, weapons consuming different portions of a turn, and a future timing engine that can express combinations such as slower heavy weapons, faster brawl strings, and expanded character action budgets.
- `PORTAL-RUNNER-01` Deferred follow-up: keep full portal-run state, boss-clear reward activation, exit unlocking, and persistent stage-by-stage run automation out of scope until the authoring workshop and encounter export flow have settled.
- `REPO-CLEANUP-01` Deferred cleanup: `python.ipynb` is intentionally allowed in the repo for temporary checking during development, but it must be removed as the literal last cleanup step before the project is considered done. Keep new threads aware that the notebook is temporary and should not become a permanent project artifact.
