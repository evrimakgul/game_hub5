---
title: View Personalization
topic: domains
kind: roadmap
status: planned
updated: 2026-04-24
confidence: high
---

## Summary

View personalization is a planned near-term system for letting players and DMs tailor their pages without breaking game rules, hidden-information boundaries, or mobile usability. The intended direction is constrained personalization: safe tokens, registered page sections, reversible presets, and automatic recommendations rather than arbitrary page building.

## Current State

- No `ViewProfile` model exists yet.
- No persisted page personalization or layout preference collection exists yet.
- Current player and DM pages use fixed layouts and shared app styling.
- Player combat already has hidden-information rules that future customization must preserve:
  - masked opponent names
  - health bars without raw enemy HP
  - AE-based reveal only when the viewing character owns the relevant knowledge

## Intended Direction

- Implement `VIEW-PERSONALIZATION-01` as the next planned follow-up.
- Start with a persisted browser-local `ViewProfile` foundation.
- Add safe manual customization before automatic design.
- Use a page-section registry so each page declares which sections are required, optional, hideable, reorderable, collapsible, or required during active combat.
- Add presets before auto-design so recommendations remain explainable and reversible.
- Auto-design should recommend a preset plus registered layout adjustments from role, page, character powers, inventory emphasis, combat participation, and later usage patterns.

## Key Decisions

- Personalization must never reveal hidden combat data, hidden item bonuses, hidden knowledge, raw opponent HP, or masked identities.
- Required live-combat information cannot be hidden.
- V1 must not allow arbitrary user JavaScript or unrestricted CSS.
- Mobile layouts need stricter layout rules than desktop.
- Personalization remains browser-local until backend/user accounts are reopened.
- The first implementation page should be the player character sheet, followed by player combat, player auction house, DM dashboard, DM combat encounter, and DM authoring pages.

## Deferred / Open

- `VIEW-PERSONALIZATION-01A` ViewProfile foundation.
- `VIEW-PERSONALIZATION-01B` Appearance/Layout drawer and safe manual controls.
- `VIEW-PERSONALIZATION-01C` Page layout registry.
- `VIEW-PERSONALIZATION-01D` Reversible role/page presets.
- `VIEW-PERSONALIZATION-01E` Auto-design recommendations.
- `VIEW-PERSONALIZATION-01F` Guardrail enforcement.

## Sources

- [references/plan.md](../../references/plan.md)
- [references/current_notes.md](../../references/current_notes.md)
- [project_tracking/tasks_todo.md](../../project_tracking/tasks_todo.md)
- [src/routes/PlayerCharacterPage.tsx](../../src/routes/PlayerCharacterPage.tsx)
- [src/routes/PlayerCombatPage.tsx](../../src/routes/PlayerCombatPage.tsx)

## Raw

- [USER-VIEW-PERSONALIZATION-2026-04-24](../../raw/user-approved/2026-04-24-view-personalization-roadmap.md)
