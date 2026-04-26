---
title: Implemented Vs Deferred
topic: project
kind: status
status: active
updated: 2026-04-24
confidence: high
---

## Summary

This page is the compact "what is live versus what is still pending" reference. Use it before assuming a system is still theoretical or still blocked.

## Current State

Implemented and live:

- Local-first character persistence, hydration, and backup recovery.
- DM and player route flows.
- Optional Supabase-backed live sessions with Auth, DM Screen, Player Session, persistent events, secret rolls, sharing, and reward packets.
- Combat encounter runtime with initiative, parties, effects, summons, and logs.
- Player combat mode with masked initiative/party/activity views, AE-based opponent reveal, local shared encounter state, and own-turn action controls for the viewing character.
- Power rewrite/reconciliation for the major current power families.
- Knowledge System V1 with standalone revisioned character and item cards.
- Knowledge subject expansion for DM-authored place, faction, story, and custom cards through the DM Knowledge Hub.
- Shared items with persisted category/subcategory definitions and blueprint-backed instances.
- Shared-item value fields with DM-authored `baseStrength`, computed `anchorValue`, and optional `anchorValueOverride`.
- Character-level unarmored baseline handling through `apparelMode: humanoid | none`, with a `+3 Initiative` naked-state bonus only for humanoids who have no chest/body item equipped.
- Standalone DM authoring for:
  - mob templates
  - mob CR control plus live derived-combat summary
  - reusable mob groups
  - group target/party-mean CR control
  - portal templates with nested stages
  - portal/stage difficulty controls
  - manual Codex request-packet import/export, now including portal-first `portal_bundle` imports
- Supplementary slots and anchor-slot occupancy.
- World Casting V1 for a limited set of supported powers.
- `Artifact Appraisal` integration through the inventory shortcut, canonical item-card revision refresh, and linked history-entry flow.

Deferred or partial:

- Encounter persistence beyond current local runtime for offline/dev mode.
- General backend sync outside the live-session layer.
- Full portal-run state / boss-clear reward automation / exit unlocking.
- Broader player combat participation beyond the current own-turn action surface.
- Personalized player/DM page design through `VIEW-PERSONALIZATION-01`.
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

- `COMBAT-ACT-01`
- general backend sync outside configured live sessions
- encounter persistence
- broader player combat participation beyond own-turn controls
- `VIEW-PERSONALIZATION-01`
- `REPO-CLEANUP-01`

## Sources

- [references/current_notes.md](../../references/current_notes.md)
- [references/project_objective.md](../../references/project_objective.md)
- [project_tracking/tasks_todo.md](../../project_tracking/tasks_todo.md)
- [project_tracking/new_thread_context.md](../../project_tracking/new_thread_context.md)
- [wiki/domains/view-personalization.md](../domains/view-personalization.md)
- [wiki/domains/realtime-sessions.md](../domains/realtime-sessions.md)

## Raw

- [THREAD-4](../../raw/codex-threads/thread-4-019d567a-df4a-70b0-8e63-b2138fa9b337.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)
- [USER-VIEW-PERSONALIZATION-2026-04-24](../../raw/user-approved/2026-04-24-view-personalization-roadmap.md)
- [USER-REALTIME-SESSION-2026-04-24](../../raw/user-approved/2026-04-24-realtime-dm-screen-session.md)

