---
title: State And Persistence
topic: runtime
kind: architecture
status: active
updated: 2026-04-15
confidence: high
---

## Summary

`game_hub5` is currently a local-first stateful app. The central runtime owns characters, item definitions, item blueprints, shared item instances, and knowledge records in memory, then persists them to browser storage with best-effort hydration and backup recovery.

## Current State

- `src/state/appFlow.tsx` is the main state hub for characters, item definition records, item blueprints, shared items, knowledge state, and active character selection.
- `src/state/appFlowPersistence.ts` handles read/write to browser storage, starter data backfill, and recovery from malformed or older persisted state.
- `src/config/characterTemplate.ts` contains deep hydration helpers for character drafts, including powers, equipment, knowledge-linked history fields, status tags, and active effects.
- Persistence is intentionally local-only. There is no live backend authority and no realtime sync contract.
- The hydration layer already carries migration burden for older item storage and seeded data evolution.

## Intended Direction

- Keep local-first storage as the active truth until backend work is explicitly reopened.
- Preserve clear separation between persisted mutable data and derived runtime values so later migration stays possible.
- Continue using migration-aware hydration instead of destructive resets when storage shape changes.

## Key Decisions

- Local storage is the current persistence boundary.
- Backup recovery is part of the runtime contract, not an afterthought.
- Seeded item definitions and blueprints may backfill missing persisted data without overwriting same-id user edits.
- Negative HP and richer derived state must survive persistence/hydration.

## Deferred / Open

- Backend sync remains out of scope.
- Encounter persistence beyond the current local runtime remains deferred.
- A future server model will need explicit mutable-vs-derived separation rules if reopened.

## Sources

- [src/state/appFlow.tsx](../../src/state/appFlow.tsx)
- [src/state/appFlowPersistence.ts](../../src/state/appFlowPersistence.ts)
- [src/config/characterTemplate.ts](../../src/config/characterTemplate.ts)
- [references/project_objective.md](../../references/project_objective.md)
- [references/project_risks.md](../../references/project_risks.md)

## Raw

- [THREAD-2.1](../../raw/codex-threads/thread-2.1-019cdf06-a91b-7df2-82ee-50051261f7f4.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)

