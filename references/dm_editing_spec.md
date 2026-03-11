# DM Editing Spec

This document defines the DM-side character editing model for the current local-only branch.

## Goal
- Allow the DM to change player or NPC characters when needed.
- Keep combat/runtime edits fast.
- Keep permanent sheet edits separate from runtime edits.
- Keep progression-sensitive edits behind a stricter admin path.
- Log every DM change so the source of a value is never ambiguous.

## Core Model
DM editing is split into three layers:

### 1. Runtime Adjustments
Use for current-session mutable values.

Examples:
- `currentHp`
- `currentMana`
- `inspiration`
- `positiveKarma`
- `negativeKarma`
- temporary resistance state
- temporary combat counters
- status flags
- active power effects

Rules:
- Available from the DM combat encounter page.
- Also available from DM-side character access.
- Prefer `+`, `-`, and `set` controls over raw freeform editing.
- Changes apply immediately.
- Every change must create an audit log entry.

### 2. Sheet Administration
Use for normal persistent character-sheet editing.

Examples:
- identity fields
- biography fields
- rank / CR / age
- equipment
- inventory
- money
- notes fields

Rules:
- Available from DM-side character access.
- Not part of the combat encounter quick-adjust panel.
- Saves to the character record.
- Changes must create an audit log entry.

### 3. Admin Override
Use for permanent changes to progression-sensitive or rules-sensitive fields.

Examples:
- base stats
- base skills
- learned powers
- power levels
- permanent resistances
- permanent resource caps if introduced later

Rules:
- Separate mode from normal sheet administration.
- Requires an explicit reason.
- Requires confirmation before save.
- Saves to the character record.
- Must create a high-visibility audit log entry.

## Data Boundaries
The character model must stay logically separated into:

### Sheet State
Persistent character definition.

Examples:
- identity
- biography
- base stats
- skills
- powers
- equipment
- inventory

### Runtime State
Current mutable play state.

Examples:
- `currentHp`
- `currentMana`
- inspiration
- karma
- temporary statuses
- encounter-only counters if later persisted locally

### Active Effects
Temporary rule effects that modify runtime-derived values.

Examples:
- `Body Reinforcement`
- `Light Support`
- `Shadow Control`

### DM Audit Log
Persistent record of DM edits.

Minimum fields:
- `id`
- `timestamp`
- `characterId`
- `targetOwnerRole`
- `editLayer`
- `fieldPath`
- `beforeValue`
- `afterValue`
- `reason`
- `sourceScreen`

## Entry Points

### A. DM Combat Encounter
Route:
- `src/routes/CombatEncounterPage.tsx`

Purpose:
- fast runtime adjustments during live play

Allowed edits:
- hp
- mana
- inspiration
- karma
- statuses
- active effects
- temporary resistance adjustments if needed later

UX:
- quick controls per combatant
- `+`, `-`, `set`
- optional reason for large edits
- action should be fast enough for live combat

### B. DM Character View
Route:
- `src/routes/PlayerCharacterPage.tsx` when opened from `/dm/character`

Purpose:
- inspect player-owned characters from DM side

Target behavior:
- default view mode
- explicit `DM Edit` action
- separate `Admin Override` action

### C. DM NPC Character View
Route:
- `src/routes/PlayerCharacterPage.tsx` when opened from `/dm/npc-character`

Purpose:
- full DM-owned NPC editing

Target behavior:
- normal edit path allowed
- admin override still separate for progression-sensitive edits

## Field Classification

### Runtime Adjustment Fields
- `currentHp`
- `currentMana`
- `inspiration`
- `positiveKarma`
- `negativeKarma`
- active effects
- temporary statuses

### Sheet Administration Fields
- `name`
- `concept`
- `faction`
- `age`
- biography
- `money`
- inventory
- equipment
- notes/session-facing narrative fields

### Admin Override Fields
- `statState.*.base`
- `skills[*].base`
- `powers[*].level`
- add/remove powers
- permanent resistance changes

## Command Model
Future implementation should not use one generic `saveCharacterEdits` command for all DM actions.

Use explicit command types:
- `dmAdjustRuntimeValue`
- `dmSetRuntimeValue`
- `dmAddActiveEffect`
- `dmRemoveActiveEffect`
- `dmEditSheetField`
- `dmOverrideProgressionField`

### Command Requirements
- Every command takes `characterId`
- Every command takes `reason` when the change is not trivial
- Every command appends a DM audit log entry
- Every command re-runs shared derived-value helpers after mutation

## UI Flows

### Runtime Adjustment Flow
1. DM opens combatant panel or DM-side sheet.
2. DM selects runtime field.
3. DM chooses `+`, `-`, or `set`.
4. DM enters value if needed.
5. System applies change immediately.
6. System updates derived values.
7. System logs the change.

### Sheet Administration Flow
1. DM opens character sheet.
2. DM enters `DM Edit` mode.
3. Editable non-progression fields unlock.
4. DM saves.
5. System logs the change.

### Admin Override Flow
1. DM opens character sheet.
2. DM enters `Admin Override`.
3. Restricted fields unlock.
4. DM changes the value.
5. DM provides reason.
6. DM confirms.
7. System saves and logs the change.

## Safety Rules
- Default mode is view-only.
- Runtime editing must not silently mutate permanent base sheet values.
- Admin override must not be mixed into normal edit mode.
- Progression-sensitive edits require reason + confirm.
- Derived values are never directly hand-edited if they can be recomputed from source fields.
- Every DM edit is attributable in the audit log.

## First Implementation Slice
When this spec is implemented, start with:

1. DM combat encounter runtime adjustments for:
- hp
- mana
- inspiration

2. DM-side sheet edit mode for:
- identity
- biography
- money
- inventory
- equipment

3. Admin override for:
- base stats
- base skills
- power levels

4. Minimal audit log storage on the local character record

## Explicit Non-Goals For The First Slice
- multiplayer synchronization
- Supabase persistence
- per-user permission enforcement
- undo stacks beyond a simple `revert last DM change` if added later
- full combat scheduler integration beyond runtime resource changes
