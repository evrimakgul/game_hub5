---
title: State And Persistence
topic: runtime
kind: architecture
status: active
updated: 2026-04-20
confidence: high
---

## Summary

`game_hub5` is currently a local-first stateful app. The central runtime owns characters, item definitions, item blueprints, shared item instances, auction catalog entries, knowledge records, and the new mob/group/portal authoring records in memory, then persists them to browser storage with best-effort hydration and backup recovery.

## Current State

- `src/state/appFlow.tsx` is the main state hub for characters, item definition records, item blueprints, shared items, auction catalog entries, knowledge state, mob templates, mob groups, portal templates, and active character selection.
- `src/state/appFlowPersistence.ts` handles read/write to browser storage, starter data backfill, and recovery from malformed or older persisted state.
- `src/config/characterTemplate.ts` contains deep hydration helpers for character drafts, including powers, equipment, knowledge-linked history fields, status tags, and active effects.
- Persistence is intentionally local-only. There is no live backend authority and no realtime sync contract.
- The hydration layer already carries migration burden for older item storage and seeded data evolution.
- Auction-house state now seeds from the workbook-derived catalog when old saves do not have an `auctionEntries` collection yet, while newer saves persist their current auction row set directly.
- Auction entries now persist both:
  - original stock/source text in `itemQuantity`
  - live numeric stock in `stockQuantity`
- Hydration now derives `stockQuantity` from older persisted source text such as numeric rows, `out of stock`, and `too many in stock`.
- Completed player auction transactions now mutate three persisted collections together:
  - the character sheet for money, inventory links, and history
  - shared items for the purchased item instance
  - auction entries for decremented stock
- The new authoring content types already use a Supabase-ready row/payload split at the domain layer even though current runtime storage is still browser-local.
- Authoring persistence now carries explicit difficulty metadata:
  - mob challenge rating
  - group target / party-mean challenge rating
  - portal party-mean challenge rating
  - per-stage target challenge rating
- Portal-bundle imports now normalize linked mob/group/portal ids on ingest before they are appended to local authoring state.

## Intended Direction

- Keep local-first storage as the active truth until backend work is explicitly reopened.
- Preserve clear separation between persisted mutable data and derived runtime values so later migration stays possible.
- Continue using migration-aware hydration instead of destructive resets when storage shape changes.
- Preserve the authored-content boundary so `mob_templates`, `mob_groups`, and `portal_templates` can later move behind a repository without redesigning the authoring UI.

## Key Decisions

- Local storage is the current persistence boundary.
- Backup recovery is part of the runtime contract, not an afterthought.
- Seeded item definitions and blueprints may backfill missing persisted data without overwriting same-id user edits.
- Auction-linked shared items persist their source `auctionEntryId` alongside the normal blueprint/item-instance data.
- Auction stock is local-first mutable runtime state, not a recomputed view over the original workbook text.
- Negative HP and richer derived state must survive persistence/hydration.
- Authoring content is persisted as top-level local collections now, but its shape is already being kept compatible with a future `metadata columns + jsonb payload` storage model.

## Deferred / Open

- Backend sync remains out of scope.
- Encounter persistence beyond the current local runtime remains deferred.
- A future server model will need explicit mutable-vs-derived separation rules if reopened.

## Sources

- [src/state/appFlow.tsx](../../src/state/appFlow.tsx)
- [src/state/appFlowPersistence.ts](../../src/state/appFlowPersistence.ts)
- [src/routes/PlayerAuctionHousePage.tsx](../../src/routes/PlayerAuctionHousePage.tsx)
- [src/config/characterTemplate.ts](../../src/config/characterTemplate.ts)
- [references/project_objective.md](../../references/project_objective.md)
- [references/project_risks.md](../../references/project_risks.md)

## Raw

- [THREAD-2.1](../../raw/codex-threads/thread-2.1-019cdf06-a91b-7df2-82ee-50051261f7f4.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)
- [USER-AUCTION-PLAYER-2026-04-20](../../raw/user-approved/2026-04-20-player-auction-house-shopping.md)

