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
  - combat dashboard as the encounter staging page
- The pseudo NPC quick-add path has been removed from the combat dashboard.
- The new combat rebuild starts with encounter start, initiative ordering, and the first DM combat encounter page.
- The current branch does not use Supabase at runtime.
- Old Supabase schema and realtime reference documents have been removed from this branch.
- Reminder for later: add movement info to the character sheet combat summary as `20 + 5`.
  - `20` from standard-action conversion
  - `5` from move action
