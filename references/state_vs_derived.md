# State vs Derived Boundary

## Purpose
This document defines which gameplay values belong in persistent state and which values must be calculated on demand by the client engine.

## Core Rule
- Store only authoritative mutable state in the database.
- Derive computed values from stored state plus deterministic rules in `src/config/`.
- Do not persist a value if it can be recalculated safely from current state and engine rules.

## Store In Database
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

### Character Runtime State
- `current_hp`
- `current_mana`
- Current inspiration or equivalent consumable resources
- Temporary status effects that modify legal actions or survivability

### Inventory And Equipment State
- Inventory item instances owned by a character
- Equipped item instance IDs by slot
- Item quality, rarity, and other authored item properties
- Consumable counts, charges, and durability if those exist in the rules

### Combat State
- Encounter ID
- Combat participant membership
- Initiative order once a combat round has been established
- Active turn pointer
- Remaining action availability for the current turn
- Combat log entries and timestamps

## Derive On The Client
### Progression And Rank
- CR and rank from XP spent using `src/config/xpTables.ts`

### Character Combat Stats
- Max HP from stamina plus modifiers using `src/config/stats.ts`
- Initiative from dex and wits using `src/config/stats.ts`
- Armor Class from dex, athletics, and bonuses using `src/config/stats.ts`
- Ranged bonus dice from perception using `src/config/stats.ts`
- Occult mana bonus from occult level and XP used using `src/config/stats.ts`

### Resolution Results
- Dice pool success totals
- Botch results
- Hit or miss result
- Damage after DR, soak, or resistance

### Aggregated Build Results
- Final derived stat totals after equipment, passive powers, and temporary effects
- Available dice pools for attacks, defenses, and checks
- Any preview value shown before the player confirms an action

## Do Not Store
- `max_hp`
- `armor_class`
- `initiative` as a character-sheet stat outside active combat setup
- Derived damage totals
- Derived dice pools
- Any value that is only a deterministic combination of stored inputs

## Write Model Notes
- The database is authoritative for current mutable state.
- The client engine is authoritative for deterministic calculations.
- Realtime sync should distribute state changes, not replace the rule engine.
- When a stored input changes, the client should recalculate affected derived values immediately.

## Current Gaps
- Item rule definitions are not authored yet in `json_refs/item_rules.json`.
- Power definitions are not authored yet in `json_refs/powers.json`.
- Action-state structure still needs to be formalized in a shared TypeScript type.
