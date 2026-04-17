---
title: Items And Equipment
topic: domains
kind: domain
status: active
updated: 2026-04-16
confidence: high
---

## Summary

The item system has already crossed the important architecture boundary: items are shared standalone records with persisted definitions and blueprint-backed instances. Equipment occupancy, combat resolution, and item knowledge all build on that shared model.

## Current State

- `src/lib/items.ts` defines default persisted item category/subcategory definitions, blueprint records, and shared item behavior helpers.
- `src/mutations/characterItemMutations.ts` handles equip/unequip behavior, anchor slots, and occupied-slot normalization.
- `src/state/appFlow.tsx` and `src/state/appFlowPersistence.ts` persist item definitions, blueprints, instances, and migration/backfill behavior.
- Supplementary `orbital`, `earring`, and `charm/talisman` slots are live and per-character activatable.
- Item knowledge cards exist as standalone knowledge revisions keyed by shared item id.
- Inventory `Identify` now completes `Artifact Appraisal` on top of the same item-card system, granting or refreshing the current canonical item-card revision and appending linked history rows.
- Locked current item behavior includes:
  - PP-driven tiering
  - `unarmed` versus `brawl` distinction
  - shields resolving to secondary hand
  - anchor-slot canonical occupancy
  - crossbow armor penetration reducing DR during physical attack resolution
  - hidden item bonus visibility keyed to ownership of the current item-card revision rather than any stale older revision

## Intended Direction

- Preserve the shared-item architecture and do not regress to embedded sheet item records.
- Keep DM authoring centered on persisted category/subcategory definitions, blueprints, and item instances.
- Expand item UX and knowledge flows incrementally on top of the live shared model.

## Key Decisions

- Shared item entities, ownership/possession, equip state, and bonus knowledge are separate concepts.
- Persisted item category/subcategory definitions drive equip behavior.
- Multi-slot occupancy resolves through anchor-slot logic.
- Item-card visibility should key off owned current knowledge, not a separate raw identify flag or stale revision ownership.

## Deferred / Open

- `ITEM-VAL-01` persisted value field remains deferred.
- Full item-authoring UX polish remains open even though the core architecture is live.

## Sources

- [references/current_notes.md](../../references/current_notes.md)
- [project_tracking/new_thread_context.md](../../project_tracking/new_thread_context.md)
- [src/lib/items.ts](../../src/lib/items.ts)
- [src/mutations/characterItemMutations.ts](../../src/mutations/characterItemMutations.ts)
- [src/routes/DmItemDefinitionManagementPage.tsx](../../src/routes/DmItemDefinitionManagementPage.tsx)
- [src/routes/DmItemInteractionsPage.tsx](../../src/routes/DmItemInteractionsPage.tsx)
- [src/lib/combatEncounterPhysicalAttacks.ts](../../src/lib/combatEncounterPhysicalAttacks.ts)

## Raw

- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)

