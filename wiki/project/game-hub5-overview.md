---
title: Game Hub 5 Overview
topic: project
kind: overview
status: active
updated: 2026-04-16
confidence: high
---

## Summary

`game_hub5` is a local-first TTRPG hub for player and DM character management, combat encounters, supernatural powers, shared items/equipment, and revisioned knowledge cards. The repo now has enough history and cross-cutting rules that future work benefits from a persistent compiled wiki instead of rediscovering project intent from raw threads each time.

## Current State

- The app is a browser-based React/TypeScript project with route-driven player and DM flows.
- Persistence is local-only and centered in app state plus browser storage.
- Combat encounter corrections, power-rule reconciliation, Knowledge System V1, item-definition refactor, supplementary slots, and World Casting V1 are already implemented.
- `Artifact Appraisal` is now fully integrated on the inventory/world-casting item-knowledge path.
- Shared item entities, persisted item category/subcategory definitions, and revisioned knowledge records are live project concepts, not just planned concepts.
- Canonical non-code project truth currently lives across `references/` and `project_tracking/`, while detailed provenance lives in historical threads and chats.

## Intended Direction

- Keep the product local-first unless backend or sync work is explicitly reopened.
- Preserve the completed combat/power/item/knowledge work and avoid reintroducing removed backend or monolithic-engine assumptions.
- Use this wiki as the durable synthesis layer between raw conversations/docs and future implementation.
- Keep "current implementation state" and "intended direction" separate whenever the code has not yet caught up with the latest decision.

## Key Decisions

- `references/plan.md` remains the authoritative implementation roadmap.
- `references/project_objective.md`, `references/current_notes.md`, and the live codebase define current branch state.
- Latest approved conversation direction outranks older conversation intent, but it does not override current implementation facts.
- `History` remains an event log; durable knowledge belongs in standalone revisioned knowledge records.
- Items are modeled as shared entities outside character sheets, with equip state and knowledge handled separately.

## Deferred / Open

- Full backend sync and encounter persistence remain out of scope.
- Player-side encounter UI is still deferred.
- Knowledge expansion beyond character and item cards remains deferred.
- The future timing/action-economy layer is still deferred.

## Sources

- [references/project_objective.md](../../references/project_objective.md)
- [references/current_notes.md](../../references/current_notes.md)
- [references/project_risks.md](../../references/project_risks.md)
- [project_tracking/tasks_todo.md](../../project_tracking/tasks_todo.md)
- [src/App.tsx](../../src/App.tsx)
- [src/state/appFlow.tsx](../../src/state/appFlow.tsx)

## Raw

- [CHATGPT-1](../../raw/chatgpt/2026-04-15-second-brain-for-codex.md)
- [CHATGPT-1A](../../raw/chatgpt/2026-04-15-second-brain-followup-supplement.md)
- [CHATGPT-2](../../raw/chatgpt/2026-04-15-best-llm-wiki-repo.md)
- [THREAD-4](../../raw/codex-threads/thread-4-019d567a-df4a-70b0-8e63-b2138fa9b337.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)
- [EXT-KARPATHY-GIST](../../raw/external/2026-04-15-karpathy-llm-wiki-gist.md)

