# Current Notes

This file tracks active reminders, implementation notes, and known issues that should stay visible while the local-first combat work is in progress.

## Current Implementation Block
- Persist created and updated characters locally.
- Hydrate saved characters into the latest sheet shape when loading local data.
- Store character ownership (`player` vs `dm`) so player sheets and DM-created sheets stay separated.
- Keep active player-sheet selection and active DM-sheet selection separated so DM creation/edit flows never replace the player's currently selected character.
- Split DM flow into:
  - DM dashboard
  - DM-side player character access
  - combat dashboard
  - combat encounter page
- Reuse the character-sheet editor for DM-side character creation through the NPC creator flow.

## Open Issues To Address Later
- Real combat engine rules are still not complete:
  - initiative must become `DEX + WITS` dice pool with roll-based ordering
  - attack flow must stop depending on manual success/damage entry
  - unarmed / brawl fallback still needs rule-accurate handling
  - T1 mana must move to the clarified governing-stat-based calculation
- DM dashboard is still evolving from setup/control shell into the full combat control surface.
- NPC creator is a placeholder route for now.
- Server persistence and realtime remain intentionally deferred until the real local combat flow is stable.
