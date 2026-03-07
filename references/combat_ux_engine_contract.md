# Combat UX + Engine Contract

This document defines the real combat-engine target and the UI contract that must exist before the combat pages are rebuilt.

It replaces the current manual combat encounter scaffold as the implementation target.

## Scope
- Local-first only until the real combat engine, DM dashboard, and player combat panel are complete and validated.
- No spatial map, token board, or visual position renderer in this phase.
- DM and players communicate battlefield positioning verbally.
- The web app handles legality, step flow, targeting prompts, reactions, sequencing, and resolution.

## UX Target
The web experience should feel structurally similar to `Solasta` or `Baldur's Gate 3` combat without their map layer.

That means:
- initiative order always visible
- active combatant always visible
- persistent combat UI, not modal popups for the whole flow
- button-driven action menus with nested submenus
- target selection guided by the engine
- reaction interruptions before resolution
- automatic resolution and automatic return to the legal action menu

## Non-Goals
- No tactical map
- No path drawing
- No visual line-of-sight solver
- No graphical token movement

## Primary Acceptance Rules
- No manual `attack successes` entry in normal combat flow
- No manual `damage` entry in normal combat flow
- No fake initiative ordering from a derived stat without a roll phase
- UI never decides legality on its own
- Every combat step must be representable by reducer state and emitted events

## Stable Web Layout

### DM Combat Encounter Page
The DM encounter page must keep these stable regions on screen.

1. `Encounter Header`
- encounter label
- encounter stage
- round number
- active combatant
- finalize combat button

2. `Initiative Rail`
- ordered combatant list
- roll status while initiative is not finalized
- active turn highlight
- quick inspect control for any combatant

3. `Workflow Panel`
- current prompt
- action family buttons
- subtype buttons
- target selection controls
- parameter inputs
- confirm, back, cancel

4. `Combatant Inspector`
- selected combatant identity
- ownership and combatant type
- HP, mana, inspiration, karma if relevant
- action economy
- movement remaining
- statuses and effects
- derived combat values

5. `DM Override Panel`
- manual reorder
- surprise assignment
- free-round assignment
- force turn advance if needed

6. `Event Log`
- chronological event list
- readable action and resolution trail

### Player Combat Panel
The player uses a combat panel attached to the character sheet, not the DM page.

That panel must show:
- encounter stage
- round and active combatant
- local action economy
- movement remaining
- legal action bar
- current workflow prompt
- reaction prompt when opened
- short log slice relevant to the player

## Interaction Workflow

### Canonical Step Flow
Every interactive combat action follows this staged pattern:

`action button -> subtype selection -> target selection -> parameter entry -> confirm -> reaction window if triggered -> resolution -> return to action menu`

Not every action requires every stage, but the state machine must support them all.

### Workflow State Requirements
The runtime must explicitly store:
- `mode`
- `current_step`
- `selected_action`
- `selected_subtype`
- `selected_targets`
- `parameters`
- `controller_role`
- `controller_participant_id`
- `actor_participant_id`
- `originating_event_id`
- `can_back`
- `can_cancel`

### Workflow Modes
- `turn_action`
- `reaction`
- `maintenance`
- `system`

### Workflow Steps
- `idle`
- `choose_action`
- `choose_subtype`
- `choose_targets`
- `choose_parameters`
- `confirm`
- `reaction_prompt`
- `resolve`
- `result`

### Nested Menu Requirement
Nested submenu chains are required.

Examples:
- `Attack -> unarmed_brawl -> target`
- `Attack -> melee_weapon:sword -> target`
- `Cast Power -> body_reinforcement -> choose_stat -> target`
- `Move -> enter_distance -> confirm`

## Engine State Contract

### Encounter Stages
- `draft`
- `initiative_roll`
- `initiative_review`
- `pre_turn_overrides`
- `turn_active`
- `reaction_window`
- `resolving`
- `completed`

### Encounter Runtime State Must Include
- encounter id and label
- stage
- revision
- participants
- initiative state
- turn state
- workflow state
- pending resolution state
- pending reaction queue
- DM override state
- event log
- created/updated/ended timestamps

### Participant Runtime State Must Include
- identity and ownership
- team id
- current resources
- action economy
- movement state
- statuses
- active effects
- derived combat values
- per-turn trackers
- known attacks / castable power hooks / item hooks

## Concrete Type Contract

The reducer layer should be implemented around these concrete concepts.

