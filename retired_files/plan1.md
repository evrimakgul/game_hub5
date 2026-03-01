# Implementation Plan

## Status
- Current repository state: rules-engine foundation only.
- Existing implemented scope: stat formulas, combat resolution helpers, and XP/CR tables in `src/config/`.
- Missing from the stated target architecture: app scaffold, tests, schemas, Supabase integration, realtime combat state, item definitions, and power definitions.

## Guiding Decisions
- Keep `src/config/` as pure deterministic engine code.
- Store only authoritative mutable state in Supabase.
- Compute derived values on the client from stored state plus engine rules.
- Treat reference JSON and rules text as authoring sources, then transform them into engine-friendly definitions instead of executing raw prose-like data at runtime.

## Phase 1: Lock The Engine Boundary
### Deliverables
- Add a test runner and unit tests for `stats.ts`, `combat.ts`, and `xpTables.ts`.
- Add shared domain types for characters, combatants, items, powers, and turn state.
- Separate pure engine logic from future UI helpers and transport types.

### Exit Criteria
- Current formulas are covered by deterministic tests.
- Core domain entities are typed and reusable across frontend and database layers.
- No UI code depends on ad hoc rule math.

## Phase 2: Model Authoritative Game Data
### Deliverables
- Define machine-readable schemas for item templates, item effects, power definitions, and passive/active effect payloads.
- Create validation rules for authored data so malformed items and powers fail fast.
- Add initial curated data files for a narrow playable subset instead of the whole ruleset.

### Exit Criteria
- At least one starter set of items and powers can be loaded and validated without custom per-entry code.
- Effects are represented as structured data plus engine handlers, not free-text logic.

## Phase 3: Define Persistence And Sync
### Deliverables
- Write the Supabase schema for characters, inventories, equipped items, combat encounters, combat participants, and turn/action state.
- Mark which fields are stored versus derived.
- Define conflict rules for initiative advancement, HP/mana updates, and action consumption.

### Exit Criteria
- Every mutable gameplay field has one clear owner.
- Derived stats are intentionally excluded from persistence.
- Realtime write rules are explicit enough to avoid double-advances and conflicting combat actions.

## Phase 4: Build One Vertical Slice
### Scope
- Character sheet with stored base stats.
- Client-side derived stat calculation.
- Initiative calculation and dice-pool rolling.
- Basic attack resolution with HP updates.

### Deliverables
- Minimal React app shell.
- Character view bound to typed state.
- Combat panel for initiative, hit checks, damage resolution, and turn actions.

### Exit Criteria
- Two connected clients can view the same combat state and see authoritative state changes propagate.
- The slice works end-to-end without inventory or advanced power handling.

## Phase 5: Inventory And Equipment
### Deliverables
- Item Point (PP) tracking.
- Mundane item templates.
- Equip/unequip flow with deterministic stat modifications.
- Validation for illegal equipment states.

### Exit Criteria
- Equipment changes update derived stats correctly.
- Inventory state remains simple and auditable in the database.

## Phase 6: Power System
### Deliverables
- Passive powers that apply persistent modifiers automatically.
- Active powers with cost validation, targeting rules, and effect execution hooks.
- UI actions wired to the same engine functions used by any future automation.

### Exit Criteria
- Powers are clickable, validated, and deterministic.
- Passive and active power logic use the same structured effect model.

## Phase 7: Combat Hardening
### Deliverables
- Turn progression rules and reaction usage.
- Concurrency handling for simultaneous client inputs.
- Audit-friendly event history for combat actions.
- Integration tests for common combat flows and conflict scenarios.

### Exit Criteria
- Combat state transitions are predictable under realtime use.
- Common failure cases are covered by tests.

## Recommended Work Order
1. Tests for current engine modules.
2. Shared domain types.
3. Structured item/power schemas and validators.
4. Supabase schema plus stored-vs-derived mapping.
5. Minimal React app scaffold.
6. End-to-end character/combat vertical slice.
7. Inventory system.
8. Power system.
9. Realtime combat hardening.

## Immediate Next Task
- Implement Phase 1 first. It is the cheapest place to remove ambiguity and it protects every later UI and database decision from rule drift.
