# New Thread Context

Use this file as the startup prompt/context for the next thread.

## How To Maintain This File
- Section 1 is compacted context from all earlier threads.
- Section 2 is what happened in the current thread.
- Section 3 is what the next thread should focus on.
- In the next thread, treat this file as startup context only. Before any implementation, first discuss the proposed approach with the user and get explicit confirmation to proceed.
- When a thread is ending and work is being handed off to a new thread, create a checkpoint first. The checkpoint should be a checkpoint commit when needed plus a rollback tag, and the resulting checkpoint details should be written into this file so the next thread inherits a real recovery marker instead of only prose context.
- At the end of the next milestone/thread, merge sections 1 and 2 into the new compacted Section 1, replace Section 2 with that thread's work, and update Section 3 for the next milestone.

## 1. Prior Threads Context
Project purpose:
- Local-first TTRPG game hub for player/DM character sheets, combat encounters, supernatural powers, items, equipment, item knowledge, and revisioned knowledge cards.

Current branch and tracking:
- Workspace: `C:\Users\Evrim\Desktop\FRP\Convergence\game_hub5`
- Main working branch: `codex/powers-implementation`
- Latest pushed commit before this handoff: `673f553 Reconcile Control Entity source rules`
- Latest handoff checkpoint tag: `rollback/thread-handoff-2026-04-10-item-refactor-prep`
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

What was implemented in this thread:
- The item system moved to persisted blueprint definitions plus blueprint-backed item instances with migration from legacy item storage.
- DM `Item Management` was expanded with `Items List`, `Item Editting`, and `Blueprint Management`.
- Starter items were recreated as starter instances backed by real blueprints.
- The authoritative item source remained `references/originals/item_rules_v2.3.txt`, and the live item model was aligned around that file.
- PP-driven item tiering replaced the older `item level` concept. Item PP is now derived from bonus effects, item tier is computed from PP, and artifacts remain a special classification.
- Custom item properties were added so DM-authored bundle effects and nonstandard bonus rows can contribute PP and resolve into item output.
- Character sheet inventory/loadout UI was revised so equipment and items are shown more compactly, equipped items surface in the loadout, and inventory/equipment interactions no longer require edit mode for simple equip or unequip flows.
- The saved-character loss bug from the item work was repaired by hardening hydration and backup recovery instead of reverting the newer item architecture.
- The player-facing equipment summary was improved so item cards display richer compact summaries such as PP, tier, base effects, and bonus labels.
- Item taxonomy was corrected away from the provisional `weapon / armor / jewel / mystic` grouping. The live system now uses category families such as `melee`, `body_armor`, `shield`, `range`, `occult`, `neck`, `rings`, `head`, `orbital`, `charm`, and `consumable`, with shields treated as a category separate from body armor.
- The seven main character equipment slots are now always present on character sheets: `primary hand`, `secondary hand`, `left ring`, `right ring`, `chest/body`, `neck`, and `head`.
- Supplementary slots were intentionally deferred: `orbital`, `earring`, and `charm/talisman`.
- Slot display was tightened so summaries resolve from category/subcategory rules instead of relying on arbitrary freeform slot labels; shield summaries now resolve to secondary-hand behavior, and two-handed items resolve to both hand slots.
- During design discussion, the next architectural need was identified clearly: the current fixed-category assumptions should later be replaced with persisted DM-defined category/subcategory definitions, and multi-slot occupancy should be rebuilt on top of that refactor rather than patched further in the old model.
- `python.ipynb` was added intentionally as a temporary repo-local scratch notebook for manual checking. It is allowed to remain for now, but it is explicitly a deferred cleanup item and should be removed before the project is considered done.
- Handoff rule locked: when closing a thread and moving to a new one, create a checkpoint and record it here.

## 3. Next Thread Focus
Next milestone after this thread: item-system refactor first, then later item-system expansion.

Primary goal:
- Do not continue deeper item-feature expansion immediately. First run the dedicated item refactor that replaces fixed item category/subtype assumptions with persisted DM-defined definitions and prepares the system for true multi-slot occupancy. After that refactor is complete, continue with the remaining item-creation-phase work.

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
- `ITEM-REFAC-01`: Replace fixed item category/subtype assumptions with persisted DM-defined category and subcategory definitions.
- `ITEM-MULTISLOT-01`: Add first-class multi-slot occupancy after the category/subcategory refactor.
- `ITEM-RANGE-01`: Tune ranged blueprint identities after refactoring, including bows, crossbows, and later modern ranged weapons.
- `COMBAT-ACT-01`: Design the future timing/action-economy layer around action budget, action cost, weapon speed, and multi-attack throughput.

Decisions to make before coding:
- For the refactor, define persisted `ItemCategoryDefinition` and `ItemSubcategoryDefinition` records that carry `name`, `parent category`, `allowedEquipSlots[]`, `occupiedSlots[]`, and constrained `mechanicalRole`.
- Replace current fixed-category assumptions safely across:
  - blueprint creation UI
  - blueprint persistence
  - item-instance hydration
  - equip validation
  - loadout rendering
  - combat attack selection
  - summary labels
  - legacy migration
  - test coverage
- After that refactor, add multi-slot occupancy using `allowedEquipSlots[]`, `occupiedSlots[]`, and an `anchorSlot` or equivalent resolved-equip concept.
- After the refactor, continue with the remaining item-system feature work:
  - richer item creation and assignment flows
  - item buff application polish
  - `Artifact Appraisal`
  - later knowledge-card expansion for items
- For future humanoid-vs-mob apparel logic, the current recommended implementation hint is a per-character/template flag such as `apparelMode: humanoid | none`.
- For future action-economy work, keep the already-discussed topics together: `attacks per standard action`, `action budget`, `action cost`, `weapon speed`, and a possible timing engine.

Implementation constraints:
- Preserve local save compatibility unless a migration is explicitly planned.
- Do not revert unrelated user changes.
- Keep `references/plan.md` aligned only when implementation reality changes.
- Update tracking files when item work creates, completes, or defers tasks.
- Commit and push substantial checkpoints to `origin/codex/powers-implementation`.
- Keep `python.ipynb` visible as a temporary notebook artifact until final cleanup; do not silently delete it in intermediate threads.