```ts
type CombatEncounterStage =
  | "draft"
  | "initiative_roll"
  | "initiative_review"
  | "pre_turn_overrides"
  | "turn_active"
  | "reaction_window"
  | "resolving"
  | "completed";

type CombatWorkflowMode = "turn_action" | "reaction" | "maintenance" | "system";

type CombatWorkflowStep =
  | "idle"
  | "choose_action"
  | "choose_subtype"
  | "choose_targets"
  | "choose_parameters"
  | "confirm"
  | "reaction_prompt"
  | "resolve"
  | "result";

type CombatActionFamilyId =
  | "attack"
  | "cast_power"
  | "move"
  | "use_item"
  | "free_action"
  | "reaction"
  | "end_turn";

type CombatTargetRule =
  | "none"
  | "self"
  | "single_any"
  | "single_ally"
  | "single_enemy"
  | "multi_any"
  | "multi_ally"
  | "multi_enemy";
```

## Exact Command Types

These command names and payload shapes are the reducer contract.

```ts
type CombatController = {
  controllerRole: "player" | "dm" | "system";
  controllerParticipantId: string | null;
};

type CombatCommand =
  | ({ kind: "begin_initiative" } & CombatController)
  | ({
      kind: "submit_initiative_roll";
      actorParticipantId: string;
      dice: number[];
    } & CombatController)
  | ({
      kind: "apply_manual_initiative_order";
      orderedParticipantIds: string[];
    } & CombatController)
  | ({
      kind: "set_surprise_participants";
      participantIds: string[];
    } & CombatController)
  | ({
      kind: "set_free_round_participants";
      participantIds: string[];
    } & CombatController)
  | ({ kind: "finalize_initiative" } & CombatController)
  | ({
      kind: "select_action_family";
      actorParticipantId: string;
      actionFamilyId: CombatActionFamilyId;
    } & CombatController)
  | ({
      kind: "select_action_subtype";
      actorParticipantId: string;
      subtypeId: string;
    } & CombatController)
  | ({
      kind: "select_targets";
      actorParticipantId: string;
      targetIds: string[];
    } & CombatController)
  | ({
      kind: "set_workflow_parameters";
      actorParticipantId: string;
      parameters: Record<string, unknown>;
    } & CombatController)
  | ({ kind: "workflow_back" } & CombatController)
  | ({ kind: "workflow_cancel" } & CombatController)
  | ({ kind: "confirm_workflow" } & CombatController)
  | ({
      kind: "select_reaction";
      actorParticipantId: string;
      reactionSubtypeId: string;
      parameters?: Record<string, unknown>;
    } & CombatController)
  | ({
      kind: "skip_reaction";
      actorParticipantId: string;
    } & CombatController)
  | ({ kind: "advance_turn" } & CombatController)
  | ({ kind: "finalize_combat" } & CombatController);
```

## Event Names

The reducer must emit structured event records using these event names.

```ts
type CombatEventName =
  | "encounter_created"
  | "initiative_started"
  | "initiative_rolled"
  | "initiative_reordered"
  | "surprise_participants_set"
  | "free_round_participants_set"
  | "initiative_finalized"
  | "turn_started"
  | "workflow_action_selected"
  | "workflow_subtype_selected"
  | "workflow_targets_selected"
  | "workflow_parameters_set"
  | "workflow_back"
  | "workflow_cancelled"
  | "workflow_confirmed"
  | "reaction_window_opened"
  | "reaction_selected"
  | "reaction_skipped"
  | "action_resolved"
  | "turn_advanced"
  | "combat_finalized";
```

## Initiative Contract

### Rule
- initiative dice pool = `DEX + WITS`
- roll result determines order
- ties resolve deterministically

### Initiative Process
1. DM starts initiative.
2. Encounter enters `initiative_roll`.
3. Each combatant submits a d10 dice array equal to their initiative pool.
4. Engine records successes.
5. When all combatants have rolled, stage becomes `initiative_review`.
6. DM may reorder manually.
7. DM may assign surprise or free rounds.
8. DM finalizes initiative.
9. Encounter enters `turn_active` and opens the active combatant workflow at `choose_action`.

### Tie Resolution Order
1. higher initiative successes
2. higher `DEX`
3. higher `WITS`
4. earlier encounter insertion order

## DM Override Contract

DM controls are first-class engine actions, not UI hacks.

Required override controls:
- manual initiative reorder
- surprise assignment
- free-round assignment
- turn advance
- finalize combat

## Action System Contract

### Base Action Families
- `attack`
- `cast_power`
- `move`
- `use_item`
- `free_action`
- `reaction`
- `end_turn`

### Menu Structure Rules
- every action family may define zero or more subtypes
- if a selected action family has exactly one subtype, the engine may auto-advance to the next required step
- if the selected subtype has target rule `none` or `self`, the engine skips explicit target selection
- if the selected subtype requires no parameters, the engine skips parameter entry

