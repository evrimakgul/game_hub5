import type { ActionState } from "./combat.ts";
import type {
  ActionType,
  CharacterId,
  CoreStatId,
  EncounterId,
  ISODateString,
  ParticipantId,
  PowerId,
  SkillId,
} from "./game.ts";
import type { RequestedAction } from "../config/actions.ts";

export type CombatParticipantKind = "character" | "npc" | "summon";
export type CombatOwnershipRole = "player" | "dm" | "system";
export type CombatAuthorizationMode = "sandbox" | "role_enforced";
export type CombatEncounterStage =
  | "draft"
  | "initiative_roll"
  | "initiative_review"
  | "pre_turn_overrides"
  | "turn_active"
  | "reaction_window"
  | "resolving"
  | "completed";

export type CombatWorkflowMode = "turn_action" | "reaction" | "maintenance" | "system";
export type CombatWorkflowStep =
  | "idle"
  | "choose_action"
  | "choose_subtype"
  | "choose_targets"
  | "choose_parameters"
  | "confirm"
  | "reaction_prompt"
  | "resolve"
  | "result";

export type CombatActionFamilyId =
  | "attack"
  | "cast_power"
  | "move"
  | "use_item"
  | "free_action"
  | "reaction"
  | "end_turn";

export type CombatTargetRule =
  | "none"
  | "self"
  | "single_any"
  | "single_ally"
  | "single_enemy"
  | "multi_any"
  | "multi_ally"
  | "multi_enemy";

export interface CombatController {
  controllerRole: CombatOwnershipRole;
  controllerParticipantId: ParticipantId | null;
}

export interface CombatEngineParticipantInput {
  participantId: ParticipantId;
  displayName: string;
  kind: CombatParticipantKind;
  ownerRole: CombatOwnershipRole;
  teamId: string;
  characterId: CharacterId | null;
  coreStats: Record<CoreStatId, number>;
  skillLevels: Partial<Record<SkillId, number>>;
  knownPowers: Partial<Record<PowerId, number>>;
  currentHp: number;
  currentMana: number;
  currentInspiration?: number;
  currentPositiveKarma?: number;
  currentNegativeKarma?: number;
  movementMaxMeters?: number;
}

export interface CreateCombatEngineStateInput {
  encounterId: EncounterId;
  label: string;
  authorizationMode?: CombatAuthorizationMode;
  participants: CombatEngineParticipantInput[];
  createdAt?: ISODateString;
}

export interface CombatInitiativeRoll {
  participantId: ParticipantId;
  poolSize: number;
  dice: number[];
  successes: number;
  isBotch: boolean;
  submittedAt: ISODateString;
}

export interface CombatInitiativeState {
  started: boolean;
  submittedRolls: Partial<Record<ParticipantId, CombatInitiativeRoll>>;
  manualOrder: ParticipantId[] | null;
  resolvedOrder: ParticipantId[];
  surpriseParticipantIds: ParticipantId[];
  freeRoundParticipantIds: ParticipantId[];
  finalized: boolean;
}

export interface CombatMovementState {
  maxMeters: number;
  remainingMeters: number;
  spentMeters: number;
}

export interface CombatPerTurnTrackers {
  brawlAttacksUsed: number;
  actionsResolved: number;
  reactionsResolved: number;
}

export interface CombatDerivedSnapshot {
  initiativePool: number;
  armorClass: number;
  damageReduction: number;
  soak: number;
}

export interface CombatParticipantResources {
  hp: number;
  mana: number;
  inspiration: number;
  positiveKarma: number;
  negativeKarma: number;
}

export interface CombatParticipantRuntimeState {
  participantId: ParticipantId;
  displayName: string;
  kind: CombatParticipantKind;
  ownerRole: CombatOwnershipRole;
  teamId: string;
  characterId: CharacterId | null;
  coreStats: Record<CoreStatId, number>;
  skillLevels: Partial<Record<SkillId, number>>;
  knownPowers: Partial<Record<PowerId, number>>;
  resources: CombatParticipantResources;
  actionState: ActionState;
  movement: CombatMovementState;
  derived: CombatDerivedSnapshot;
  statuses: string[];
  effects: string[];
  perTurnTrackers: CombatPerTurnTrackers;
  defeated: boolean;
  removed: boolean;
  insertionOrder: number;
}

export interface CombatTurnState {
  roundNumber: number;
  turnOrder: ParticipantId[];
  pendingPreTurnParticipantIds: ParticipantId[];
  activeParticipantId: ParticipantId | null;
  activeIndex: number | null;
  startedAt: ISODateString | null;
}

export interface CombatParameterOption {
  value: string;
  label: string;
}

export interface CombatParameterDefinition {
  key: string;
  label: string;
  type: "number" | "select" | "boolean";
  required: boolean;
  min?: number;
  max?: number;
  options?: CombatParameterOption[];
}

export interface CombatSubtypeDefinition {
  actionFamilyId: CombatActionFamilyId;
  subtypeId: string;
  label: string;
  targetRule: CombatTargetRule;
  minTargets: number;
  maxTargets: number;
  parameterDefinitions: CombatParameterDefinition[];
  requestedAction: RequestedAction | null;
  opensReactionWindow: boolean;
}

