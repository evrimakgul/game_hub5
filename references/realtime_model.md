# Realtime Model

This document summarizes the publication setup in `supabase/migrations/0004_enable_realtime.sql`.

## Subscribed State Tables

The migration adds these mutable gameplay tables to `supabase_realtime`:

- `characters`
- `character_core_stats`
- `character_skill_levels`
- `character_known_powers`
- `character_traits`
- `inventory_items`
- `character_status_effects`
- `combat_encounters`
- `combat_participants`
- `combat_tracker`
- `combat_logs`

## Why These Tables

- Character sheet views need raw state changes so the client can recalculate derived stats immediately.
- Combat views need participant, tracker, and log changes without a manual refresh.
- Static authored data like item templates does not need realtime subscription.

## Replica Identity

The migration sets `replica identity full` on the subscribed tables so Supabase Realtime has complete row data for updates and deletes.
