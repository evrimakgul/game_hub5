# Powers Alternative Converter Spec

## Purpose

`json_refs/powers_alternative.json` is a good rules-authoring file.
It is not yet the easiest possible file for a runtime engine to consume directly.

This spec defines a converter that reads:

- `json_refs/powers_alternative.json`

and produces a compiled runtime view where:

- each top-level power has one level table
- each level already includes the combined effects of all child abilities active at that level
- parent-child inheritance is already resolved
- integrated features are already merged into their parent
- unavailable abilities do not require special-case traversal at runtime

This spec does not change `powers_alternative.json`.
It defines how to derive a runtime-facing representation from it.

## What "Flatter" Means

"Flatter" means the engine needs fewer lookups to answer a gameplay question.

Example question:

- "What does `Awareness` level 3 do?"

In `powers_alternative.json`, the engine must read multiple child abilities:

- `alerted_self` level 3
- `awakened_insight` level 3
- `assess_character` level 3
- `artifact_appraisal` level 3

Then it must merge them.

In a flatter runtime model, the engine reads one object:

```json
{
  "power_id": "awareness",
  "level": 3,
  "passives": {
    "alertness_bonus": 3,
    "temporary_inspiration_per_session": 1
  },
  "active_options": [
    {
      "ability_id": "assess_character",
      "action": "bonus",
      "mana_cost": 1,
      "range": "line_of_sight",
      "timing": "instant",
      "mechanics": {
        "identify_stats": true,
        "identify_skills": true,
        "identify_powers": true,
        "identify_specials": true,
        "cr_limit_formula": "PER + 3",
        "ignores_techno_infused_invisibility_devices": true
      }
    },
    {
      "ability_id": "artifact_appraisal",
      "action": "bonus",
      "mana_cost": 0,
      "range": "touch",
      "timing": "instant",
      "mechanics": {
        "max_item_quality": "epic"
      }
    }
  ]
}
```

That is what "flatter" means.

## Why Alternative Is Harder For Runtime Today

The alternative file is correct, but runtime code has to do composition work.

### Example: Awareness

To execute or display `Awareness` level 3, the engine must merge four child abilities.

### Example: Light Support

To know everything granted by `Light Support` level 4, the engine must combine:

- `let_there_be_light` level 4
- `lunar_bless` level 4
- `lessen_darkness` level 4
- `luminous_restoration` level 4

Even though only one top-level power is being queried.

### Example: Necromancy

To resolve `Necromancy` level 4, the engine must understand:

- parent container `non_living_warriors`
- child summons `NS`, `NSK`, `NZ`
- separate attack `necrotic_touch`
- passive `necromancers_deception`
- unavailable vs available children at that level

That is good design structure, but it is more runtime work.

## Converter Output Shape

The converter should output a compiled file, for example:

- `json_refs/powers_alternative_compiled.json`

Recommended shape:

```json
{
  "source": {
    "path": "json_refs/powers_alternative.json"
  },
  "schema_version": 1,
  "powers": [
    {
      "id": "awareness",
      "governing_stat": "PER",
      "compiled_levels": []
    }
  ]
}
```

Each `compiled_levels[n]` should contain:

```json
{
  "level": 1,
  "passive_effects": {},
  "active_options": [],
  "summon_options": [],
  "integrated_features": [],
  "notes": []
}
```

## Conversion Rules

### Rule 1: Preserve Top-Level Power Identity

The compiled output keeps the same top-level powers:

- `awareness`
- `body_reinforcement`
- `crowd_control`
- `elementalist`
- `healing`
- `light_support`
- `necromancy`
- `shadow_control`

### Rule 2: Build Exactly Five Compiled Levels Per Power

Each power produces `compiled_levels` for levels `1..5`.

### Rule 3: Merge Passive Children Into `passive_effects`

If a child ability is passive and available at a level, its mechanics go into:

- `passive_effects`

Examples:

- `alerted_self`
- `awakened_insight`
- `crowd_management`
- `lunar_bless`
- `necromancers_deception`
- `sleek_visage`

### Rule 4: Convert Castable Active Children Into `active_options`

If a child ability is active, castable, and available at a level, it becomes one entry in:

- `active_options`

Each entry should contain:

- `ability_id`
- `abbreviation`
- `action`
- `mana_cost` or `mana_cost_variants`
- `range`
- `timing`
- `mechanics`
- `notes`

### Rule 5: Convert Summons Into `summon_options`

If an active child creates a summon, it should appear in:

- `summon_options`

Example structure:

