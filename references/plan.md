# Master Implementation Plan

## PHASE 0 - Preparations (Data & Design)
0.1 Convert text rules to JSON references (authoritative text layer)
    - `json_refs/basic_rules.json` (Done)
    - `json_refs/item_rules.json`
    - `json_refs/powers.json`
0.2 Document the "State vs Derived" boundary
    - **State (DB):** Base stats, skill/power levels, inventory IDs, current HP/Mana, action state.
    - **Derived (Client):** Max HP, AC, Initiative, dice pools, calculated damage.
0.3 Sketch UI wireframes (Mobile-friendly Player Sheet + Desktop DM Dashboard).

## PHASE 1 - Domain Types & Engine Core
1.1 Define Shared TypeScript Types (`src/types/`)
    - Define exact shapes for `Character`, `Item`, `Power`, and `TurnState`.
    - These types will be the absolute law for both your UI and your Database.
1.2 Define Structured Effect Schemas *(from Plan 1)*
    - Define how a passive/active effect payload looks so the engine can read it (e.g., `{ target: "str", value: 2, type: "flat" }`).
1.3 Add Engine Tests
    - Add unit tests for `xpTables.ts`, `stats.ts`, `combat.ts`, and future `actions.ts`.
    - Use a few known rule examples so math regressions are obvious.
1.4 Engine Logic (`src/config/`)
    - `xpTables.ts` (Done)
    - `stats.ts` (Done)
    - `combat.ts` (Done)
    - `actions.ts` (Generate next)

## PHASE 2 - Project Initialization
2.1 Create Vite React TS app (`npm create vite@latest`)
2.2 Install dependencies: `supabase-js`, `react-router-dom`, `zustand`
2.3 Create Supabase client file and set up environment variables.

## PHASE 3 - Database Setup (Guided by Phase 1 Types)
3.1 Create Tables based strictly on the "State" defined in 0.2:
    - `profiles` (Auth link)
    - `characters` (State only)
    - `items` (Templates and equipped instances)
    - `combat_tracker` (Initiative order, active turn)
    - `combat_logs` (Audit-friendly history of actions) *(from Plan 1)*
3.2 Define Access Control Rules
    - Set up Postgres policies so players can only edit their own HP/Actions, while the DM can edit anything.
3.3 Define Realtime Conflict Rules *(from Plan 1)*
    - Decide who is allowed to advance turns, consume actions, and resolve simultaneous combat writes.
    - Make combat state ownership explicit so two clients cannot progress the same turn differently.
3.4 Enable Supabase Realtime for necessary tables.

## PHASE 4 - Read-Only UI (Vertical Slice)
4.1 Login / Auth Screen.
4.2 Player Sheet (Read-Only):
    - Fetch raw STATE from Supabase -> Pass to `src/config/` engine -> Render DERIVED stats.
4.3 DM Dashboard (Read-Only):
    - View all characters and the basic combat list.

## PHASE 5 - Interactive UI (Write Actions)
5.1 Inventory Flow: Equip/Unequip items (updates DB state, UI instantly recalculates derived stats).
5.2 Health Flow: Apply damage/healing (updates `current_hp` in DB).
5.3 Action Flow: Toggle Standard/Bonus/Move actions (updates `action_state` via `actions.ts` logic).

## PHASE 6 - Powers & Advanced Effects *(from Plan 1)*
6.1 Passive Powers: Wire permanent buffs to auto-apply to the derived stats engine.
6.2 Active Powers: Create clickable actions that validate costs (Mana/Action), execute the effect, and update DB State.

## PHASE 7 - Realtime Combat Hardening *(from Plan 1)*
7.1 Subscribe React components to `postgres_changes`.
7.2 Combat Log: Write a string to `combat_logs` every time `combat.ts` resolves a hit/damage.
7.3 Turn Progression: Handle Initiative sorting and "Next Turn" logic.
7.4 Playtest: Ensure two clients seeing the same combat don't desync when buttons are clicked simultaneously.

## PHASE 8 - Deployment
8.1 Push to GitHub.
8.2 Deploy to Vercel (add Supabase URL/Key to Vercel Env Vars).
8.3 Final live playtest.
