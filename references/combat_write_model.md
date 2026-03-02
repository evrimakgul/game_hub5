# Combat Write Model

This document summarizes the conflict rules added in `supabase/migrations/0003_combat_conflict_rules.sql`.

## Ownership Rules

- DM owns encounter setup and turn advancement.
- The active participant owner may spend only their own current turn actions.
- Direct player updates to `combat_tracker` are no longer the primary write path.

## Conflict Rule

- `combat_tracker.revision` is the concurrency token.
- Combat write functions require `expected_revision`.
- If the caller submits stale state, the function rejects the write instead of silently overwriting a newer turn state.

## Write API

- `consume_combat_action(encounter_id, requested_action, expected_revision)`
  - uses a row lock
  - validates the caller
  - applies the same substitution rules as `src/config/actions.ts`
- `advance_combat_turn(encounter_id, expected_revision)`
  - DM only
  - uses a row lock
  - advances to the next active participant
  - resets the new turn's action pool

## Why This Exists

Without an explicit write model, two clients can read the same turn state and both submit updates based on stale data. Row locks serialize the actual write, and the revision check rejects stale writes instead of allowing silent desync.
