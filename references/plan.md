# Roadmap Reset v9 (Combat Encounter Fixes + Shared Item Model)

This roadmap is the active implementation source of truth for this branch.

## Ground Rules
- Keep the current player flow, DM flow, character sheets, local persistence, and DM NPC creation intact.
- Preserve working encounter behavior unless a change is required by an identified defect or this roadmap.
- Use `Basic_Rules5.txt`, `T1_Supernatural_Powers5.txt`, `json_refs/powers.json`, and `json_refs/item_rules.json` as rule inputs.
- Damage resolution must not clamp HP at `0`; negative HP stays visible.
- Prefer minimal coherent engine changes over broad rewrites.
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

## Completed Phase 1: Combat Encounter Fixes

### 1.1 Shadow Control
- Add a real `Shadow Walk` cast option at level 5.
- Keep it as a non-damaging mobility action in encounter scope.
- Use the power-defined range and log the action cleanly.
- Verify consistency with `Chain of Shadows`, `Shadow Manipulation`, and `Shadow Soldier`.

### 1.2 Healing
- Split `Heal` and `Cure` into separate encounter actions from level 3 onward.
- `Heal` mana cost is always `2`.
- `Cure` is available from level 3 and always costs `3`.
- Preserve healing cantrip rule as `2 uses per target per day`.
- Fix any level-based cast UI or runtime logic that still merges `Heal` and `Cure`.

### 1.3 Necromancy and Shadow Soldier
- Verify summon buff rules:
  - skeletons and skeleton king must not receive single or group buffs
  - zombie may receive group buffs
  - shadow soldier may receive buffs
- Decide healing-vs-undead behavior for this branch:
  - summoned undead and shadow summons remain non-healable
  - standard healing powers do not invert into damage against undead unless explicitly added later
- Add `Remove Summon` / dismiss action for necromancy summons.
- Add `Remove Summon` / dismiss action for `Shadow Soldier`.

### 1.4 Light Support
- Fix `Expose Darkness` targeting.
- It must target enemies only: all combatants in non-caster parties.
- It must ignore allies.
- Keep ally bonus behavior on Light aura separate from enemy debuff behavior.

### 1.5 Crowd Control
- Add a cancel / release target action.
- Summons must not be valid `Crowd Control` targets.
- Initial cast costs `0`; upkeep only spends mana.
- Upkeep cost scales by maintained target count.
- `Advance Turn` must process upkeep and release consistently.

### 1.6 Elementalist
- Audit and fix target filtering so summon and entity behavior is consistent.
- Resolve the observed inconsistency where `Zombie` is targetable but `Shadow Soldier` is not.
- Keep only rule-based exclusions.

### 1.7 Aura Lifecycle
- Aura cast defaults to all allies on initial cast where aura-sharing is allowed.
- After initial cast, targets remain addable/removable individually.
- If the original aura source disappears, dies, or self-cancels, all linked aura effects must be removed from allies.

### 1.8 Physical Combat Resolution
- Add clickable physical attack actions to the combat encounter.
- Temporary assumptions for now:
  - brawl: `2` attacks, base damage `STR`
  - one one-handed weapon: `1` attack, base damage `STR + 2`
  - two one-handed weapons: `2` attacks, attack DC `7`, base damage `STR + 2`
  - two-handed weapon: `1` attack, base damage `STR + 6`
  - bow: `1` attack, base damage `5`
- Build this so the later item system can replace the temporary rules cleanly.

### 1.9 Encounter Action Resolution and Activity Log
- Extend encounter action handling for clickable magical attack resolution:
  - `Necrotic Touch`
  - `Crowd Control`
  - other targeted magical actions already on the page
- Keep target selection, hit/contest outcome, effect application, and upkeep linkage aligned.
- Add a minimal encounter activity log for action summaries because physical and magical action resolution now require visible runtime feedback.

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

## Validation
- After each meaningful task group run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Keep tracking files current after every task.
- Update this roadmap when implementation reality changes.

## Deferred
- Full item-authoring workflow and richer item bonus editors.
- Full multi-target `AA` knowledge-sharing UI.
- Encounter persistence and backend sync.
- Player-side encounter UI.
