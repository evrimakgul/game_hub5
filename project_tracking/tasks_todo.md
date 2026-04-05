# Tasks TODO
## Knowledge System
- `KNOW-V2-01` Expand the new knowledge-card system beyond character cards so item, place, faction, story, and custom subjects get first-class creation flows and sheet/browser surfaces.

## Phase 1: Combat Encounter
- `BR-BD-01` Update `Brute Defiance (BD)` under `Body Reinforcement` so it becomes a passive delayed stand-up effect again: 1/day, triggers while HP is between `0` and `-5`, resolves after one turn, and restores HP by BR level as `1 / 2 / 4 / 8 / 16`. Do not overwrite older BR work until validation is planned for the behavior change group.
- `AURA-ARCH-DISCUSS-01` Dilemma to be discussed: current implementation uses `buildActivePowerEffect(...)` for both targeted buff spells like `Boost Physique` and aura-source spells like `Light Aura` / `Cloak of Shadow`; alternative direction is to keep targeted buff construction there but move aura spells to a dedicated aura builder such as `buildAuraSourceEffect(...)` or `buildAuraSpellEffect(...)`. Do not implement until the architecture decision is discussed.
- `CC-CE-01` Fold `Release Target` into `Control Entity (CE)` so `Crowd Control` exposes one spell plus a contextual release/control-management action instead of a second user-facing spell option. Do not implement until the refactor pass for `Crowd Control` is scheduled.
- `CC-PASSIVE-01` Replace the current `Crowd Control` passive/cantrip bonuses with `Crowd Management (CM)`: add `Crowd Control` level directly to `Social` as `+1 / +2 / +3 / +4 / +5` by power level. Do not implement until the replacement pass is scheduled.
- `CC-PASSIVE-02` Add `Compulsion Guard (CG)` as a `Crowd Control` passive unlocked at level `5`: add `Social` skill level to the defense dice pool against control effects. Do not implement until the replacement pass is scheduled.
- `ELM-SPELL-01` Rework `Elementalist` so `Elemental Bolt`, `Elemental Cantrip`, and `Elemental Split` are modeled as separate spells with explicit rules instead of the current merged multi-target `Elemental Bolt` structure. Do not implement until the final spell spec is confirmed.
- `HEAL-SPELL-01` Rework `Healing` to the newer explicit three-spell model instead of the current mixed `Heal` / `Cure` / `Wound Mend` implementation. Target replacement spec:
  - `Heal Living (HL)`: healing-only spell with bleeding removal, `INT + 1/2/3/4/5`, touch at level `1`, standard `25m` at level `2+`, up to `4` targets at level `2`, limb regrowth at level `4`, and once-per-character-per-day overheal capped by target `STAM` at level `5`; mana stays `2`.
  - `Holy Purge (HP)`: separate cleanse spell for poison / disease / curse, unlocked at level `3`, touch at level `3`, range at level `4+`, mana should be `2`.
  - `Healing Touch (HT)`: separate wound-mending spell with bleeding stop, `2/day` per target, healing equal to `ceil(HL / 2)` at levels `3-5`.
  Do not implement until the final Healing spell spec is confirmed.
- `LS-SPELL-01` Rework `Light Support` to the newer explicit four-part model instead of the current compressed `Light Aura` / `Mana Restore` structure. Target replacement spec:
  - `Let There Be Light (LTBL)`: active aura spell with vision-in-darkness support and aura bonuses. Level `1` should be `+1 hit, +1 DR`; levels `2-5` should stay `+2 hit +1 DR`, `+3 hit +1 DR +1 Soak`, `+3 hit +2 DR +1 Soak`, `+4 hit +2 DR +2 Soak`; durations should be `30m / 1h / 2h / 4h / 8h`; ranges `50m / 50m / 50m / 100m / 100m`.
  - `Lunar Bless (LB)`: passive with mana bonus `+1 / +2 / +3 / +4 / +5` by level and staged night-vision support.
  - `Lessen Darkness (LD)`: separate level `5` active effect linked to `LTBL`; darkness/evil creatures in the aura lose one resistance level, including `RL0 -> RL-1`.
  - `Luminous Restoration (LR)`: separate mana-restore spell unlocked at level `3`, restoring `APP / APP x2 / APP x3` at levels `3 / 4 / 5`, with no mana cost.
  Do not implement until the final Light Support spell spec is confirmed.
- `NECRO-SPELL-01` Rework `Necromancy` to the newer explicit `NW / NT / NB / ND` model instead of the current compressed summon-template structure. Target replacement spec:
  - `Non-Living Warriors (NW)` becomes the parent summon power with child summon types `Non-Living Skeleton (NS)`, `Non-Living Skeleton King (NSK)`, and `Non-Living Zombie (NZ)`.
  - Summon constraints should change to `at most 1 active fighter from each subtype`, with shared warrior rules for spawn location, stealth break, initiative timing, necrotic temporary-health interaction, zeroed mental/social stats, and the revised resistance package.
  - `NS`, `NSK`, and `NZ` should use the newer explicit stat / HP / DR / attack / unlock / mana-cost formulas from the newer draft instead of the current simple template progression.
  - `Necrotic Touch (NT)` mostly stays aligned with the newer draft.
  - `Necromancer's Bless (NB)` should replace the current resurrection naming/spec.
  - `Necromancer's Deception (ND)` should replace the current passive/cantrip progression with the newer melee and undead-aggro progression.
  Do not implement until the final Necromancy spell spec is confirmed.
- `SC-SPELL-01` Rework `Shadow Control` to the newer explicit `SS / SW / SWaA / SM / SV / SF` model instead of the current compressed cloak/summon structure. Target replacement spec:
  - `Smoldering Shadow (SS)` should replace the current cloak spell, remove the current intimidation bonus, keep stealth + AC bonuses, and use the newer duration ladder `15m / 30m / 1h / 2h / 4h`.
  - `Shadow Walk (SW)` stays broadly similar with explicit level-based ranges `50 / 75 / 100 / 125m`.
  - `Shadow Walk and Attack (SWaA)` should be added as a separate active spell with surprise / one-attack AC-loss behavior.
  - `Shadow Manipulation (SM)` mostly stays aligned with the current damage spell.
  - `Sleek Visage (SV)` should replace the current cantrip naming for the cosmetic passive line.
  - `Shadow Fighter (SF)` should replace the current `Shadow Soldier` spec with the newer explicit summon rules, stats, and `until destroyed` duration.
  Do not implement until the final Shadow Control spell spec is confirmed.

## Blocked / Deferred
- `B01` Expand the shared item UI into a full item-authoring and multi-target knowledge-sharing flow.
