# Project Objective

## Goal
Maintain the local-only web application as the active digital hub for the custom TTRPG with the implemented T1 combat-power set preserved and the deferred backlog isolated clearly.

## Current Branch State
- Tech stack in active use: React and TypeScript on the frontend.
- Persistence in active use: browser-local storage for persisted characters only.
- Current gameplay scope:
  - player and DM hub flows
  - player and DM character sheets
  - DM-owned NPC creation
  - combat dashboard staging
  - DM combat encounter execution
- Active runtime scope already present:
  - initiative ordering
  - encounter combatant views
  - runtime HP / mana editing
  - active power-effect runtime
  - turn runtime
  - encounter-only summons and maintained states
- Encounter state is still local and non-persisted.

## Objective Anchors
- Keep existing character, sheet, and encounter behavior stable while the branch stays local-only.
- Preserve source references under `references/originals/` and the derived JSON files.
- Keep derived/stat/runtime formulas in frontend code where they are needed by the sheet and encounter UI.
- Do not reintroduce backend or realtime assumptions.
- Keep the implemented T1 combat-power set stable while the deferred items remain clearly separated.

## Key Features

### Character Management System
- Create and edit player characters locally.
- Create and edit DM-owned characters locally.
- Auto-calculate current sheet summaries on the client.
- Keep DM edit, runtime edit, and admin override behavior separated.

### Inventory and Item System
- Preserve inventory and equipment display on the character sheet.
- Keep item and auction-house references available for later work.
- Keep `AA` deferred until a separate item-authoring design exists.

### Supernatural Power System
- Preserve authored power JSON as the runtime authority for T1 powers.
- Keep the completed T1 mechanics stable:
  - Awareness `AS` / `AI` / `AC`
  - `Body Reinforcement`
  - `Crowd Control`
  - `Elementalist`
  - `Healing`
  - `Light Support`
  - `Necromancy`
  - `Shadow Control`
- Keep `AA` deferred until a separate item-authoring design exists.

### Combat Encounter Surface
- Preserve the DM combat encounter as the active runtime surface for combat powers.
- Keep encounter state local-only and non-persisted.
- Allow encounter-only transient summons and maintained control states without polluting persisted character storage.
- Keep the deferred encounter history/logger block out of scope until a later phase.

## Reference Pipeline
- Authoritative text references:
  - `json_refs/basic_rules.json`
  - `json_refs/item_rules.json`
  - `json_refs/powers.json`
- Current frontend formulas and helpers:
  - `src/config/*.ts`
  - `src/rules/*.ts`
- Active planning references:
  - `references/plan.md`
  - `references/current_notes.md`
  - `references/dm_editing_spec.md`
