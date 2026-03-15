# Project Objective

## Goal
Keep the app as a local-first TTRPG hub with corrected combat encounter runtime and the first shared item-domain model in place.

## Current Branch Objective
- Preserve existing player flow, DM flow, character sheets, DM NPC creation, and local persistence.
- Keep combat, powers, summons, aura state, turn upkeep, and item usage aligned after the encounter fix pass.
- Leave only explicit deferred UI/backend work for later phases.

## Completed Work

### Combat Encounter
- Correct the current power runtime where encounter behavior is incomplete or wrong.
- Add minimal physical attack resolution.
- Add a minimal encounter activity log to support new clickable actions.
- Keep encounter state local-only.

### Powers
- Preserve working T1 power behavior already present.
- Fix the current defects in:
  - `Shadow Control`
  - `Healing`
  - `Necromancy`
  - `Light Support`
  - `Crowd Control`
  - `Elementalist`
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
- Full item authoring UX and richer `AA` knowledge-sharing UI.
- Encounter persistence and backend sync.
- Player-side encounter UI.
