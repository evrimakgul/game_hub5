# Roadmap Reset v10 (Phase 1 Combat Encounter Completion)

This roadmap is the active implementation source of truth for this branch.

## Ground Rules
- Keep the current player flow, DM flow, character sheets, local persistence, and DM NPC creation intact.
- Preserve working encounter behavior unless a change is required by an identified defect or this roadmap.
- Use `Basic_Rules5.txt`, `T1_Supernatural_Powers5.txt`, `json_refs/powers.json`, and `json_refs/item_rules.json` as rule inputs.
- Damage resolution must not clamp HP at `0`; negative HP stays visible.
- Keep the current `Action` / `Effect` spell runtime, power registry, and passive provider registry as the internal direction for future power work.
- Treat combat, powers, turn upkeep, summons, aura effects, and items as one aligned system.

## Baseline Already Present
- Combat dashboard staging, parties, initiative ordering, and DM combat encounter page.
- Player and DM character sheets with local character persistence.
- DM runtime editing, roll helper, active power effects, temporary inspiration, temporary HP, negative HP, typed intel snapshots, and encounter-visible status tags.
- Shared T1 runtime already present for:
  - Awareness `AS` / `AI` / `AC`
  - `Body Reinforcement`
  - `Healing`
  - `Light Support`
  - `Necromancy`
  - `Shadow Control`
  - `Crowd Control`
  - `Elementalist`
- Encounter-only transient summons and ongoing maintained states already exist, but need correction in this phase.

## Completed Phase 1: Combat Encounter Completion

### 1.1 Completed Fixes
- Encounter log labels for generic buff casts now use the real power or action name.
- `Shadow Soldier` summon actions now consume mana correctly.
- `Crowd Control` casting now auto-resolves in-system using `CHA + INT` for caster levels `1-3`, `CHA + INT + CC level` for caster levels `4-5`, and `CHA + WITS` for each target.
- Undead handling now inverts healing and necrotic effects: healing damages undead and necrotic heals undead.

### 1.2 Completed Aura and Summon Rules
- If `Cloak of Shadow` aura is already active, newly created allied `Shadow Soldier` summons inherit it automatically.
- `Light Support` level `5` enemy debuffing is now the enemy-side portion of `Light Aura`, not a separate `Expose Darkness` cast.
- Aura target management can add or remove both ally buffs and enemy debuffs from the same aura source.

### 1.3 Completed Encounter UI Fixes
- Encounter displays now show only one visible `Crowd Control` status tag: `Controlled by <caster>`.
- Inline `Physical Attacks` and `Cast Power Mechanism` sections were replaced with a single `Actions` popover/button.
- Encounter history now opens at `3` visible rows minimum, can be resized taller, and caps at `18` rows.

## Completed Phase 2: Shared Item Model Basics

### 2.1 Shared Item Entities
- Move items to standalone records outside character sheets.
- Character sheets store references instead of embedded full item objects.
- Keep ownership, possession, and active use / equipped state separate.

### 2.2 Item Domain Model
- Implement an extensible TypeScript item model with inheritance for categories:
  - `Item`
  - `Weapon`
  - `Armor`
  - `Jewel`
  - `Mystic`
- Add concrete subtype classes for at least the currently needed weapon and armor categories.
- Keep base visible properties on the item class hierarchy.

### 2.3 Bonus Composition
- Use a compositional `BonusProfile` on every item.
- Base stats are always visible.
- Bonus stats may be hidden but still apply mechanically when the item is equipped or used.

### 2.4 Item Knowledge and `AA`
- Track item bonus knowledge per character, not globally.
- Model identify, mask, and share knowledge state now at the data/rules level.
- Keep only a minimal sheet-facing identify / mask surface for now.
- Full multi-target share flow and richer `AA` interaction UI remain deferred.

### 2.5 Engine Alignment
- Item bonuses must apply based on the character currently using / equipping the item, not the owner.
- Keep the model aligned with combat, sheet rendering, and future persistence.

## Completed Follow-Up: Character Sheet and Encounter Action Flow

### 3.1 Derived Summary Consolidation
- `Active Effects`, `Utility Traits`, `Combat Flags`, and `Power Tracking` now live under `Derived Summary`.
- `CharacterResources` is reduced back to stored resource state only.

### 3.2 Automatic Physical Attacks
- Encounter physical attacks now infer the active profile from equipped weapon hand slots.
- If both weapon hands are empty, use `unarmed`.
- If at least one equipped hand item is explicitly typed as `brawl` and no non-brawl hand item occupies either hand, use the brawl profile.
- Physical attacks now auto-resolve hit, marginal, damage, DR mitigation, and encounter activity logging in-system.

