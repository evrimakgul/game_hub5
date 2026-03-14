# Current Notes

This file tracks active reminders and implementation notes for the current branch state.

## Current Implementation Block
- Persist created and updated characters locally.
- Hydrate saved characters into the latest sheet shape when loading local data.
- Store character ownership (`player` vs `dm`) so player sheets and DM-created sheets stay separated.
- Keep active player-sheet selection and active DM-sheet selection separated so DM creation/edit flows never replace the player's currently selected character.
- Keep these flows intact:
  - player hub and player character sheet
  - DM dashboard
  - DM-side player character access
  - DM NPC creator and DM-owned character sheets
  - combat dashboard staging
  - DM combat encounter
- The combat encounter uses a floating roll-helper popover instead of a static helper panel.
- Movement is shown in the character sheet combat summary as `20 + 5`.
  - `20` from standard-action conversion
  - `5` from move action

## Active Power Runtime
- Cast power runtime is active on the DM combat encounter page.
- Completed active slices:
  - `Body Reinforcement` stat buff + delayed revive cantrip
  - `Light Support` aura + mana restore + `Expose Darkness`
  - `Shadow Control` cloak + `Shadow Manipulation` + `Shadow Soldier`
  - `Healing` Lv1-Lv5 + wound-mend cantrip
  - `Assess Character`
  - `Crowd Control`
  - `Elementalist`
  - `Necrotic Touch`
  - `Resurrection`
- Active power effects are stored on locally persisted character records.
- Character sheet and combat encounter both read the same post-effect runtime values.
- `currentMana` defaults to derived max mana until the character spends mana for the first time.

## Shared Runtime Notes
- Permanent and temporary inspiration are already separated.
- Temporary HP is already tracked separately.
- HP must stay capable of going negative.
- `Assess Character` snapshots belong in the caster's character-sheet `Game History`.
- `powerUsageState` is persisted on the sheet and supports daily, long-rest, and per-target tracking.
- Encounter runtime tracks round / active combatant state, transient summons, and maintained encounter-only states.
- Item identification metadata exists on inventory / equipment entries, but `AA` remains deferred until item-authoring design is defined.

## Remaining Active Work
- No active power-mechanics implementation tasks remain on this branch.
- Deferred work remains limited to:
  - `AA`
  - combat encounter history/logger block
  - non-local/runtime scope items

## Deferred
- Add a `History` block to the combat encounter page only after the remaining powers are implemented.
  - 3 visible lines
  - newest first
  - vertical scrollbar
  - bottom-right resize handle
  - short summaries only
- The current branch does not use Supabase at runtime.