### Legality Recompute Rule
After every reducer transition, recompute:
- available action families
- available subtypes
- valid targets
- parameter prompts
- reaction availability
- active combatant action economy summary

## Target Selection Rules

### Target Rules
- `none`
  - no target step
- `self`
  - actor auto-selected
- `single_any`
  - exactly one non-removed participant
- `single_ally`
  - exactly one same-team participant
- `single_enemy`
  - exactly one opposing-team participant
- `multi_any`
  - between `minTargets` and `maxTargets`, any legal non-removed participants
- `multi_ally`
  - between `minTargets` and `maxTargets`, same-team only
- `multi_enemy`
  - between `minTargets` and `maxTargets`, opposing-team only

### Validation Rules
- duplicate target ids are invalid
- removed participants are invalid
- defeated participants are invalid unless a subtype explicitly marks them targetable later
- single-target actions require exactly one valid target
- multi-target actions require target count within configured bounds

## Workflow Back Rules

`workflow_back` moves exactly one required input step backward.

Rules:
- `choose_subtype -> choose_action`
  - keep selected action
  - clear subtype, targets, parameters
- `choose_targets -> choose_subtype`
  - keep action and subtype
  - clear targets, parameters
- `choose_parameters -> choose_targets` if a target step exists
- `choose_parameters -> choose_subtype` if no target step exists
- `confirm -> deepest required prior input step`
  - keep already entered values for that returned step
  - clear only deeper-step data

## Workflow Cancel Rules

`workflow_cancel` clears the active workflow and returns the acting participant to `choose_action`.

It must:
- clear selected action
- clear selected subtype
- clear selected targets
- clear parameters
- clear selected reaction subtype if the action has not begun resolution

It must not:
- refund already spent resources
- undo already emitted resolution events

## Reaction Priority / Resolution Order

### Initial Queue Order
For the first real combat pass, build the reaction queue in this exact order:

1. direct targets of the pending action, in target-selection order
2. only participants with a legal reaction subtype and remaining reaction resource

### Resolution Rule
- prompt one reacting participant at a time
- after a participant reacts or skips, advance to the next queued participant
- when the queue is empty, resolve the pending action

### Deferred Extension
Non-target triggered reactions can later be added after direct targets using the same queue model.

## Resolution Contract

### First Real Resolution Pass Must Replace
- manual attack-success inputs
- manual damage inputs
- fake initiative sorting

### First Real Resolution Pass Must Cover
- initiative rolling
- turn activation
- staged action workflow
- target selection
- reaction interrupts
- action spending
- deterministic event emission

### Later Mechanical Inputs
These remain open mechanical rules and do not block the workflow architecture:
- exact weapon formulas
- exact mitigation order for `DR`, `Soak`, and `Resistance`
- full power execution details
- final movement formula beyond tracked budget

## Selector Contract

Selectors must convert reducer state into UI-ready descriptors.

Minimum selectors:
- `selectCombatantSummaries`
- `selectInitiativeView`
- `selectActionBar`
- `selectWorkflowPanel`
- `selectReactionPrompt`
- `selectCombatantInspector`
- `selectEventLog`

The selectors must hide reducer internals from React components.

## File-By-File Implementation Tasks

### `references/combat_ux_engine_contract.md`
- hold the detailed target UX and engine contract

### `references/plan.md`
- point phase `1.1` at the contract-first reducer/types/selectors implementation

### `references/current_notes.md`
- keep unresolved rule gaps and workflow reminders visible

### `src/types/combatEngine.ts`
- define encounter, workflow, command, target-rule, override, and event types

### `src/config/combatReducer.ts`
- implement the reducer/state machine for initiative, workflow selection, back/cancel, reaction queue, and turn advancement scaffolding

### `src/selectors/combatUi.ts`
- implement encounter-to-UI selectors

### `tests/combatReducer.test.ts`
- verify initiative staging, workflow step transitions, back/cancel behavior, target validation, and reaction queue order

### `tests/combatUiSelectors.test.ts`
- verify UI descriptor output for action bar, workflow panel, inspector, and reaction prompt

### `tests/run-tests.ts`
- wire the new suites into verification

### Later UI Files
- `src/routes/CombatEncounterPage.tsx`
- `src/routes/PlayerCharacterPage.tsx`

These UI files must not be rebuilt until the new types, reducer, and selectors are stable.

## Immediate Implementation Order
1. update plan and notes
2. define new types
3. build reducer/state machine
4. build selectors
5. add reducer and selector tests
6. only then rebuild the combat UI on top of the new contract