### 3.3 Manual Brute Defiance Trigger
- `Brute Defiance` is no longer scheduled automatically on turn advance.
- The encounter UI now exposes a manual trigger with visible eligibility text.
- The trigger is available only when:
  - `Body Reinforcement` is at least level `2`
  - current HP is between `0` and `-5`
  - the daily revive use is still unspent

### 3.4 Power Runtime Refactor
- Spell preparation now resolves through a light class-based `Action` / `Effect` runtime under `src/engine/`.
- Power-specific spell dispatch now lives in `src/powers/` modules plus a central power registry instead of the old monolithic `prepareCastRequest` spell switch.
- Passive power-derived skill bonuses, mana bonuses, and utility traits now come from a passive provider registry instead of hardcoded branches in `characterRuntime.ts`.
- External UI request shapes, local save compatibility, current powers and spells, and `powers.json` metadata remain intact.

### 3.5 Encounter Execution Engine Refactor
- Encounter request execution, turn advance, upkeep spending, aura cleanup, summon lifecycle merges, and encounter log generation now run through a dedicated `EncounterExecutionEngine`.
- `CombatEncounterPage.tsx` now stays focused on UI orchestration:
  - build requests
  - handle confirmation UI
  - call the engine
  - commit returned state
- The stable `PreparedCastRequest` boundary remains intact.
- Aura-builder redesign remains deferred; this refactor only moved post-prepare execution out of the route.

## Completed Follow-Up: Knowledge System V1

### 4.1 Standalone Knowledge Storage
- Knowledge now lives in standalone local-first collections:
  - `KnowledgeEntity`
  - `KnowledgeRevision`
  - `KnowledgeOwnership`
- These collections persist alongside characters and items.
- Old embedded `intel_snapshot` history rows are discarded during hydration instead of being treated as real long-term storage.

### 4.2 Spell Integration
- `Assess Character` now creates immutable linked character-card revisions during encounter resolution.
- The caster receives ownership of the new revision.
- `History` remains a log, but linked intel rows now point to the exact revision involved.

### 4.3 Character Sheet UI
- `Game History` now supports linked knowledge rows with hover preview and click/open dialog behavior.
- Character sheets now expose a full-width inline `Knowledge` section.
- The Knowledge section supports:
  - subject grouping
  - revision browsing
  - duplicate
  - edited copy
  - share
  - archive
  - pin
  - compare
  - DM snapshot/manual character-card authoring and grant flows

### 4.4 Current V1 Boundary
- V1 ships character cards only.
- The architecture remains generic enough for future item, place, faction, story, and custom knowledge cards, but those creation flows remain deferred.

## Completed Follow-Up: Remaining Power TODO Pass

### 5.1 `Body Reinforcement`
- `Brute Defiance` is passive again.
- It now auto-schedules when HP is between `0` and `-5`, resolves after one turn, remains `1/day`, and restores `1 / 2 / 4 / 8 / 16` HP by `Body Reinforcement` level.
- Manual encounter-trigger UI for `Brute Defiance` has been removed.

### 5.2 `Crowd Control`
- `Control Entity (CE)` is now the only user-facing spell.
- Controlled-target release is now a contextual encounter action instead of a second spell option.
- Passive replacement is complete:
  - `Crowd Management (CM)` adds `Social` equal to `Crowd Control` level.
  - `Compulsion Guard (CG)` appears at level `5`.

### 5.3 `Elementalist`
- `Elemental Bolt`, `Elemental Cantrip`, and `Elemental Split` are now explicit separate spells.
- The old branchy single-class runtime was replaced with one action class per spell.
- Split-style multi-target behavior now lives on `Elemental Split` instead of being folded into `Elemental Bolt`.

### 5.4 `Healing`
- `Healing` now exposes:
  - `Heal Living (HL)`
  - `Holy Purge (HP)`
  - `Healing Touch (HT)`
- Each spell now resolves through its own action class.
- `Holy Purge` now costs `2` mana.

### 5.5 `Light Support`
- `Light Support` now exposes:
  - `Let There Be Light (LTBL)`
  - `Luminous Restoration (LR)`
  - `Lessen Darkness (LD)`
- Passive `Lunar Bless (LB)` behavior is now reflected through passive mana and utility-trait output.
- `Lessen Darkness` is now an explicit linked level-five cast instead of being folded into the default aura cast.

