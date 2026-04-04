# Tasks TODO
## Character Sheet / Encounter Follow-Up
- `CS-HIST-01` Render full `Assess Character` intel snapshot details in `Game History` instead of only the short summary line.

## Knowledge System
- `KNOW-ARCH-01` Add standalone `KnowledgeEntity`, `KnowledgeRevision`, and `KnowledgeOwnership` types plus local-first storage/normalization so knowledge stops living only inside history rows.
- `KNOW-SPELL-01` Change `Assess Character` to create or reuse a subject entity, mint an immutable knowledge revision, assign ownership to the caster, and write a history row linked to that exact revision.
- `KNOW-UI-01` Add history links to exact knowledge-card revisions with hover preview and click-to-open detail views.
- `KNOW-UI-02` Add a `Knowledge` area to the character sheet that groups owned revisions by subject and supports open, share, duplicate, archive, and compare flows.

## Phase 1: Combat Encounter
- `ARCH-REM-01` Later refactor reminder: continue extracting encounter request application, turn advance, upkeep, aura cleanup, summon lifecycle, and encounter log creation from `CombatEncounterPage.tsx`; spell preparation already uses the new `Action` / `Effect` runtime.

## Blocked / Deferred
- `B01` Expand the shared item UI into a full item-authoring and multi-target knowledge-sharing flow.
