# Database State Model

This document summarizes the initial Supabase schema added in `supabase/migrations/0001_initial_state_schema.sql`.

## Core Rule

- Persist mutable state only.
- Recalculate deterministic values like max HP, AC, initiative, and damage from `src/config/`.

## Tables

### Profiles

- `profiles`
- One row per Supabase auth user.
- Owns player characters through `characters.profile_id`.

### Characters

- `characters`
- Identity, progression, current HP, and current mana.
- Does not store derived stats.

### Character Build State

- `character_core_stats`
- `character_skill_levels`
- `character_known_powers`
- `character_traits`

These tables break the build into normalized rows instead of storing large JSON blobs.

### Items

- `item_templates`
- `inventory_items`

`inventory_items.equipped_slot` is the authoritative equipment state. A partial unique index prevents one character from equipping two items in the same slot.

### Character Runtime State

- `character_status_effects`

The structured effect payload is stored as JSONB so item, power, and combat effects can share one format.

### Combat

- `combat_encounters`
- `combat_participants`
- `combat_tracker`
- `combat_logs`

`combat_tracker` stores the active turn pointer, initiative order, and current action pools. `combat_logs` stores audit-friendly action history.

## Intentional Omissions

The schema does not yet include:

- access control policies
- realtime setup
- conflict-resolution rules for simultaneous combat writes
- auto-generated TypeScript DB types

Those belong to later Phase 3 items.
