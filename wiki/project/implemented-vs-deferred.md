---
title: Implemented Vs Deferred
topic: project
kind: status
status: active
updated: 2026-04-16
confidence: high
---

## Summary

This page is the compact "what is live versus what is still pending" reference. Use it before assuming a system is still theoretical or still blocked.

## Current State

Implemented and live:

- Local-first character persistence, hydration, and backup recovery.
- DM and player route flows.
- Combat encounter runtime with initiative, parties, effects, summons, and logs.
- Power rewrite/reconciliation for the major current power families.
- Knowledge System V1 with standalone revisioned character and item cards.
- Shared items with persisted category/subcategory definitions and blueprint-backed instances.
- Supplementary slots and anchor-slot occupancy.
- World Casting V1 for a limited set of supported powers.
- `Artifact Appraisal` integration through the inventory shortcut, canonical item-card revision refresh, and linked history-entry flow.

Deferred or partial:

- Knowledge subject expansion beyond character/item.
- Encounter persistence beyond current local runtime.
- Backend sync and realtime assumptions.
- Player-side encounter UI.
- Timing/action-budget engine.

## Intended Direction

- Keep this page updated whenever a domain moves from "planned" to "live" or from "live but partial" to "closed."
- Use it to stop future threads from re-planning already completed passes.
- Resolve partial systems by upgrading them deliberately rather than collapsing them back into old monoliths.

## Key Decisions

- "Deferred" means intentionally not in the current pass, not forgotten.
- "Implemented" means present in current code and reflected in current notes, even if future expansion remains open.
- The repo should preserve current working item, power, and knowledge foundations while later tasks build on them.

## Deferred / Open

- `KNOW-V2-01`
- `ITEM-VAL-01`
- `COMBAT-ACT-01`
- `CHAR-APPAREL-01`
- backend sync
- encounter persistence
- player encounter UI

## Sources

- [references/current_notes.md](../../references/current_notes.md)
- [references/project_objective.md](../../references/project_objective.md)
- [project_tracking/tasks_todo.md](../../project_tracking/tasks_todo.md)
- [project_tracking/new_thread_context.md](../../project_tracking/new_thread_context.md)

## Raw

- [THREAD-4](../../raw/codex-threads/thread-4-019d567a-df4a-70b0-8e63-b2138fa9b337.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)

