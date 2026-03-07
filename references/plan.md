# Roadmap Reset v3 (Local-First Real Combat)

This roadmap is the active implementation source of truth for the current branch.

## Ground Rule
- All character, combat, and dashboard work stays local-only until the real combat engine and the real DM/player combat dashboards are complete and validated.
- Supabase persistence and realtime are deferred until after the gameplay-facing local implementation is stable.
- The current combat runtime and DM page are a scaffold baseline, not the acceptance target.

## Phase 0 - Plan Alignment
0.1 Update roadmap and reference notes to match the local-first combat-first direction.
0.2 Keep only the scaffold pieces that support the target system; replace any manual harness behavior that conflicts with gameplay goals.
0.3 Record rule clarifications in references when implementation exposes missing or conflicting mechanics.

## Phase 1 - Real Combat Engine Foundations
1.1 Define rule-accurate local combat runtime types and command model.
    - Combatants, ownership, action windows, reaction windows, movement budget, encounter flags.
    - Formalize the combat UX + engine contract in `references/combat_ux_engine_contract.md` before UI rewrites.
    - Implement the new contract layer in this order: types, reducer/state machine, selectors, tests.
    - Store staged workflow state explicitly: action family, subtype, targets, parameters, step, and controller.
1.2 Implement the initiative engine.
    - `DEX + WITS` defines the initiative dice pool.
    - Rolls determine the initiative order.
    - Tie handling stays deterministic.
1.3 Implement the turn scheduler and DM override controls in engine state.
    - Surprise actions.
    - Free rounds.
    - Manual initiative reorder.
1.4 Keep all combat legality and action-economy enforcement in engine code only.

## Phase 2 - Real Combat Resolution
2.1 Implement engine-resolved attack models.
    - Weapon attacks.
    - Unarmed / brawl fallback when no weapon is equipped.
2.2 Implement defense and damage resolution.
    - Hit / miss.
    - DR.
    - Soak.
    - Resistance.
2.3 Implement action-specific constraints.
    - Standard / bonus / move / reaction / free.
    - Legal target and range hooks.
    - Movement spending.
2.4 Emit deterministic combat log events from every state transition.

## Phase 3 - Power Mechanics In Combat
3.1 Implement the T1-only mana model for local runtime.
    - Base mana = sum of `(power level + current governing stat)` across known T1 powers.
    - Add occult, item, and other bonuses on top.
3.2 Implement passive and active power execution through structured mechanics.
3.3 Implement maintenance, expiration/removal, and effect-driven derived updates.
3.4 Keep prose descriptions DM-facing only; engine uses structured fields.

## Phase 4 - Real DM Dashboard
4.1 Build DM access to every combatant and combat menu at all times.
4.2 Build encounter start flow and initiative management UI around engine commands.
4.3 Build DM controls for attack, move, cast, reaction prompts, and override actions.
4.4 Build combat event log and combat finalization off engine events only.
4.5 Keep the dashboard as a trigger/control surface; no rule math lives in UI components.

## Phase 5 - Player Combat Dashboard
5.1 Activate a combat UI from the player character sheet when combat starts.
5.2 Show only legal actions for the current state.
    - If it is the character's turn: all legal actions.
    - If it is not the character's turn: free actions only.
    - If the character is being targeted and eligible: reaction prompt before resolution.
5.3 Provide contextual action menus.
    - Move: remaining movement and entered amount.
    - Attack: legal attack options.
    - Cast: legal powers, targets, and costs.
5.4 Keep character sheet and combat dashboard views consistent with the same engine state.

## Phase 6 - Persistence Handoff (After Engine + Dashboards)
6.1 Keep local-first until phases 1 through 5 are stable.
6.2 Introduce storage adapters under stable engine contracts.
6.3 Add Supabase-backed persistence and realtime without changing engine behavior.

## Validation
- Initiative validation: `DEX + WITS` defines the dice pool, rolls define order, and DM overrides remain legal and traceable.
- Combat validation: turn progression, action legality, movement spending, hit/miss resolution, and damage mitigation remain deterministic.
- Power validation: T1 mana, passive effects, active effects, maintenance, and expiration/removal all resolve through engine rules.
- DM dashboard validation: every combat trigger operates through engine commands and DM can inspect or control any combatant at any time.
- Player combat validation: only legal actions are surfaced and reaction prompts appear at the correct timing window.
- Persistence validation: Supabase integration changes storage only, not gameplay behavior.
