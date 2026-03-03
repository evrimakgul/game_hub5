# Change Scope

This branch restarts from the Phase 3 foundation in order to redesign the application structure before continuing implementation.

## In Scope
- Redesign the player character sheet structure, information hierarchy, and interaction model.
- Redesign the combat tracker, turn scheduler, and engine-facing combat flow.
- Rework the UI foundation and page design system before rebuilding later interactive features.
- Re-evaluate the app-side boundaries between stored state, derived state, and combat actions where needed.

## Out of Scope For This Branch
- Character creation flow
- NPC creation tool
- Item creation tool

Those creation tools will be added later, after the redesigned sheet, combat flow, and UI foundation are stable.
