# Access Control Model

This document summarizes the access-control migration in `supabase/migrations/0002_access_control.sql`.

## Role Model

- `profiles.app_role = 'player' | 'dm'`
- DM can read and write every gameplay table.
- Players can read only rows tied to their own character state or encounters they participate in.

## Player Write Scope

Players are intentionally restricted to a narrow write surface:

- `characters`
  - may update only `current_hp` and `current_mana` on their own character rows
- `combat_tracker`
  - may update only action availability and spent-action counters
  - only when they own the active combat participant

Everything else is DM-only for now.

## Why Triggers Exist

Postgres row-level security controls which rows a user can touch, but it does not cleanly express "this row is editable, but only these two columns."

For that reason the migration adds guard triggers that reject player updates when they try to change protected columns.

## Deliberate Limits

This phase does not yet solve:

- simultaneous combat writes
- turn advancement ownership
- player inventory writes
- realtime event behavior

Those are part of later Phase 3 items.
