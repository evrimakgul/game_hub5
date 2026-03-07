# State vs Derived Boundary

## Purpose
This document defines which gameplay values belong in authoritative persisted state and which values should be calculated on demand by frontend logic.

## Core Rule
- Store only authoritative mutable state.
- Derive computed values from stored state plus deterministic rules in `src/config/`.
- Do not persist a value if it can be recalculated safely from current state and rules.
- Current branch implementation uses browser-local storage, not a database.

## Persist As Authoritative State
### Character Identity
- `character_id`
- `profile_id`
- `display_name`
- `is_player_character`

### Character Build State
- Base stat levels
- Skill levels
- Power levels learned
- Trait, merit, and flaw selections
- XP spent or equivalent progression inputs

### Character Resource State
- `current_hp`
- `current_mana`
- Current inspiration or equivalent consumable resources
- Current positive and negative karma

These are **not derived values**. They are mutable runtime resources.  
Example: a character's `max_hp` may be derived from stamina and bonuses, but `current_hp` changes as damage and healing happen during play. The same logic applies to `current_mana`.

### Inventory And Equipment State
- Inventory item instances owned by a character
- Equipped item instance IDs by slot
- Item quality, rarity, and other authored item properties
- Consumable counts, charges, and durability if those exist in the rules

## Derive On The Client
### Progression And Rank
- CR and rank from XP spent using `src/config/xpTables.ts`

### Character Combat Stats
- Max HP from stamina plus modifiers using `src/config/stats.ts`
- Max Mana from governing-power rules, occult bonuses, item bonuses, and similar formulas once those rules are defined
- Initiative from dex and wits using `src/config/stats.ts`
- Armor Class from dex, athletics, and bonuses using `src/config/stats.ts`
- Ranged bonus dice from perception using `src/config/stats.ts`
- Occult mana bonus from occult level and XP used using `src/config/stats.ts`
- Final stat and skill totals after gear and buff sources are applied

### Resolution Results
- Dice pool success totals
- Botch results
- Any future hit or miss result
- Any future damage result after defenses or resistances

### Aggregated Build Results
- Available dice pools for checks
- Any preview value shown before the player confirms an action

## Do Not Store
- `max_hp`
- `max_mana`
- `armor_class`
- `initiative` as a character-sheet summary value
- Derived damage totals
- Derived dice pools
- Any value that is only a deterministic combination of stored inputs

## Deferred For Later Redesign
- Combat encounter state
- Combat action tracking
- Realtime synchronization
- Access-control or server write models

Those are intentionally undefined on this branch until a new combat engine and backend plan are created.
