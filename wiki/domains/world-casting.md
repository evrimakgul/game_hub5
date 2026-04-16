---
title: World Casting
topic: domains
kind: domain
status: active
updated: 2026-04-15
confidence: high
---

## Summary

World Casting V1 is intentionally narrow. It reuses the shared casting backend, supports a limited set of variants outside combat, and keeps unsupported variants visible but unavailable instead of pretending the world environment is feature-complete.

## Current State

- `src/lib/worldCasting.ts` validates target eligibility, prepares world-cast requests through the shared casting pipeline, and handles `Artifact Appraisal` item-card reveal behavior.
- Current notes list World Casting V1 support for:
  - `Assess Entity`
  - `Body Reinforcement`
  - `Healing Touch`
  - `Luminous Restoration`
- Inventory `Identify` in `CharacterInventorySection` routes through the shared world-casting backend for `Artifact Appraisal`.
- World casting respects environment support explicitly; unsupported variants return unavailable/error states.

## Intended Direction

- Keep world casting narrow until each additional power has explicit non-combat rules.
- Continue sharing as much logic as possible with the encounter casting pipeline.
- Expand `Artifact Appraisal` only on top of the live world/item-knowledge path, not through a disconnected special-case UI.

## Key Decisions

- World and encounter casting should share a backend path where possible.
- Unsupported world variants stay visible but unavailable.
- `Artifact Appraisal` reveal behavior works through knowledge-card ownership, not a separate ad hoc identify state.

## Deferred / Open

- Full `AA-01` interaction expansion remains open.
- General out-of-combat casting remains intentionally limited.
- Hostile, summon, aura, multi-target, and timing-sensitive world variants remain unsupported.

## Sources

- [references/current_notes.md](../../references/current_notes.md)
- [src/lib/worldCasting.ts](../../src/lib/worldCasting.ts)
- [src/components/player-character/CharacterInventorySection.tsx](../../src/components/player-character/CharacterInventorySection.tsx)
- [references/project_objective.md](../../references/project_objective.md)

## Raw

- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)