export interface CombatWorkflowState {
  mode: CombatWorkflowMode;
  step: CombatWorkflowStep;
  actorParticipantId: ParticipantId;
  controllerRole: CombatOwnershipRole;
  controllerParticipantId: ParticipantId | null;
  selectedActionFamilyId: CombatActionFamilyId | null;
  selectedSubtypeId: string | null;
  selectedTargetIds: ParticipantId[];
  parameters: Record<string, unknown>;
  targetRule: CombatTargetRule | null;
  minTargets: number;
  maxTargets: number;
  canBack: boolean;
  canCancel: boolean;
  originatingEventId: string | null;
}

export interface PendingCombatResolution {
  actorParticipantId: ParticipantId;
  actionFamilyId: CombatActionFamilyId;
  subtypeId: string;
  targetIds: ParticipantId[];
  parameters: Record<string, unknown>;
  reactionQueue: ParticipantId[];
  currentReactionParticipantId: ParticipantId | null;
}

export type CombatEventName =
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

export interface CombatEventRecord {
  eventId: string;
  name: CombatEventName;
  actorParticipantId: ParticipantId | null;
  controllerRole: CombatOwnershipRole;
  controllerParticipantId: ParticipantId | null;
  roundNumber: number;
  message: string;
  payload: Record<string, unknown>;
  createdAt: ISODateString;
}

export interface CombatEngineState {
  encounterId: EncounterId;
  label: string;
  authorizationMode: CombatAuthorizationMode;
  stage: CombatEncounterStage;
  revision: number;
  participants: Record<ParticipantId, CombatParticipantRuntimeState>;
  initiative: CombatInitiativeState;
  turn: CombatTurnState;
  workflow: CombatWorkflowState | null;
  pendingResolution: PendingCombatResolution | null;
  events: CombatEventRecord[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  endedAt: ISODateString | null;
}

export type CombatCommand =
  | ({ kind: "begin_initiative" } & CombatController)
  | ({
      kind: "submit_initiative_roll";
      actorParticipantId: ParticipantId;
      dice: number[];
    } & CombatController)
  | ({
      kind: "apply_manual_initiative_order";
      orderedParticipantIds: ParticipantId[];
    } & CombatController)
  | ({
      kind: "set_surprise_participants";
      participantIds: ParticipantId[];
    } & CombatController)
  | ({
      kind: "set_free_round_participants";
      participantIds: ParticipantId[];
    } & CombatController)
  | ({ kind: "finalize_initiative" } & CombatController)
  | ({
      kind: "select_action_family";
      actorParticipantId: ParticipantId;
      actionFamilyId: CombatActionFamilyId;
    } & CombatController)
  | ({
      kind: "select_action_subtype";
      actorParticipantId: ParticipantId;
      subtypeId: string;
    } & CombatController)
  | ({
      kind: "select_targets";
      actorParticipantId: ParticipantId;
      targetIds: ParticipantId[];
    } & CombatController)
  | ({
      kind: "set_workflow_parameters";
      actorParticipantId: ParticipantId;
      parameters: Record<string, unknown>;
    } & CombatController)
  | ({ kind: "workflow_back" } & CombatController)
  | ({ kind: "workflow_cancel" } & CombatController)
  | ({ kind: "confirm_workflow" } & CombatController)
  | ({
      kind: "select_reaction";
      actorParticipantId: ParticipantId;
      reactionSubtypeId: string;
      parameters?: Record<string, unknown>;
    } & CombatController)
  | ({
      kind: "skip_reaction";
      actorParticipantId: ParticipantId;
    } & CombatController)
  | ({ kind: "advance_turn" } & CombatController)
  | ({ kind: "finalize_combat" } & CombatController);

export interface CombatActionDescriptor {
  actionFamilyId: CombatActionFamilyId;
  label: string;
  enabled: boolean;
  disabledReason: string | null;
}

export interface CombatSubtypeDescriptor {
  subtypeId: string;
  label: string;
  enabled: boolean;
  disabledReason: string | null;
}

export interface CombatTargetDescriptor {
  participantId: ParticipantId;
  label: string;
  enabled: boolean;
  disabledReason: string | null;
  relation: "self" | "ally" | "enemy";
  selected: boolean;
}

export interface CombatWorkflowPanelDescriptor {
  mode: CombatWorkflowMode;
  step: CombatWorkflowStep;
  actorParticipantId: ParticipantId;
  selectedActionFamilyId: CombatActionFamilyId | null;
  selectedSubtypeId: string | null;
  selectedTargetIds: ParticipantId[];
  parameterDefinitions: CombatParameterDefinition[];
  canBack: boolean;
  canCancel: boolean;
}

export interface CombatReactionPromptDescriptor {
  participantId: ParticipantId;
  subtypeOptions: CombatSubtypeDescriptor[];
  canSkip: boolean;
}

export interface CombatInspectorDescriptor {
  participantId: ParticipantId;
  displayName: string;
  ownerRole: CombatOwnershipRole;
  teamId: string;
  hp: number;
  mana: number;
  inspiration: number;
  positiveKarma: number;
  negativeKarma: number;
  actionState: ActionState;
  movement: CombatMovementState;
  statuses: string[];
  effects: string[];
  derived: CombatDerivedSnapshot;
  active: boolean;
}
