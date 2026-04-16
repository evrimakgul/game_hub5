---
title: Powers And Casting
topic: domains
kind: domain
status: active
updated: 2026-04-15
confidence: high
---

## Summary

The power system is already in a mature state for the currently supported families. Cast UI is standardized, effect resolution is centralized, and world-vs-encounter support is explicit rather than implicit.

## Current State

- Major power/source reconciliation is complete for the currently targeted families recorded in `project_tracking/new_thread_context.md`.
- Cast UI now follows a stable `Power > Spell > ...` flow.
- `src/rules/powerEffects.ts` remains a core rules surface for resolving cast variants and supported environments.
- `src/lib/worldCasting.ts` uses the shared casting core for limited out-of-combat support instead of inventing a separate power system.
- Current notes lock several concrete rules, including:
  - `Heal Living` mana cost `2`
  - `Holy Purge` unlock level `3`, mana cost `2`
  - `Healing Touch` is `2 uses per target per day`
  - `Crowd Control` auto-contest and mana behavior
  - `Shadow Walk` is mobility, not direct numeric damage
  - `Lessen Darkness` is a linked Light Support cast

## Intended Direction

- Keep power behavior aligned to the current authoritative notes and updated source reconciliations.
- Add new power work through the shared runtime path instead of one-off page logic.
- Expand world casting only when the environment rules are explicit and safe.

## Key Decisions

- Aura spells stay modeled as dedicated aura spells.
- Source-linked effect cleanup is preferred over broader spell-class reinvention.
- Unsupported world variants remain visible but unavailable rather than silently disappearing.
- Power behavior should not drift from the current locked rule decisions without explicit user approval.

## Deferred / Open

- Broader out-of-combat casting remains intentionally narrow.
- Hostile, summon, aura, multi-target, and timing-sensitive variants stay encounter-only unless reopened deliberately.
- Future action-economy work may later affect attack/cast timing, but that is separate from the current power-rule baseline.

## Sources

- [references/current_notes.md](../../references/current_notes.md)
- [project_tracking/new_thread_context.md](../../project_tracking/new_thread_context.md)
- [src/rules/powerEffects.ts](../../src/rules/powerEffects.ts)
- [src/lib/worldCasting.ts](../../src/lib/worldCasting.ts)
- [src/powers/awareness.ts](../../src/powers/awareness.ts)
- [src/powers/lightSupport.ts](../../src/powers/lightSupport.ts)

## Raw

- [THREAD-3](../../raw/codex-threads/thread-3-019ce29e-55fb-70b1-913c-5307603ac0f6.md)
- [THREAD-4](../../raw/codex-threads/thread-4-019d567a-df4a-70b0-8e63-b2138fa9b337.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)

