# Game Hub 5 LLM Wiki Index

This is the compiled knowledge layer for `game_hub5`. Current implementation state comes from the codebase and active repo docs. Intended direction comes from the latest approved conversations and tracked decisions.

## Project

Project-level pages track scope, roadmap, and what is already implemented.

| Article | Summary | Updated |
| --- | --- | --- |
| [game-hub5-overview](./project/game-hub5-overview.md) | High-level product, constraints, architecture posture, and source hierarchy. | 2026-04-15 |
| [current-objective-and-roadmap](./project/current-objective-and-roadmap.md) | Current branch objective and the near-term roadmap anchored to canonical docs. | 2026-04-15 |
| [implemented-vs-deferred](./project/implemented-vs-deferred.md) | Snapshot of completed systems versus explicitly deferred work. | 2026-04-15 |

## Runtime

Runtime pages track application structure, persistence, and user-facing navigation.

| Article | Summary | Updated |
| --- | --- | --- |
| [state-and-persistence](./runtime/state-and-persistence.md) | Local-first app state, hydration flow, and persistence boundaries. | 2026-04-15 |
| [ui-and-routes-map](./runtime/ui-and-routes-map.md) | Current route map and the main player/DM interaction surfaces. | 2026-04-15 |

## Domains

Domain pages capture rules and implementation posture for the main game systems.

| Article | Summary | Updated |
| --- | --- | --- |
| [combat-encounter](./domains/combat-encounter.md) | Encounter runtime responsibilities, stable combat behavior, and deferred engine work. | 2026-04-15 |
| [powers-and-casting](./domains/powers-and-casting.md) | Power runtime, cast flow, world-vs-encounter boundaries, and locked source-rule decisions. | 2026-04-15 |
| [items-and-equipment](./domains/items-and-equipment.md) | Shared items, persisted definitions, equipment occupancy, and item knowledge interactions. | 2026-04-15 |
| [knowledge-cards](./domains/knowledge-cards.md) | Revisioned knowledge model, ownership, history linking, and current subject coverage. | 2026-04-15 |
| [world-casting](./domains/world-casting.md) | Out-of-combat casting scope, shared backend path, and known limitations. | 2026-04-15 |

## Workflow

Workflow pages tell Codex how to operate on this repo and this wiki.

| Article | Summary | Updated |
| --- | --- | --- |
| [codex-operating-rules](./workflow/codex-operating-rules.md) | Repo-specific operating policy for implementation and wiki maintenance. | 2026-04-15 |
| [wiki-maintenance](./workflow/wiki-maintenance.md) | Ingest, query, lint, automation, and allowed-write rules for the wiki. | 2026-04-15 |

## History

History pages track provenance, chronology, and unresolved divergence.

| Article | Summary | Updated |
| --- | --- | --- |
| [thread-chronology](./history/thread-chronology.md) | Ordered summary of Codex threads, ChatGPT chats, and their implementation impact. | 2026-04-15 |
| [split-decisions](./history/split-decisions.md) | Open and resolved gaps between current implementation and intended direction. | 2026-04-15 |
