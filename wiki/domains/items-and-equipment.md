---
title: Items And Equipment
topic: domains
kind: domain
status: active
updated: 2026-04-20
confidence: high
---

## Summary

The item system has already crossed the important architecture boundary: items are shared standalone records with persisted definitions and blueprint-backed instances. Equipment occupancy, combat resolution, item knowledge, and now player auction shopping all build on that shared model.

## Current State

- `src/lib/items.ts` defines default persisted item category/subcategory definitions, blueprint records, and shared item behavior helpers.
- `src/mutations/characterItemMutations.ts` handles equip/unequip behavior, anchor slots, and occupied-slot normalization.
- `src/state/appFlow.tsx` and `src/state/appFlowPersistence.ts` persist item definitions, blueprints, instances, and migration/backfill behavior.
- Supplementary `orbital`, `earring`, and `charm/talisman` slots are live and per-character activatable.
- Shared items now persist `baseStrength`, computed `anchorValue`, and optional `anchorValueOverride` as item-instance fields.
- Shared items may now also retain an `auctionEntryId` source link when they were auto-created from the auction-house catalog.
- Shared items purchased from the player auction house are created as normal shared item instances, assigned directly to the buying character, and appear on the character sheet through the normal `ownedItemIds` / `inventoryItemIds` references.
- `clothing / robes` remain real body-slot item blueprints with `Initiative +2, DR +0`; they are not replaced by the later naked-state baseline rule.
- Item knowledge cards exist as standalone knowledge revisions keyed by shared item id.
- DM tooling now includes `/dm/auction-house`, which browses seeded or pasted auction rows and turns them into shared item drafts.
- Player tooling now includes `/player/auction-house`, which lets a selected player character complete `Bid` and `Buyout` transactions against live stock and character money.
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
- Keep item value as instance data and use it later as the stable auction/trade anchor rather than blueprint metadata.
- Treat auction-house auto-creation as a draft-authoring accelerator: infer the nearest blueprint safely, then let DM editing remain the authoritative step for structured mechanics.
- Treat player auction shopping as another shared-item acquisition path, not as a separate lightweight inventory type.
- Keep the distinction clear between chest items and character-level unarmored baseline rules: clothing is still an item, while humanoid naked-state initiative is character logic.

## Key Decisions

- Shared item entities, ownership/possession, equip state, and bonus knowledge are separate concepts.
- Persisted item category/subcategory definitions drive equip behavior.
- Multi-slot occupancy resolves through anchor-slot logic.
- Item-card visibility should key off owned current knowledge, not a separate raw identify flag or stale revision ownership.
- Auction purchases should land in the exact same shared-item architecture as DM-created or manually assigned items.

## Deferred / Open

- Full rule-complete parsing of auction-house bonus text into structured mechanics remains open even though the catalog browser and draft creation flow are live.
- Player-side bidding does not yet model pending bids, timers, or losing bids; the current route only resolves completed winning bids.

## Sources

- [references/current_notes.md](../../references/current_notes.md)
- [project_tracking/new_thread_context.md](../../project_tracking/new_thread_context.md)
- [src/lib/items.ts](../../src/lib/items.ts)
- [src/mutations/characterItemMutations.ts](../../src/mutations/characterItemMutations.ts)
- [src/routes/DmItemDefinitionManagementPage.tsx](../../src/routes/DmItemDefinitionManagementPage.tsx)
- [src/routes/DmItemInteractionsPage.tsx](../../src/routes/DmItemInteractionsPage.tsx)
- [src/routes/DmAuctionHousePage.tsx](../../src/routes/DmAuctionHousePage.tsx)
- [src/routes/PlayerAuctionHousePage.tsx](../../src/routes/PlayerAuctionHousePage.tsx)
- [src/lib/combatEncounterPhysicalAttacks.ts](../../src/lib/combatEncounterPhysicalAttacks.ts)

## Raw

- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)
- [USER-AUCTION-PLAYER-2026-04-20](../../raw/user-approved/2026-04-20-player-auction-house-shopping.md)

