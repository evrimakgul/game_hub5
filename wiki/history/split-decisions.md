---
title: Split Decisions
topic: history
kind: register
status: active
updated: 2026-04-24
confidence: high
---

## Summary

This is the living register of gaps between current implementation and intended direction. A split stays open until the user explicitly resolves it or implementation closes it.

## Current State

Open splits revalidated on 2026-04-17:

| Split ID | Status | Current State | Source Trail |
| --- | --- | --- | --- |
| `COMBAT-ACT-01` | open | Physical attacks and ranged gear work now, but action cost, timing, weapon speed, and multi-attack throughput are still simplified. This gap is intentionally deferred to the very end of the project and may remain unimplemented. | `references/current_notes.md`, `project_tracking/tasks_todo.md`, thread `5` |
| `DOC-OBJECTIVE-01` | open | `references/project_objective.md` still describes the older manual `Brute Defiance` trigger, while current code, roadmap, and notes reflect the passive version. | `references/project_objective.md`, `references/plan.md`, `references/current_notes.md`, `src/engine/encounterExecutionEngine.ts` |
| `VIEW-PERSONALIZATION-01` | open | The user wants personalized player/DM page design soon, but current code has fixed layouts and no persisted view-profile system yet. | `raw/user-approved/2026-04-24-view-personalization-roadmap.md`, `references/plan.md`, `project_tracking/tasks_todo.md` |

Resolved splits:

| Split ID | Status | Resolution |
| --- | --- | --- |
| `AA-01` | resolved | Inventory `Identify` remains the user-facing `Artifact Appraisal` surface, now granting or refreshing the current canonical item-card revision, appending linked history rows, and using current-revision ownership for hidden bonus visibility. |
| `PLAN-DRIFT-01` | resolved | `references/plan.md`, `references/current_notes.md`, and tracker/wiki pages were reconciled to the implemented `AA-01` state, so the roadmap no longer lags this branch on the current milestone. |
| `KNOW-V2-01` | resolved | The standalone knowledge model now supports DM-authored `place`, `faction`, `story`, and `custom` subjects through `/dm/knowledge`, while the player-side Knowledge Library continues to browse mixed owned revisions. |
| `ITEM-VAL-01` | resolved | Shared items now persist `baseStrength`, computed `anchorValue`, and optional `anchorValueOverride`, with DM-only value authoring/display on the live item surfaces. |
| `UNARMORED-BASELINE-01` | resolved | Clothing / robes remain the existing `Initiative +2, DR +0` chest items, while characters now persist `apparelMode: humanoid | none` and humanoid characters with no chest/body item equipped receive a separate `+3 Initiative` naked-state baseline. |
| `KNOW-HISTORY-01` | resolved | Knowledge moved from history-only storage to standalone revisioned knowledge records plus history links. |
| `ITEM-MODEL-01` | resolved | Embedded sheet item assumptions were replaced by shared standalone item entities with persisted definitions and blueprint-backed instances. |
| `AURA-LIFECYCLE-01` | resolved | Aura spells stayed as aura spells; lifecycle and source-linked cleanup were fixed without inventing a new spell class. |
| `REALTIME-SESSION-01` | resolved | Live DM/player coordination now has optional Supabase-backed auth, session tables, RLS policies, realtime event subscriptions, `/dm/screen`, `/player/session`, secret rolls, sharing, and reward packets. Manual RLS verification remains a follow-up task, not an implementation split. |

## Intended Direction

- `COMBAT-ACT-01`: keep the timing/action-economy idea recorded, but treat it as endgame-only and optional rather than the default next milestone.
- `DOC-OBJECTIVE-01`: reconcile the stale current-state objective doc with the passive `Brute Defiance` behavior already live in code.
- `VIEW-PERSONALIZATION-01`: implement constrained personalized layouts through safe persisted profiles, registered page sections, reversible presets, and auto-design recommendations.

## Key Decisions

- Open splits should remain visible in both domain pages and this register.
- Resolved splits stay recorded here for provenance; they are not deleted.
- Closing a split requires either code landing or explicit user confirmation that intent changed.

## Deferred / Open

- Awaiting eventual user or implementation resolution for: `COMBAT-ACT-01`, `DOC-OBJECTIVE-01`, `VIEW-PERSONALIZATION-01`.

## Sources

- [references/plan.md](../../references/plan.md)
- [references/current_notes.md](../../references/current_notes.md)
- [project_tracking/tasks_todo.md](../../project_tracking/tasks_todo.md)
- [references/session_handoff_2026-03-12.md](../../references/session_handoff_2026-03-12.md)
- [wiki/domains/view-personalization.md](../domains/view-personalization.md)
- [wiki/domains/realtime-sessions.md](../domains/realtime-sessions.md)

## Raw

- [THREAD-4](../../raw/codex-threads/thread-4-019d567a-df4a-70b0-8e63-b2138fa9b337.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)
- [CHATGPT-1](../../raw/chatgpt/2026-04-15-second-brain-for-codex.md)
- [USER-VIEW-PERSONALIZATION-2026-04-24](../../raw/user-approved/2026-04-24-view-personalization-roadmap.md)
- [USER-REALTIME-SESSION-2026-04-24](../../raw/user-approved/2026-04-24-realtime-dm-screen-session.md)

