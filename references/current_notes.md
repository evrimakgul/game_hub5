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
  - combat dashboard as a roster/setup page
- The pseudo NPC quick-add path has been removed from the combat dashboard.
- The combat encounter button is intentionally inactive on this branch.
- The current combat engine and combat encounter UI have been removed from this branch.
- The current branch does not use Supabase at runtime.
- Old Supabase schema and realtime reference documents are being removed from this branch.
