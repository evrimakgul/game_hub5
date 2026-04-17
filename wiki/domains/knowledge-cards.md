---
title: Knowledge Cards
topic: domains
kind: domain
status: active
updated: 2026-04-16
confidence: high
---

## Summary

Knowledge is no longer history-only. The live model uses standalone entities, immutable revisions, and per-character ownership so intel can be browsed, shared, versioned, and linked back from history entries.

## Current State

- `src/types/knowledge.ts` defines `KnowledgeEntity`, `KnowledgeRevision`, and `KnowledgeOwnership`.
- `src/lib/knowledge.ts` owns creation, lineage, ownership, sharing, duplication, archival, and history-link helpers.
- Character sheets expose a dedicated `Knowledge` area through `src/components/player-character/CharacterKnowledgeSection.tsx`.
- Item-card management is exposed to DM flows through `src/routes/DmItemInteractionsPage.tsx`.
- History entries can link to exact knowledge revisions instead of embedding intel as the only durable record.
- V1 subject coverage is currently character cards and item cards.
- `Artifact Appraisal` now reuses the same item-card revision model: successful appraisals grant the current canonical item-card revision, refresh stale canonical content when needed, and append linked history rows to the granted revision.

## Intended Direction

- Keep `History` as an event log and keep durable intel in standalone revisioned records.
- Expand the same model to more subject types later rather than inventing a different knowledge system for each domain.
- Use descendant revisions for edited or shared copies instead of overwriting previous knowledge.

## Key Decisions

- A character may own multiple revisions of the same subject.
- Revisions are immutable snapshots.
- Ownership is separate from entity/revision existence.
- Item knowledge and character knowledge share the same underlying model.
- Current-state item visibility checks should key off the latest relevant owned revision, not merely any historical revision ownership.

## Deferred / Open

- `KNOW-V2-01` expansion to place, faction, story, and custom subjects.
- Additional creation/template flows beyond the current character/item surfaces.

## Sources

- [references/current_notes.md](../../references/current_notes.md)
- [references/knowledge_card_design.md](../../references/knowledge_card_design.md)
- [src/types/knowledge.ts](../../src/types/knowledge.ts)
- [src/lib/knowledge.ts](../../src/lib/knowledge.ts)
- [src/components/player-character/CharacterKnowledgeSection.tsx](../../src/components/player-character/CharacterKnowledgeSection.tsx)
- [src/components/player-character/CharacterHistorySection.tsx](../../src/components/player-character/CharacterHistorySection.tsx)
- [src/routes/DmItemInteractionsPage.tsx](../../src/routes/DmItemInteractionsPage.tsx)

## Raw

- [THREAD-4](../../raw/codex-threads/thread-4-019d567a-df4a-70b0-8e63-b2138fa9b337.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)

