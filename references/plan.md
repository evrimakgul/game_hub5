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
- `Crowd Control` casting now auto-resolves in-system using `CHA + INT` for the caster and `CHA + WITS` for each target.
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
- If no weapon is equipped, use `brawl / fists`.
- If an equipped weapon is explicitly typed as `brawl`, use the brawl profile.
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
- `BR-BD-01` Restore `Brute Defiance` to the intended passive delayed stand-up behavior with 1/day use and HP scaling `1 / 2 / 4 / 8 / 16` by `Body Reinforcement` level.
- Future knowledge/intel work should move toward standalone revisioned knowledge cards:
  - V1 now ships the standalone revisioned character-card system described in `references/knowledge_card_design.md`
  - remaining follow-up is expanding that model beyond character cards to other subject types
- Full item-authoring workflow and richer item bonus editors.
- Full multi-target `AA` knowledge-sharing UI.
- Encounter persistence and backend sync.
- Player-side encounter UI.