### 5.6 `Necromancy`
- `Necromancy` now exposes:
  - `Non-Living Warriors` as the parent summon spell, with `Non-Living Skeleton`, `Non-Living Skeleton King`, and `Non-Living Zombie` selected through the `Summon` field.
  - `Necrotic Touch`
  - `Necromancer's Bless`
- Passive `Necromancer's Deception` progression is now reflected in the passive provider.
- Summon replacement now respects subtype replacement for the new visible necromancy summon variants.

### 5.7 `Shadow Control`
- `Shadow Control` now exposes:
  - `Smoldering Shadow`
  - `Shadow Walk`
  - `Shadow Walk and Attack`
  - `Shadow Manipulation`
  - `Shadow Fighter`
- Passive `Sleek Visage` cosmetic behavior is reflected through the passive provider.
- `Smoldering Shadow` now drops the old intimidation bonus and uses the newer stealth + AC progression.

## Completed Follow-Up: Encounter Cast UI, Aura Lifecycle, And Summon Dismiss

### 6.1 Cast Form Standardization
- Active cast forms now consistently expose the `Spell` step, including powers that currently have only one visible spell.
- Spell-specific fields remain conditional after the spell step, such as target, stat, mode, damage type, summon, attack resolution, extra mana, and healing allocation.
- `Necromancy` summon casting now uses `Power > Spell: Non-Living Warriors > Summon subtype`.

### 6.2 Aura Lifecycle
- Aura spells remain dedicated aura spells.
- Aura beneficiary selection is explicit where the aura can affect other combatants.
- Linked aura effects remain tied to the caster-owned source aura, so removing the source aura clears beneficiary effects.
- `Lessen Darkness` updates the source aura target list so its linked debuffs are cleaned up with the source.

### 6.3 Summon Dismiss UI
- `Necromancy` and `Shadow Control` summons now expose contextual `Dismiss Summon` actions in the caster action menu.
- Dismiss remains summon-management behavior, not a normal cast-form spell.

### 6.4 Ingestion Reference Sync
- The reverse-engineered ingestion reference files now describe the updated cast UI, aura lifecycle, and summon dismiss behavior:
  - `references/power_spell_ingestion_normalized_current.json`
  - `references/power_spell_ingestion_decisions_current.json`
  - `references/power_spell_mechanics_current.json`
  - `references/power_spell_ui_current.json`

## Completed Follow-Up: Item Equip Core And Classic Range Cleanup

### 7.1 Anchor-Slot Equip State
- Character equipment entries now persist explicit `anchorSlot` values on canonical slots.
- Multi-slot items still write their `itemId` into every occupied canonical slot, but all occupied follower entries share the same anchor.
- Hydration and live state updates normalize old slot-only saves into the anchor-aware shape.

### 7.2 Multi-Slot Equip Behavior
- Equip and unequip mutations now operate on anchor groups instead of raw duplicate slot ids.
- Unequipping from a follower slot clears the whole anchored item group.
- Player loadout rendering now distinguishes anchor slots from occupied follower slots.

### 7.3 Hand-State Combat Rules
- `unarmed` now means both `weapon_primary` and `weapon_secondary` are empty.
- `brawl` now means at least one equipped `melee:brawl` item is present and no non-brawl hand item occupies either hand.
- `melee:unarmed` remains readable for compatibility but is deprecated for normal new-item authoring flows.

### 7.4 Classic Ranged Split
- `Short Bow` and `Light Crossbow` are now separate blueprint identities.
- Legacy alias `weapon:ranged_light` now migrates to `range:light_crossbow`.
- Older persisted item catalogs now backfill missing seeded blueprints and item definitions during hydration without overwriting same-id custom edits.
- Unsupported classic crossbow timing / armor-penetration rules remain represented as visible notes until the later combat-action extension exists.

## Validation
- After each meaningful task group run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Do not mark a task complete until all three pass after that change group.
- If a pre-existing test failure appears, log and isolate it before continuing.
- Keep tracking files current after every task.
- Update this roadmap when implementation reality changes.

## Deferred
- Future knowledge/intel work should move toward standalone revisioned knowledge cards:
  - V1 now ships the standalone revisioned character-card system described in `references/knowledge_card_design.md`
  - remaining follow-up is expanding that model beyond character cards to other subject types
- Aura-builder redesign remains deferred:
  - current implementation still uses `buildActivePowerEffect(...)` for both targeted buff spells and aura-source spells
  - the recorded alternative is a dedicated aura builder such as `buildAuraSourceEffect(...)` or `buildAuraSpellEffect(...)`
- Full item-authoring workflow and richer item bonus editors.
- Full multi-target `AA` knowledge-sharing UI.
- Encounter persistence and backend sync.
- Player-side encounter UI.
