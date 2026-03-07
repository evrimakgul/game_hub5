# Current Notes

This file tracks active reminders, implementation notes, and known issues that should stay visible while the local-first combat work is in progress.

## Current Implementation Block
- Persist created and updated characters locally.
- Hydrate saved characters into the latest sheet shape when loading local data.
- Store character ownership (`player` vs `dm`) so player sheets and DM-created sheets stay separated.
- Keep active player-sheet selection and active DM-sheet selection separated so DM creation/edit flows never replace the player's currently selected character.
- Keep combat implementation local-only until the real combat engine and both combat dashboards are stable.
- Split DM flow into:
  - DM dashboard
  - DM-side player character access
  - combat dashboard
  - combat encounter page
- Reuse the character-sheet editor for DM-side character creation through the NPC creator flow.
- Use `references/combat_ux_engine_contract.md` as the detailed combat-engine and combat-UI contract while phase `1.1` is in progress.
- Combat UX target is `Solasta` / `Baldur's Gate 3` style interaction without a map layer.
- Combat workflow must stay staged:
  - action family
  - subtype
  - target selection
  - parameters
  - confirm
  - reaction window
  - resolution
  - return to action menu
- New contract-layer files now exist in parallel:
  - `src/types/combatEngine.ts`
  - `src/config/combatReducer.ts`
  - `src/selectors/combatUi.ts`
  - `tests/combatReducer.test.ts`
  - `tests/combatUiSelectors.test.ts`
- The DM combat encounter page is now wired to the new reducer/selectors contract.
- The next combat implementation pass should move the player-side combat panel onto the same reducer/selectors contract and then retire the old manual combat scaffold.
- Deployment-gate reminders once the combat engine is confirmed ready:
  - move the player-side combat panel in `PlayerCharacterPage.tsx` onto the same reducer/selectors contract
  - remove or isolate the old manual combat runtime paths so there is only one active combat flow

## Open Issues To Address Later
- Real combat engine rules are still not complete:
  - initiative must become `DEX + WITS` dice pool with roll-based ordering
  - attack flow must stop depending on manual success/damage entry
  - unarmed / brawl fallback still needs rule-accurate handling
  - T1 mana must move to the clarified governing-stat-based calculation
- Reaction queue order for the first pass:
  - direct targets first
  - in target-selection order
  - only if they still have a legal reaction and remaining reaction resource
- Movement remains a tracked budget only for now; battlefield placement stays verbal between DM and players.
- DM dashboard is still evolving from setup/control shell into the full combat control surface.
- NPC creator is a placeholder route for now.
- Server persistence and realtime remain intentionally deferred until the real local combat flow is stable.
