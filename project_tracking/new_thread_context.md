# New Thread Context

Use this file as the startup prompt/context for the next thread.

## How To Maintain This File
- Section 1 is compacted context from all earlier threads.
- Section 2 is what happened in the current thread.
- Section 3 is what the next thread should focus on.
- At the end of the next milestone/thread, merge sections 1 and 2 into the new compacted Section 1, replace Section 2 with that thread's work, and update Section 3 for the next milestone.

## 1. Prior Threads Context
Project purpose:
- Local-first TTRPG game hub for player/DM character sheets, combat encounters, supernatural powers, items, equipment, item knowledge, and revisioned knowledge cards.

Current branch and tracking:
- Workspace: `C:\Users\Evrim\Desktop\FRP\Convergence\game_hub5`
- Main working branch: `codex/powers-implementation`
- Latest pushed commit before this handoff: `673f553 Reconcile Control Entity source rules`
- `references/plan.md` is the authoritative roadmap.
- Main tracking files:
  - `project_tracking/tasks_todo.md`
  - `project_tracking/task_log.md`
  - `references/current_notes.md`

Stable completed architecture:
- Combat encounter staging, parties, initiative, logs, and DM encounter flow exist.
- Power runtime uses class-based `Action` / `Effect` plumbing under `src/engine` and `src/powers`.
- `EncounterExecutionEngine` owns prepared request execution, turn advance, upkeep, aura cleanup, summon lifecycle, and log generation.
- Passive power-derived skill/mana/utility output uses passive providers.
- Cast UI is standardized to `Power > Spell > ...`.
- Aura effects are source-linked and clear correctly with the owning aura source.
- Necromancy and Shadow Control summon dismissal is contextual in the caster action menu.

Stable completed systems:
- Knowledge System V1 exists for character cards through `KnowledgeEntity`, `KnowledgeRevision`, and `KnowledgeOwnership`.
- `Assess Character` creates linked character-card revisions and history links.
- Power rewrite/source reconciliation is complete for:
  - Awareness
  - Body Reinforcement
  - Crowd Control
  - Elementalist
  - Healing
  - Light Support
  - Necromancy
  - Shadow Control
- Locked source-rule decisions:
  - `Assess Character` keeps CR caps `6 / 9 / 12 / 15 / 18`.
  - `Control Entity` uses `CHA + INT` at levels `1-3`.
  - `Control Entity` uses `CHA + INT + CC level` at levels `4-5`.
  - `Awakened Insight` currently grants temporary inspiration; uninspired-status interaction is still deferred.
  - `Artifact Appraisal` exists in source but full integration was deferred until item mechanics/UI expansion.

Previous item baseline before the current refactor:
- Shared item records already existed outside character sheets.
- Character sheets referenced items through:
  - `ownedItemIds`
  - `inventoryItemIds`
  - `activeItemIds`
  - `equipment`
- Item logic lived mainly in `src/types/items.ts`, `src/lib/items.ts`, `src/mutations/characterItemMutations.ts`, `src/hooks/usePlayerCharacterMutations.ts`, `src/state/appFlow.tsx`, and `src/state/appFlowPersistence.ts`.
- Item bonuses already affected derived runtime values through `src/config/characterRuntime.ts`.
- Equipped weapons already affected physical attack resolution in combat.
- A first DM item-management slice had already been started:
  - DM dashboard `Item Management` block
  - `Items List`
  - `Item Editting`
  - starter shared items
  - `spellBonuses`
  - a provisional shield blueprint

Validation norm:
- After meaningful implementation groups run:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
  - `npm.cmd run build`

## 2. This Thread Context
Current thread goal:
- Replace the provisional shared-item model with real blueprint-backed item instances, align item rules to the updated authoritative source, expand DM item management, and keep this file compact for the next handoff.

Locked decisions from this thread:
- `references/originals/item_rules_v2.3.txt` is the authoritative item source file.
- Section `5` of the item rules wins whenever older prose in the same document conflicts with it.
- `Unarmed` is treated as its own blueprint-class baseline and `Brawl Weapon` is a separate real item blueprint.
- `3-Handed Weapon` is terminology for `Oversized`, not literal hand count; actual hand requirement remains `2`.
- Item-only base overrides are preserved and tracked as explicit exceptions on the owning blueprint.
- Range and rocket-launcher AoE are metadata only in this pass unless later expanded deliberately.

Current implementation target in this thread:
- Persist both blueprint definitions and item instances.
- Convert starter records into starter instances backed by real blueprints.
- Expand the blueprint catalog to match the rule classifications in section `5`.
- Add DM blueprint management, item assignment, base-vs-bonus editing, and expandable item rows.
- Keep local save compatibility by migrating legacy `items` storage into the new blueprint/instance model.

## 3. Next Thread Focus
Next milestone: item system expansion.

Primary goal:
- Build out item creation, assignment to characters, equipping/activation interactions, item buff application, richer item UI, and `Artifact Appraisal` integration.

Start by reading:
- `references/plan.md`
- `project_tracking/tasks_todo.md`
- `references/current_notes.md`
- `references/originals/item_rules_v2.3.txt`
- `json_refs/item_rules.json`
- `references/knowledge_card_design.md`

Audit these code paths first:
- `src/types/items.ts`
- `src/lib/items.ts`
- `src/mutations/characterItemMutations.ts`
- `src/hooks/usePlayerCharacterMutations.ts`
- `src/components/player-character/CharacterInventorySection.tsx`
- `src/config/characterRuntime.ts`
- `src/rules/combatEncounter.ts`
- `src/rules/combatResolution.ts`
- `src/state/appFlow.tsx`
- `src/state/appFlowPersistence.ts`

Relevant deferred TODOs:
- `B01`: Expand shared item UI into a full item-authoring and multi-target knowledge-sharing flow.
- `AA-01`: Full `Artifact Appraisal (AA)` integration after item mechanics/UI are ready.
- `KNOW-V2-01`: Expand knowledge cards beyond character cards.

Decisions to make before coding:
- Whether item knowledge should stay as current item-local learned/visible state for this milestone, or whether item cards should be included now via `KNOW-V2-01`.
- Whether `Artifact Appraisal` should create item knowledge cards, update current item-local knowledge, or do both.
- What the exact DM/player UI flow should be for:
  - create item
  - assign ownership
  - assign inventory/carried state
  - equip/use/activate
  - edit bonuses
  - hide/reveal bonuses
  - identify with `AA`
  - share item knowledge with one or more characters
- For future humanoid-vs-mob apparel logic, the current recommended implementation hint is a per-character/template flag such as `apparelMode: humanoid | none`.

Implementation constraints:
- Preserve local save compatibility unless a migration is explicitly planned.
- Do not revert unrelated user changes.
- Keep `references/plan.md` aligned only when implementation reality changes.
- Update tracking files when item work creates, completes, or defers tasks.
- Commit and push substantial checkpoints to `origin/codex/powers-implementation`.