```json
{
  "ability_id": "non_living_skeleton",
  "action": "standard",
  "mana_cost": 2,
  "range": "2.5m",
  "timing": "30 minutes",
  "shared_parent_rules": {
    "parent_ability_id": "non_living_warriors"
  },
  "template": {
    "str_formula": "ceil(NL / 2) + ceil(APP / 2)",
    "dex_formula": "ceil(NL / 2) + ceil(APP / 2)",
    "stam_formula": "ceil(NL / 2) + ceil(APP / 2)",
    "attack_formula": "DEX + 3",
    "damage_formula": "STR + 2"
  }
}
```

### Rule 6: Merge Integrated Features Into Parent Active Option

If a child feature is not separately castable and is integrated into a parent, it should be merged into the matching parent active option.

Current example:

- `light_support.lessen_darkness` level 5 merges into `let_there_be_light` level 5

It should not become a separate runtime action.

### Rule 7: Ignore Unavailable Levels At Runtime

Entries with:

- `available: false`

should not produce runtime actions.

### Rule 8: Parent Containers Do Not Produce Runtime Actions

Entries like:

- `necromancy.non_living_warriors`

with:

- `castable: false`
- `role: "parent_container"`

do not become runtime actions themselves.

Instead, their shared rules are inherited by child summon options.

### Rule 9: Keep Source Formulas Intact

The converter should not solve formulas numerically.
It should preserve formulas as strings unless a later math layer is added.

Examples:

- `PER + 3`
- `ceil(HL / 2)`
- `APP + NL`
- `ceil((3 * NL) / 2) + ceil(APP / 2)`

### Rule 10: Normalize Temporal Mode

Compiled active options should use exactly one timing form:

- `passive`
- `instant`
- `concentration`
- duration string such as `30 minutes`
- sentinel values such as `until_destroyed`

## Power-Specific Mapping Notes

### Awareness

Merge:

- passive `AS`
- passive `AI`
- active `AC`
- active `AA`

into one `compiled_levels[level]`.

### Body Reinforcement

Merge:

- passive `BD`
- active `BP`

### Crowd Control

Merge:

- passive `CM`
- passive `CG`
- active `CE`

### Elementalist

Keep separate active options at each level:

- `EB`
- `EC`
- `ES`

because they are separate castable actions.

### Healing

Keep separate active options:

- `HL`
- `HP`
- `HT`

Passive section is empty for this power.

### Light Support

Merge:

- passive `LB`
- active `LTBL`
- active `LR`

At level 5:

- fold `LD` into `LTBL` as an integrated feature

### Necromancy

Runtime view should usually expose:

- passive effects from `ND`
- active options from `NT` and `NB`
- summon options from `NS`, `NSK`, `NZ`

`NW` should contribute inherited summon rules only.

### Shadow Control

Runtime view should usually expose:

- passive effects from `SV`
- active options from `SS`, `SW`, `SWaA`, `SM`
- summon options from `SF`

## Minimal Example: Light Support Level 5

Compiled target example:

```json
{
  "power_id": "light_support",
  "level": 5,
  "passive_effects": {
    "mana_bonus": 5,
    "night_vision_targets": "self_plus_4"
  },
  "active_options": [
    {
      "ability_id": "let_there_be_light",
      "action": "standard",
      "mana_cost": 2,
      "range": "100m_radius",
      "timing": "8 hours",
      "mechanics": {
        "attack_dice_bonus": 4,
        "damage_reduction_bonus": 2,
        "soak_bonus": 2,
        "provides_vision_in_darkness": true,
        "hostiles_cannot_see_summoned_light": true,
        "lessen_darkness": {
          "resistance_level_delta": -1,
          "affects_damage_categories": [
            "physical",
            "elemental"
          ]
        }
      }
    },
    {
      "ability_id": "luminous_restoration",
      "action": "standard",
      "mana_cost": 0,
      "range": "25m",
      "timing": "instant",
      "mechanics": {
        "restore_mana_formula": "APP * 3"
      }
    }
  ],
  "summon_options": []
}
```

## What Alternative Still Needs To Be A Better Runtime Document

If you wanted `powers_alternative.json` itself to become engine-facing, without a converter, it would need these changes:

1. Add a `compiled_levels` section to every top-level power.
2. Pre-merge passive children by level.
3. Pre-merge integrated child features into their parents.
4. Distinguish runtime actions from design-only containers in a uniform way.
5. Move summon inheritance from parent containers onto explicit summon runtime entries.
6. Make "what can I do at level X?" answerable from one place without traversing child abilities.

That is the core issue.
The alternative is structurally rich, but the engine wants a direct answer table.

## Recommendation

Do not replace the alternative schema.

Instead:

1. Keep `powers_alternative.json` as the clean design-source.
2. Generate a compiled runtime file from it.
3. Let the engine read the compiled file.

