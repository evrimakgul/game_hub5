# Project Objective

## Goal
Keep the app as a local-first TTRPG hub and preserve the completed Phase 1 combat encounter corrections without regressing the shared item-domain model.

## Current Branch Objective
- Preserve existing player flow, DM flow, character sheets, DM NPC creation, and local persistence.
- Keep combat, powers, summons, aura state, turn upkeep, and item usage aligned after the completed Phase 1 encounter correction pass.
- Preserve the completed follow-up work for:
  - `Derived Summary` consolidation
  - automatic loadout-driven physical attacks
  - manual `Body Reinforcement` encounter trigger
- Leave only explicit deferred reminder or blocked work for later phases.

## Baseline Already Present

### Combat Encounter
- Combat encounter page, initiative ordering, parties, transient summons, ongoing maintained states, automatic physical attacks, and encounter activity log are already in place.
- The latest correction pass closed the remaining actionable combat encounter defects and mismatches for this phase.

### Powers
- Preserve working T1 power behavior already present.
- The latest pass completed:
  - encounter log label fixes
  - `Shadow Soldier` mana correction
  - `Crowd Control` auto-contest
  - undead healing / necrotic inversion
  - summon aura inheritance
  - integrated Light Aura level `5` enemy debuffing
  - encounter status-display cleanup
- Keep `AC` snapshots on the character sheet history.

### Items
- Replace embedded sheet item records with standalone shared item entities.
- Separate:
  - item definition
  - ownership / possession
  - equipped or active usage
  - per-character bonus knowledge
- Keep the first item phase focused on domain model, rules, storage shape, and engine alignment.

## Constraints
- Negative HP must remain valid and visible.
- Preserve source references under `references/originals/` and derived JSON files.
- Do not reintroduce backend or realtime assumptions.
- Do not overbuild UI when a domain/rules layer is sufficient.

## Deferred Follow-Up
- `ARCH-REM-01` controller/engine extraction from `CombatEncounterPage.tsx`.
- Full item authoring UX and richer `AA` knowledge-sharing UI.
- Encounter persistence and backend sync.
- Player-side encounter UI.
