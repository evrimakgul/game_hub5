---
title: Split Decisions
topic: history
kind: register
status: active
updated: 2026-04-16
confidence: high
---

## Summary

This is the living register of gaps between current implementation and intended direction. A split stays open until the user explicitly resolves it or implementation closes it.

## Current State

Open splits:

| Split ID | Status | Current State | Source Trail |
| --- | --- | --- | --- |
| `AA-01` | open | Inventory `Identify` and item-card reveal already route through shared world-casting and item-knowledge plumbing, but the full `Artifact Appraisal` interaction flow is not done. | `references/current_notes.md`, `project_tracking/tasks_todo.md`, thread `6` |
| `KNOW-V2-01` | open | Knowledge cards are live for character and item subjects only. | `references/current_notes.md`, `project_tracking/tasks_todo.md`, threads `4` and `6` |
| `COMBAT-ACT-01` | open | Physical attacks and ranged gear work now, but action cost, timing, weapon speed, and multi-attack throughput are still simplified. | `references/current_notes.md`, `project_tracking/tasks_todo.md`, thread `5` |
| `PLAN-DRIFT-01` | open | `references/plan.md` remains authoritative, but some earlier unfinished items have already been completed in code and current notes. | `references/plan.md`, `references/current_notes.md`, `references/session_handoff_2026-03-12.md` |
| `DOC-OBJECTIVE-01` | open | `references/project_objective.md` still describes the older manual `Brute Defiance` trigger, while current code, roadmap, and notes reflect the passive version. | `references/project_objective.md`, `references/plan.md`, `references/current_notes.md`, `src/engine/encounterExecutionEngine.ts` |

Resolved splits:

| Split ID | Status | Resolution |
| --- | --- | --- |
| `KNOW-HISTORY-01` | resolved | Knowledge moved from history-only storage to standalone revisioned knowledge records plus history links. |
| `ITEM-MODEL-01` | resolved | Embedded sheet item assumptions were replaced by shared standalone item entities with persisted definitions and blueprint-backed instances. |
| `AURA-LIFECYCLE-01` | resolved | Aura spells stayed as aura spells; lifecycle and source-linked cleanup were fixed without inventing a new spell class. |

## Intended Direction

- `AA-01`: extend the live world/item-knowledge path into the full desired appraisal flow instead of creating a parallel special-case system.
- `KNOW-V2-01`: expand the existing revision/ownership model to more subject types.
- `COMBAT-ACT-01`: add a deliberate timing/action-economy layer without regressing current encounter behavior.
- `PLAN-DRIFT-01`: use this wiki plus current notes/code to reconcile roadmap order before implementation begins.
- `DOC-OBJECTIVE-01`: reconcile the stale current-state objective doc with the passive `Brute Defiance` behavior already live in code.

## Key Decisions

- Open splits should remain visible in both domain pages and this register.
- Resolved splits stay recorded here for provenance; they are not deleted.
- Closing a split requires either code landing or explicit user confirmation that intent changed.

## Deferred / Open

- Awaiting eventual user or implementation resolution for: `AA-01`, `KNOW-V2-01`, `COMBAT-ACT-01`, `PLAN-DRIFT-01`, `DOC-OBJECTIVE-01`.

## Sources

- [references/plan.md](../../references/plan.md)
- [references/current_notes.md](../../references/current_notes.md)
- [project_tracking/tasks_todo.md](../../project_tracking/tasks_todo.md)
- [references/session_handoff_2026-03-12.md](../../references/session_handoff_2026-03-12.md)

## Raw

- [THREAD-4](../../raw/codex-threads/thread-4-019d567a-df4a-70b0-8e63-b2138fa9b337.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)
- [CHATGPT-1](../../raw/chatgpt/2026-04-15-second-brain-for-codex.md)

