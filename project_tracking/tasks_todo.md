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
- `BR-BD-01` Update `Brute Defiance (BD)` under `Body Reinforcement` so it becomes a passive delayed stand-up effect again: 1/day, triggers while HP is between `0` and `-5`, resolves after one turn, and restores HP by BR level as `1 / 2 / 4 / 8 / 16`. Do not overwrite older BR work until validation is planned for the behavior change group.
- `AURA-ARCH-DISCUSS-01` Dilemma to be discussed: current implementation uses `buildActivePowerEffect(...)` for both targeted buff spells like `Boost Physique` and aura-source spells like `Light Aura` / `Cloak of Shadow`; alternative direction is to keep targeted buff construction there but move aura spells to a dedicated aura builder such as `buildAuraSourceEffect(...)` or `buildAuraSpellEffect(...)`. Do not implement until the architecture decision is discussed.
- `CC-PASSIVE-01` Replace the current `Crowd Control` passive/cantrip bonuses with `Crowd Management (CM)`: add `Crowd Control` level directly to `Social` as `+1 / +2 / +3 / +4 / +5` by power level. Do not implement until the replacement pass is scheduled.
- `CC-PASSIVE-02` Add `Compulsion Guard (CG)` as a `Crowd Control` passive unlocked at level `5`: add `Social` skill level to the defense dice pool against control effects. Do not implement until the replacement pass is scheduled.

## Blocked / Deferred
- `B01` Expand the shared item UI into a full item-authoring and multi-target knowledge-sharing flow.
