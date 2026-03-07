import {
  createActionState,
  getActionAvailability,
  resetActionStateForTurn,
  spendAction,
  type RequestedAction,
} from "./actions.ts";
import { resolveDicePool } from "./combat.ts";
import { getRuntimePowerLevel, powerRuntimeLibrary } from "./powerRuntime.ts";
import type {
  CombatActionDescriptor,
  CombatActionFamilyId,
  CombatAuthorizationMode,
  CombatCommand,
  CombatController,
  CombatEngineParticipantInput,
  CombatEngineState,
  CombatEventName,
  CombatEventRecord,
  CombatMovementState,
  CombatParticipantRuntimeState,
  CombatSubtypeDefinition,
  CombatSubtypeDescriptor,
  CombatTargetDescriptor,
  CombatTargetRule,
  CombatWorkflowState,
  CreateCombatEngineStateInput,
  PendingCombatResolution,
} from "../types/combatEngine.ts";
import type { ParticipantId, PowerId } from "../types/game.ts";

const DEFAULT_MOVEMENT_MAX_METERS = 5;

type PendingEventDraft = {
  name: CombatEventName;
  actorParticipantId?: ParticipantId | null;
  message: string;
  payload?: Record<string, unknown>;
};

function createTimestamp(seed?: string): string {
  return seed ?? new Date().toISOString();
}

function cloneState<T>(value: T): T {
  return structuredClone(value);
}

function uniqueParticipantIds(ids: ParticipantId[]): ParticipantId[] {
  return [...new Set(ids)];
}

function isDmController(
  authorizationMode: CombatAuthorizationMode,
  controller: CombatController
): boolean {
  return (
    authorizationMode === "sandbox" ||
    controller.controllerRole === "system" ||
    controller.controllerRole === "dm"
  );
}

function assertDmController(state: CombatEngineState, controller: CombatController): void {
  if (!isDmController(state.authorizationMode, controller)) {
    throw new Error("DM or system control is required for this command.");
  }
}

function assertParticipantExists(
  state: CombatEngineState,
  participantId: ParticipantId
): CombatParticipantRuntimeState {
  const participant = state.participants[participantId];

  if (!participant) {
    throw new Error(`Unknown participant: ${participantId}`);
  }

  return participant;
}

function assertActorControl(
  state: CombatEngineState,
  controller: CombatController,
  actorParticipantId: ParticipantId
): void {
  if (isDmController(state.authorizationMode, controller)) {
    return;
  }

  if (controller.controllerRole !== "player") {
    throw new Error("Unsupported controller role.");
  }

  if (controller.controllerParticipantId !== actorParticipantId) {
    throw new Error("Controller is not allowed to act for this participant.");
  }
}

function createEventRecords(
  baseState: CombatEngineState,
  nextState: CombatEngineState,
  controller: CombatController,
  drafts: PendingEventDraft[]
): CombatEventRecord[] {
  const createdAt = nextState.updatedAt;

  return drafts.map((draft, index) => ({
    eventId: `${nextState.encounterId}-event-${baseState.revision + 1}-${index + 1}`,
    name: draft.name,
    actorParticipantId: draft.actorParticipantId ?? null,
    controllerRole: controller.controllerRole,
    controllerParticipantId: controller.controllerParticipantId,
    roundNumber: nextState.turn.roundNumber,
    message: draft.message,
    payload: draft.payload ?? {},
    createdAt,
  }));
}

function commitState(
  baseState: CombatEngineState,
  nextState: CombatEngineState,
  controller: CombatController,
  drafts: PendingEventDraft[]
): CombatEngineState {
  nextState.revision = baseState.revision + 1;
  nextState.updatedAt = createTimestamp();

  if (nextState.stage === "completed" && nextState.endedAt === null) {
    nextState.endedAt = nextState.updatedAt;
  }

  const events = createEventRecords(baseState, nextState, controller, drafts);
  nextState.events = [...nextState.events, ...events];
  return nextState;
}

function createDerivedSnapshot(participant: CombatEngineParticipantInput) {
  return {
    initiativePool: participant.coreStats.DEX + participant.coreStats.WITS,
    armorClass: participant.coreStats.DEX,
    damageReduction: 0,
    soak: 0,
  };
}

function createMovementState(maxMeters?: number): CombatMovementState {
  const safeMax = Math.max(0, Math.floor(maxMeters ?? DEFAULT_MOVEMENT_MAX_METERS));

  return {
    maxMeters: safeMax,
    remainingMeters: safeMax,
    spentMeters: 0,
  };
}

function createParticipantState(
  participant: CombatEngineParticipantInput,
  insertionOrder: number
): CombatParticipantRuntimeState {
  return {
    participantId: participant.participantId,
    displayName: participant.displayName,
    kind: participant.kind,
    ownerRole: participant.ownerRole,
    teamId: participant.teamId,
    characterId: participant.characterId,
    coreStats: participant.coreStats,
    skillLevels: participant.skillLevels,
    knownPowers: participant.knownPowers,
    resources: {
      hp: participant.currentHp,
      mana: participant.currentMana,
      inspiration: participant.currentInspiration ?? 0,
      positiveKarma: participant.currentPositiveKarma ?? 0,
      negativeKarma: participant.currentNegativeKarma ?? 0,
    },
    actionState: createActionState(),
    movement: createMovementState(participant.movementMaxMeters),
    derived: createDerivedSnapshot(participant),
    statuses: [],
    effects: [],
    perTurnTrackers: {
      brawlAttacksUsed: 0,
      actionsResolved: 0,
      reactionsResolved: 0,
    },
    defeated: participant.currentHp <= 0,
    removed: false,
    insertionOrder,
  };
}

function createChooseActionWorkflow(
  actorParticipantId: ParticipantId,
  controller: CombatController = {
    controllerRole: "system",
    controllerParticipantId: null,
  }
): CombatWorkflowState {
  return {
    mode: "turn_action",
    step: "choose_action",
    actorParticipantId,
    controllerRole: controller.controllerRole,
    controllerParticipantId: controller.controllerParticipantId,
    selectedActionFamilyId: null,
    selectedSubtypeId: null,
    selectedTargetIds: [],
    parameters: {},
    targetRule: null,
    minTargets: 0,
    maxTargets: 0,
    canBack: false,
    canCancel: false,
    originatingEventId: null,
  };
}

function createReactionWorkflow(
  actorParticipantId: ParticipantId,
  controller: CombatController = {
    controllerRole: "system",
    controllerParticipantId: null,
  }
): CombatWorkflowState {
  return {
    mode: "reaction",
    step: "reaction_prompt",
    actorParticipantId,
    controllerRole: controller.controllerRole,
    controllerParticipantId: controller.controllerParticipantId,
    selectedActionFamilyId: "reaction",
    selectedSubtypeId: null,
    selectedTargetIds: [],
    parameters: {},
    targetRule: "none",
    minTargets: 0,
    maxTargets: 0,
    canBack: false,
    canCancel: false,
    originatingEventId: null,
  };
}

function mapPowerActionToRequestedAction(actionType: string | null): RequestedAction | null {
  if (actionType === null) {
    return null;
  }

  if (actionType === "bonus_or_standard") {
    return "bonus";
  }

  if (actionType === "bonus_plus_standard") {
    return "standard";
  }

  if (
    actionType === "standard" ||
    actionType === "bonus" ||
    actionType === "reaction" ||
    actionType === "free"
  ) {
    return actionType;
  }

  return null;
}

function getPowerTargetRule(powerId: PowerId): CombatTargetRule {
  switch (powerId) {
    case "body_reinforcement":
      return "single_ally";
    case "crowd_control":
      return "single_enemy";
    case "elementalist":
      return "single_enemy";
    case "healing":
      return "single_ally";
    case "light_support":
      return "self";
    case "necromancy":
      return "none";
    case "shadow_control":
      return "self";
    case "awareness":
      return "none";
  }
}

function getPowerParameterDefinitions(powerId: PowerId) {
  if (powerId !== "body_reinforcement") {
    return [];
  }

  return [
    {
      key: "selectedPhysicalStat",
      label: "Physical Stat",
      type: "select" as const,
      required: true,
      options: [
        { value: "STR", label: "STR" },
        { value: "DEX", label: "DEX" },
        { value: "STAM", label: "STAM" },
      ],
    },
  ];
}

function getCastPowerSubtypes(
  participant: CombatParticipantRuntimeState
): CombatSubtypeDefinition[] {
  const powerIds = Object.entries(participant.knownPowers)
    .filter(([, level]) => (level ?? 0) > 0)
    .map(([powerId]) => powerId as PowerId);

  return powerIds
    .map<CombatSubtypeDefinition | null>((powerId) => {
      const level = participant.knownPowers[powerId] ?? 0;
      const runtimeLevel = getRuntimePowerLevel(powerId, level);

      if (runtimeLevel === null || runtimeLevel.actionType === null) {
        return null;
      }

      const targetRule = getPowerTargetRule(powerId);

      return {
        actionFamilyId: "cast_power" as const,
        subtypeId: `power:${powerId}`,
        label: powerRuntimeLibrary[powerId].name,
        targetRule,
        minTargets: targetRule.startsWith("single") ? 1 : 0,
        maxTargets: targetRule.startsWith("single") ? 1 : 3,
        parameterDefinitions: getPowerParameterDefinitions(powerId),
        requestedAction: mapPowerActionToRequestedAction(runtimeLevel.actionType),
        opensReactionWindow: targetRule === "single_enemy" || targetRule === "multi_enemy",
      };
    })
    .filter((definition) => definition !== null);
}

export function getSubtypeDefinitionsForActionFamily(
  state: CombatEngineState,
  actorParticipantId: ParticipantId,
  actionFamilyId: CombatActionFamilyId
): CombatSubtypeDefinition[] {
  const participant = assertParticipantExists(state, actorParticipantId);

  switch (actionFamilyId) {
    case "attack":
      return [
        {
          actionFamilyId,
          subtypeId: "attack:unarmed_brawl",
          label: "Unarmed / Brawl",
          targetRule: "single_enemy",
          minTargets: 1,
          maxTargets: 1,
          parameterDefinitions: [],
          requestedAction: "standard",
          opensReactionWindow: true,
        },
      ];
    case "cast_power":
      return getCastPowerSubtypes(participant);
    case "move":
      return [
        {
          actionFamilyId,
          subtypeId: "move:advance",
          label: "Advance",
          targetRule: "none",
          minTargets: 0,
          maxTargets: 0,
          parameterDefinitions: [
            {
              key: "distanceMeters",
              label: "Distance (m)",
              type: "number",
              required: true,
              min: 0,
              max: participant.movement.remainingMeters,
            },
          ],
          requestedAction: "move",
          opensReactionWindow: false,
        },
      ];
    case "use_item":
      return [];
    case "free_action":
      return [
        {
          actionFamilyId,
          subtypeId: "free_action:speak",
          label: "Speak / Free Action",
          targetRule: "none",
          minTargets: 0,
          maxTargets: 0,
          parameterDefinitions: [],
          requestedAction: "free",
          opensReactionWindow: false,
        },
      ];
    case "reaction":
      return [
        {
          actionFamilyId,
          subtypeId: "reaction:guard",
          label: "Guard / React",
          targetRule: "none",
          minTargets: 0,
          maxTargets: 0,
          parameterDefinitions: [],
          requestedAction: "reaction",
          opensReactionWindow: false,
        },
      ];
    case "end_turn":
      return [
        {
          actionFamilyId,
          subtypeId: "end_turn:finish",
          label: "End Turn",
          targetRule: "none",
          minTargets: 0,
          maxTargets: 0,
          parameterDefinitions: [],
          requestedAction: null,
          opensReactionWindow: false,
        },
      ];
  }
}

function getSubtypeDefinitionById(
  state: CombatEngineState,
  actorParticipantId: ParticipantId,
  actionFamilyId: CombatActionFamilyId,
  subtypeId: string
): CombatSubtypeDefinition {
  const definition = getSubtypeDefinitionsForActionFamily(
    state,
    actorParticipantId,
    actionFamilyId
  ).find((entry) => entry.subtypeId === subtypeId);

  if (!definition) {
    throw new Error(`Unknown subtype ${subtypeId} for action ${actionFamilyId}.`);
  }

  return definition;
}

function getParticipantRelation(
  actor: CombatParticipantRuntimeState,
  target: CombatParticipantRuntimeState
): "self" | "ally" | "enemy" {
  if (actor.participantId === target.participantId) {
    return "self";
  }

  return actor.teamId === target.teamId ? "ally" : "enemy";
}

function isRelationAllowed(
  relation: "self" | "ally" | "enemy",
  targetRule: CombatTargetRule
): boolean {
  switch (targetRule) {
    case "none":
      return false;
    case "self":
      return relation === "self";
    case "single_any":
    case "multi_any":
      return true;
    case "single_ally":
    case "multi_ally":
      return relation === "ally" || relation === "self";
    case "single_enemy":
    case "multi_enemy":
      return relation === "enemy";
  }
}

export function listTargetDescriptors(
  state: CombatEngineState,
  actorParticipantId: ParticipantId,
  targetRule: CombatTargetRule,
  selectedTargetIds: ParticipantId[]
): CombatTargetDescriptor[] {
  const actor = assertParticipantExists(state, actorParticipantId);

  return Object.values(state.participants).map((participant) => {
    const relation = getParticipantRelation(actor, participant);
    const selectable =
      !participant.removed &&
      !participant.defeated &&
      isRelationAllowed(relation, targetRule);

    return {
      participantId: participant.participantId,
      label: participant.displayName,
      enabled: selectable,
      disabledReason: selectable ? null : "Target is not legal for this selection.",
      relation,
      selected: selectedTargetIds.includes(participant.participantId),
    };
  });
}

export function listSubtypeDescriptors(
  state: CombatEngineState,
  actorParticipantId: ParticipantId,
  actionFamilyId: CombatActionFamilyId
): CombatSubtypeDescriptor[] {
  return getSubtypeDefinitionsForActionFamily(state, actorParticipantId, actionFamilyId).map(
    (definition) => ({
      subtypeId: definition.subtypeId,
      label: definition.label,
      enabled: true,
      disabledReason: null,
    })
  );
}

function validateTargetSelection(
  state: CombatEngineState,
  actorParticipantId: ParticipantId,
  targetRule: CombatTargetRule,
  targetIds: ParticipantId[],
  minTargets: number,
  maxTargets: number
): ParticipantId[] {
  const normalizedIds = uniqueParticipantIds(targetIds);

  if (normalizedIds.length !== targetIds.length) {
    throw new Error("Duplicate targets are not allowed.");
  }

  if (targetRule === "none") {
    if (normalizedIds.length > 0) {
      throw new Error("This action does not accept targets.");
    }

    return [];
  }

  if (targetRule === "self") {
    if (normalizedIds.length !== 1 || normalizedIds[0] !== actorParticipantId) {
      throw new Error("Self-target actions must target the acting participant.");
    }

    return normalizedIds;
  }

  const actor = assertParticipantExists(state, actorParticipantId);

  if (normalizedIds.length < minTargets || normalizedIds.length > maxTargets) {
    throw new Error("Target selection does not satisfy the required target count.");
  }

  for (const targetId of normalizedIds) {
    const participant = assertParticipantExists(state, targetId);

    if (participant.removed) {
      throw new Error("Removed participants cannot be targeted.");
    }

    if (participant.defeated) {
      throw new Error("Defeated participants cannot be targeted by this action.");
    }

    const relation = getParticipantRelation(actor, participant);

    if (!isRelationAllowed(relation, targetRule)) {
      throw new Error("Target selection violates relation rules.");
    }
  }

  return normalizedIds;
}

function getRequiredWorkflowStep(definition: CombatSubtypeDefinition): CombatWorkflowState["step"] {
  if (definition.targetRule !== "none" && definition.targetRule !== "self") {
    return "choose_targets";
  }

  if (definition.parameterDefinitions.length > 0) {
    return "choose_parameters";
  }

  return "confirm";
}

function applySubtypeSelection(
  workflow: CombatWorkflowState,
  definition: CombatSubtypeDefinition
): CombatWorkflowState {
  const selectedTargetIds =
    definition.targetRule === "self" ? [workflow.actorParticipantId] : [];

  return {
    ...workflow,
    step: getRequiredWorkflowStep(definition),
    selectedSubtypeId: definition.subtypeId,
    selectedTargetIds,
    parameters: {},
    targetRule: definition.targetRule,
    minTargets: definition.minTargets,
    maxTargets: definition.maxTargets,
    canBack: true,
    canCancel: true,
  };
}

function assertWorkflowForActor(
  state: CombatEngineState,
  actorParticipantId: ParticipantId
): CombatWorkflowState {
  if (!state.workflow) {
    throw new Error("No active workflow is open.");
  }

  if (state.workflow.actorParticipantId !== actorParticipantId) {
    throw new Error("Workflow actor does not match the command actor.");
  }

  return state.workflow;
}

function getReactionQueueForPendingAction(
  state: CombatEngineState,
  pending: PendingCombatResolution
): ParticipantId[] {
  return pending.targetIds.filter((targetId) => {
    if (targetId === pending.actorParticipantId) {
      return false;
    }

    const participant = assertParticipantExists(state, targetId);

    return (
      !participant.removed &&
      !participant.defeated &&
      getActionAvailability(participant.actionState, "reaction").allowed
    );
  });
}

function createPendingResolutionFromWorkflow(
  state: CombatEngineState,
  workflow: CombatWorkflowState
): PendingCombatResolution {
  if (!workflow.selectedActionFamilyId || !workflow.selectedSubtypeId) {
    throw new Error("Workflow is incomplete.");
  }

  const definition = getSubtypeDefinitionById(
    state,
    workflow.actorParticipantId,
    workflow.selectedActionFamilyId,
    workflow.selectedSubtypeId
  );

  const pending: PendingCombatResolution = {
    actorParticipantId: workflow.actorParticipantId,
    actionFamilyId: workflow.selectedActionFamilyId,
    subtypeId: workflow.selectedSubtypeId,
    targetIds: workflow.selectedTargetIds,
    parameters: workflow.parameters,
    reactionQueue: [],
    currentReactionParticipantId: null,
  };

  if (definition.opensReactionWindow) {
    pending.reactionQueue = getReactionQueueForPendingAction(state, pending);
    pending.currentReactionParticipantId = pending.reactionQueue[0] ?? null;
  }

  return pending;
}

function resetPerTurnTrackers(participant: CombatParticipantRuntimeState): void {
  participant.actionState = resetActionStateForTurn(participant.actionState);
  participant.movement.remainingMeters = participant.movement.maxMeters;
  participant.movement.spentMeters = 0;
  participant.perTurnTrackers = {
    brawlAttacksUsed: 0,
    actionsResolved: 0,
    reactionsResolved: 0,
  };
}

function startTurn(
  state: CombatEngineState,
  actorParticipantId: ParticipantId,
  controller: CombatController,
  drafts: PendingEventDraft[]
): void {
  const participant = assertParticipantExists(state, actorParticipantId);
  resetPerTurnTrackers(participant);
  state.stage = "turn_active";
  state.turn.activeParticipantId = actorParticipantId;
  state.turn.activeIndex = state.turn.turnOrder.indexOf(actorParticipantId);
  state.turn.startedAt = createTimestamp();
  state.workflow = createChooseActionWorkflow(actorParticipantId, controller);
  state.pendingResolution = null;
  drafts.push({
    name: "turn_started",
    actorParticipantId,
    message: `${participant.displayName} starts their turn.`,
  });
}

function computeInitiativeOrder(state: CombatEngineState): ParticipantId[] {
  const rollEntries = Object.values(state.initiative.submittedRolls).filter(
    (entry): entry is NonNullable<typeof entry> => entry !== undefined
  );

  if (rollEntries.length !== Object.keys(state.participants).length) {
    throw new Error("Not all initiative rolls have been submitted.");
  }

  return rollEntries
    .slice()
    .sort((left, right) => {
      if (right.successes !== left.successes) {
        return right.successes - left.successes;
      }

      const leftParticipant = assertParticipantExists(state, left.participantId);
      const rightParticipant = assertParticipantExists(state, right.participantId);

      if (rightParticipant.coreStats.DEX !== leftParticipant.coreStats.DEX) {
        return rightParticipant.coreStats.DEX - leftParticipant.coreStats.DEX;
      }

      if (rightParticipant.coreStats.WITS !== leftParticipant.coreStats.WITS) {
        return rightParticipant.coreStats.WITS - leftParticipant.coreStats.WITS;
      }

      return leftParticipant.insertionOrder - rightParticipant.insertionOrder;
    })
    .map((entry) => entry.participantId);
}

export function getInitiativePreviewOrder(state: CombatEngineState): ParticipantId[] {
  if (state.initiative.manualOrder && state.initiative.manualOrder.length > 0) {
    return state.initiative.manualOrder;
  }

  if (state.initiative.finalized && state.turn.turnOrder.length > 0) {
    return state.turn.turnOrder;
  }

  if (Object.keys(state.initiative.submittedRolls).length === Object.keys(state.participants).length) {
    return computeInitiativeOrder(state);
  }

  return Object.values(state.participants)
    .slice()
    .sort((left, right) => left.insertionOrder - right.insertionOrder)
    .map((participant) => participant.participantId);
}

function buildPreTurnQueue(state: CombatEngineState): ParticipantId[] {
  return uniqueParticipantIds([
    ...state.initiative.surpriseParticipantIds,
    ...state.initiative.freeRoundParticipantIds,
  ]).filter((participantId) => state.turn.turnOrder.includes(participantId));
}

function getWorkflowSubtypeDefinition(
  state: CombatEngineState,
  workflow: CombatWorkflowState
): CombatSubtypeDefinition | null {
  if (!workflow.selectedActionFamilyId || !workflow.selectedSubtypeId) {
    return null;
  }

  return getSubtypeDefinitionById(
    state,
    workflow.actorParticipantId,
    workflow.selectedActionFamilyId,
    workflow.selectedSubtypeId
  );
}

function resolvePendingAction(
  state: CombatEngineState,
  controller: CombatController,
  drafts: PendingEventDraft[]
): void {
  const pending = state.pendingResolution;

  if (!pending) {
    throw new Error("No pending action resolution exists.");
  }

  const actor = assertParticipantExists(state, pending.actorParticipantId);
  const definition = getSubtypeDefinitionById(
    state,
    pending.actorParticipantId,
    pending.actionFamilyId,
    pending.subtypeId
  );

  if (definition.requestedAction !== null) {
    actor.actionState = spendAction(actor.actionState, definition.requestedAction).nextState;
  }

  if (pending.actionFamilyId === "move") {
    const distance = Number(pending.parameters.distanceMeters ?? 0);

    if (!Number.isFinite(distance) || distance < 0) {
      throw new Error("Move distance must be a non-negative number.");
    }

    if (distance > actor.movement.remainingMeters) {
      throw new Error("Move distance exceeds remaining movement.");
    }

    actor.movement.remainingMeters -= distance;
    actor.movement.spentMeters += distance;
  }

  if (pending.subtypeId === "attack:unarmed_brawl") {
    actor.perTurnTrackers.brawlAttacksUsed += 1;
  }

  actor.perTurnTrackers.actionsResolved += 1;
  state.pendingResolution = null;
  state.stage = "turn_active";
  state.workflow = createChooseActionWorkflow(pending.actorParticipantId, controller);
  drafts.push({
    name: "action_resolved",
    actorParticipantId: pending.actorParticipantId,
    message: `${actor.displayName} resolves ${pending.subtypeId}.`,
    payload: {
      actionFamilyId: pending.actionFamilyId,
      subtypeId: pending.subtypeId,
      targetIds: pending.targetIds,
      parameters: pending.parameters,
    },
  });
}

function advanceTurnMutation(
  state: CombatEngineState,
  controller: CombatController,
  drafts: PendingEventDraft[]
): void {
  if (state.turn.turnOrder.length === 0) {
    throw new Error("Combat has no participants.");
  }

  const activeParticipantId = state.turn.activeParticipantId;
  let nextParticipantId: ParticipantId;

  if (
    state.turn.pendingPreTurnParticipantIds.length > 0 &&
    activeParticipantId === state.turn.pendingPreTurnParticipantIds[0]
  ) {
    state.turn.pendingPreTurnParticipantIds = state.turn.pendingPreTurnParticipantIds.slice(1);

    if (state.turn.pendingPreTurnParticipantIds.length > 0) {
      nextParticipantId = state.turn.pendingPreTurnParticipantIds[0];
    } else {
      nextParticipantId = state.turn.turnOrder[0];
    }
  } else if (activeParticipantId === null) {
    nextParticipantId =
      state.turn.pendingPreTurnParticipantIds[0] ?? state.turn.turnOrder[0];
  } else {
    const currentIndex = state.turn.turnOrder.indexOf(activeParticipantId);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= state.turn.turnOrder.length) {
      state.turn.roundNumber += 1;
      nextParticipantId = state.turn.turnOrder[0];
    } else {
      nextParticipantId = state.turn.turnOrder[nextIndex];
    }
  }

  drafts.push({
    name: "turn_advanced",
    actorParticipantId: activeParticipantId,
    message: "Turn advanced.",
    payload: {
      nextParticipantId,
      roundNumber: state.turn.roundNumber,
    },
  });
  startTurn(state, nextParticipantId, controller, drafts);
}

function getActionAvailabilityReason(
  state: CombatEngineState,
  actorParticipantId: ParticipantId,
  actionFamilyId: CombatActionFamilyId
): string | null {
  const participant = assertParticipantExists(state, actorParticipantId);

  if (participant.removed || participant.defeated) {
    return "Participant cannot act.";
  }

  if (state.stage !== "turn_active") {
    return "It is not the turn-action stage.";
  }

  if (state.turn.activeParticipantId !== actorParticipantId) {
    return "It is not this participant's turn.";
  }

  switch (actionFamilyId) {
    case "attack":
      return getActionAvailability(participant.actionState, "standard").allowed
        ? null
        : "No Standard Action available.";
    case "cast_power":
      return getCastPowerSubtypes(participant).length > 0 ? null : "No castable powers.";
    case "move":
      return participant.movement.remainingMeters > 0
        ? null
        : "No movement remaining.";
    case "use_item":
      return "Items are not wired into the combat reducer yet.";
    case "free_action":
      return null;
    case "reaction":
      return "Reactions are prompted by reaction windows only.";
    case "end_turn":
      return null;
  }
}

export function listActionFamilyDescriptors(
  state: CombatEngineState,
  actorParticipantId: ParticipantId
): CombatActionDescriptor[] {
  const actionFamilies: CombatActionFamilyId[] = [
    "attack",
    "cast_power",
    "move",
    "use_item",
    "free_action",
    "end_turn",
  ];

  return actionFamilies.map((actionFamilyId) => {
    const disabledReason = getActionAvailabilityReason(state, actorParticipantId, actionFamilyId);

    return {
      actionFamilyId,
      label: actionFamilyId.replace("_", " "),
      enabled: disabledReason === null,
      disabledReason,
    };
  });
}

export function createCombatEngineState(
  input: CreateCombatEngineStateInput
): CombatEngineState {
  if (input.participants.length === 0) {
    throw new Error("Combat encounters require at least one participant.");
  }

  const createdAt = createTimestamp(input.createdAt);
  const participants = Object.fromEntries(
    input.participants.map((participant, index) => [
      participant.participantId,
      createParticipantState(participant, index),
    ])
  );

  return {
    encounterId: input.encounterId,
    label: input.label,
    authorizationMode: input.authorizationMode ?? "role_enforced",
    stage: "draft",
    revision: 0,
    participants,
    initiative: {
      started: false,
      submittedRolls: {},
      manualOrder: null,
      resolvedOrder: [],
      surpriseParticipantIds: [],
      freeRoundParticipantIds: [],
      finalized: false,
    },
    turn: {
      roundNumber: 0,
      turnOrder: [],
      pendingPreTurnParticipantIds: [],
      activeParticipantId: null,
      activeIndex: null,
      startedAt: null,
    },
    workflow: null,
    pendingResolution: null,
    events: [
      {
        eventId: `${input.encounterId}-event-0-1`,
        name: "encounter_created",
        actorParticipantId: null,
        controllerRole: "system",
        controllerParticipantId: null,
        roundNumber: 0,
        message: "Encounter draft created.",
        payload: {
          participantIds: input.participants.map((participant) => participant.participantId),
        },
        createdAt,
      },
    ],
    createdAt,
    updatedAt: createdAt,
    endedAt: null,
  };
}

export function dispatchCombatCommand(
  state: CombatEngineState,
  command: CombatCommand
): CombatEngineState {
  const nextState = cloneState(state);
  const drafts: PendingEventDraft[] = [];

  switch (command.kind) {
    case "begin_initiative": {
      assertDmController(state, command);

      if (state.stage !== "draft") {
        throw new Error("Initiative can only begin from the draft stage.");
      }

      nextState.stage = "initiative_roll";
      nextState.initiative.started = true;
      drafts.push({
        name: "initiative_started",
        message: "Initiative phase started.",
      });
      break;
    }
    case "submit_initiative_roll": {
      assertActorControl(state, command, command.actorParticipantId);

      if (state.stage !== "initiative_roll") {
        throw new Error("Initiative rolls can only be submitted during initiative_roll.");
      }

      const participant = assertParticipantExists(state, command.actorParticipantId);
      const poolSize = participant.derived.initiativePool;

      if (command.dice.length !== poolSize) {
        throw new Error("Initiative roll must use exactly DEX + WITS dice.");
      }

      const resolution = resolveDicePool(command.dice, poolSize);
      nextState.initiative.submittedRolls[command.actorParticipantId] = {
        participantId: command.actorParticipantId,
        poolSize,
        dice: [...command.dice],
        successes: resolution.successes,
        isBotch: resolution.isBotch,
        submittedAt: createTimestamp(),
      };

      if (
        Object.keys(nextState.initiative.submittedRolls).length ===
        Object.keys(nextState.participants).length
      ) {
        nextState.stage = "initiative_review";
      }

      drafts.push({
        name: "initiative_rolled",
        actorParticipantId: command.actorParticipantId,
        message: `${participant.displayName} submitted initiative.`,
        payload: {
          poolSize,
          successes: resolution.successes,
          dice: command.dice,
        },
      });
      break;
    }
    case "apply_manual_initiative_order": {
      assertDmController(state, command);

      if (state.stage !== "initiative_review") {
        throw new Error("Manual initiative order can only be applied during review.");
      }

      const participantIds = Object.keys(state.participants);
      const normalizedOrder = uniqueParticipantIds(command.orderedParticipantIds);

      if (
        normalizedOrder.length !== participantIds.length ||
        !participantIds.every((participantId) => normalizedOrder.includes(participantId))
      ) {
        throw new Error("Manual initiative order must contain each participant exactly once.");
      }

      nextState.initiative.manualOrder = normalizedOrder;
      drafts.push({
        name: "initiative_reordered",
        message: "Manual initiative order applied.",
        payload: {
          orderedParticipantIds: normalizedOrder,
        },
      });
      break;
    }
    case "set_surprise_participants": {
      assertDmController(state, command);

      if (state.stage !== "initiative_review") {
        throw new Error("Surprise participants can only be configured during initiative review.");
      }

      nextState.initiative.surpriseParticipantIds = uniqueParticipantIds(command.participantIds);
      drafts.push({
        name: "surprise_participants_set",
        message: "Surprise participants updated.",
        payload: {
          participantIds: nextState.initiative.surpriseParticipantIds,
        },
      });
      break;
    }
    case "set_free_round_participants": {
      assertDmController(state, command);

      if (state.stage !== "initiative_review") {
        throw new Error("Free-round participants can only be configured during review.");
      }

      nextState.initiative.freeRoundParticipantIds = uniqueParticipantIds(command.participantIds);
      drafts.push({
        name: "free_round_participants_set",
        message: "Free-round participants updated.",
        payload: {
          participantIds: nextState.initiative.freeRoundParticipantIds,
        },
      });
      break;
    }
    case "finalize_initiative": {
      assertDmController(state, command);

      if (state.stage !== "initiative_review") {
        throw new Error("Initiative can only be finalized during initiative review.");
      }

      const resolvedOrder =
        nextState.initiative.manualOrder ?? computeInitiativeOrder(nextState);

      nextState.initiative.resolvedOrder = resolvedOrder;
      nextState.initiative.finalized = true;
      nextState.turn.turnOrder = [...resolvedOrder];
      nextState.turn.roundNumber = 1;
      nextState.turn.pendingPreTurnParticipantIds = buildPreTurnQueue(nextState);
      nextState.stage = "pre_turn_overrides";
      drafts.push({
        name: "initiative_finalized",
        message: "Initiative order finalized.",
        payload: {
          turnOrder: resolvedOrder,
          pendingPreTurnParticipantIds: nextState.turn.pendingPreTurnParticipantIds,
        },
      });

      const firstParticipantId =
        nextState.turn.pendingPreTurnParticipantIds[0] ?? nextState.turn.turnOrder[0];
      startTurn(nextState, firstParticipantId, command, drafts);
      break;
    }
    case "select_action_family": {
      assertActorControl(state, command, command.actorParticipantId);

      if (state.stage !== "turn_active") {
        throw new Error("Action families can only be selected during an active turn.");
      }

      if (state.turn.activeParticipantId !== command.actorParticipantId) {
        throw new Error("Only the active participant may select turn actions.");
      }

      const disabledReason = getActionAvailabilityReason(
        state,
        command.actorParticipantId,
        command.actionFamilyId
      );

      if (disabledReason !== null) {
        throw new Error(disabledReason);
      }

      const workflow = createChooseActionWorkflow(command.actorParticipantId, command);
      workflow.selectedActionFamilyId = command.actionFamilyId;
      workflow.canCancel = true;
      const subtypeDefinitions = getSubtypeDefinitionsForActionFamily(
        state,
        command.actorParticipantId,
        command.actionFamilyId
      );

      if (subtypeDefinitions.length === 0) {
        throw new Error("This action family has no supported subtypes.");
      }

      nextState.workflow =
        subtypeDefinitions.length === 1
          ? applySubtypeSelection(workflow, subtypeDefinitions[0])
          : {
              ...workflow,
              step: "choose_subtype",
              canBack: true,
            };

      drafts.push({
        name: "workflow_action_selected",
        actorParticipantId: command.actorParticipantId,
        message: `${command.actorParticipantId} selected ${command.actionFamilyId}.`,
        payload: {
          actionFamilyId: command.actionFamilyId,
        },
      });

      if (subtypeDefinitions.length === 1) {
        drafts.push({
          name: "workflow_subtype_selected",
          actorParticipantId: command.actorParticipantId,
          message: `${command.actorParticipantId} auto-selected ${subtypeDefinitions[0].subtypeId}.`,
          payload: {
            subtypeId: subtypeDefinitions[0].subtypeId,
          },
        });
      }
      break;
    }
    case "select_action_subtype": {
      assertActorControl(state, command, command.actorParticipantId);
      const workflow = assertWorkflowForActor(state, command.actorParticipantId);

      if (workflow.step !== "choose_subtype" || !workflow.selectedActionFamilyId) {
        throw new Error("Workflow is not waiting for subtype selection.");
      }

      const definition = getSubtypeDefinitionById(
        state,
        command.actorParticipantId,
        workflow.selectedActionFamilyId,
        command.subtypeId
      );

      nextState.workflow = applySubtypeSelection(cloneState(workflow), definition);
      drafts.push({
        name: "workflow_subtype_selected",
        actorParticipantId: command.actorParticipantId,
        message: `${command.actorParticipantId} selected ${command.subtypeId}.`,
        payload: {
          subtypeId: command.subtypeId,
        },
      });
      break;
    }
    case "select_targets": {
      assertActorControl(state, command, command.actorParticipantId);
      const workflow = assertWorkflowForActor(state, command.actorParticipantId);

      if (workflow.step !== "choose_targets" || workflow.targetRule === null) {
        throw new Error("Workflow is not waiting for target selection.");
      }

      const validTargetIds = validateTargetSelection(
        state,
        command.actorParticipantId,
        workflow.targetRule,
        command.targetIds,
        workflow.minTargets,
        workflow.maxTargets
      );

      const nextWorkflow = cloneState(workflow);
      nextWorkflow.selectedTargetIds = validTargetIds;
      const definition = getWorkflowSubtypeDefinition(state, workflow);

      if (!definition) {
        throw new Error("Workflow subtype is missing.");
      }

      nextWorkflow.step =
        definition.parameterDefinitions.length > 0 ? "choose_parameters" : "confirm";
      nextWorkflow.canBack = true;
      nextWorkflow.canCancel = true;
      nextState.workflow = nextWorkflow;
      drafts.push({
        name: "workflow_targets_selected",
        actorParticipantId: command.actorParticipantId,
        message: `${command.actorParticipantId} selected targets.`,
        payload: {
          targetIds: validTargetIds,
        },
      });
      break;
    }
    case "set_workflow_parameters": {
      assertActorControl(state, command, command.actorParticipantId);
      const workflow = assertWorkflowForActor(state, command.actorParticipantId);
      const definition = getWorkflowSubtypeDefinition(state, workflow);

      if (!definition) {
        throw new Error("Workflow subtype is missing.");
      }

      if (workflow.step !== "choose_parameters" && workflow.step !== "confirm") {
        throw new Error("Workflow is not waiting for parameters.");
      }

      const nextWorkflow = cloneState(workflow);
      nextWorkflow.parameters = { ...nextWorkflow.parameters, ...command.parameters };
      nextWorkflow.step = "confirm";
      nextWorkflow.canBack = true;
      nextWorkflow.canCancel = true;
      nextState.workflow = nextWorkflow;
      drafts.push({
        name: "workflow_parameters_set",
        actorParticipantId: command.actorParticipantId,
        message: `${command.actorParticipantId} updated parameters.`,
        payload: {
          parameterKeys: definition.parameterDefinitions.map((entry) => entry.key),
        },
      });
      break;
    }
    case "workflow_back": {
      if (!state.workflow) {
        throw new Error("No workflow exists to move backward.");
      }

      assertActorControl(state, command, state.workflow.actorParticipantId);

      const currentWorkflow = cloneState(state.workflow);
      const nextWorkflow = cloneState(currentWorkflow);
      const definition = getWorkflowSubtypeDefinition(state, currentWorkflow);

      if (currentWorkflow.step === "choose_subtype") {
        nextWorkflow.step = "choose_action";
        nextWorkflow.selectedSubtypeId = null;
        nextWorkflow.selectedTargetIds = [];
        nextWorkflow.parameters = {};
        nextWorkflow.targetRule = null;
        nextWorkflow.minTargets = 0;
        nextWorkflow.maxTargets = 0;
        nextWorkflow.canBack = false;
      } else if (currentWorkflow.step === "choose_targets") {
        nextWorkflow.step = "choose_subtype";
        nextWorkflow.selectedTargetIds = [];
        nextWorkflow.parameters = {};
        nextWorkflow.canBack = true;
      } else if (currentWorkflow.step === "choose_parameters") {
        if (!definition) {
          throw new Error("Workflow subtype is missing.");
        }

        nextWorkflow.parameters = {};
        nextWorkflow.step =
          definition.targetRule !== "none" && definition.targetRule !== "self"
            ? "choose_targets"
            : "choose_subtype";
      } else if (currentWorkflow.step === "confirm") {
        if (!definition) {
          throw new Error("Workflow subtype is missing.");
        }

        nextWorkflow.parameters = {};

        if (definition.parameterDefinitions.length > 0) {
          nextWorkflow.step = "choose_parameters";
        } else if (definition.targetRule !== "none" && definition.targetRule !== "self") {
          nextWorkflow.step = "choose_targets";
        } else {
          nextWorkflow.step = "choose_subtype";
        }
      } else {
        throw new Error("Workflow cannot move backward from the current step.");
      }

      nextState.workflow = nextWorkflow;
      drafts.push({
        name: "workflow_back",
        actorParticipantId: currentWorkflow.actorParticipantId,
        message: `${currentWorkflow.actorParticipantId} moved workflow backward.`,
      });
      break;
    }
    case "workflow_cancel": {
      if (!state.workflow) {
        throw new Error("No workflow exists to cancel.");
      }

      assertActorControl(state, command, state.workflow.actorParticipantId);

      nextState.workflow = createChooseActionWorkflow(state.workflow.actorParticipantId, command);
      nextState.pendingResolution = null;
      nextState.stage = "turn_active";
      drafts.push({
        name: "workflow_cancelled",
        actorParticipantId: state.workflow.actorParticipantId,
        message: `${state.workflow.actorParticipantId} cancelled the workflow.`,
      });
      break;
    }
    case "confirm_workflow": {
      if (!state.workflow) {
        throw new Error("No workflow exists to confirm.");
      }

      assertActorControl(state, command, state.workflow.actorParticipantId);

      const workflow = state.workflow;
      const definition = getWorkflowSubtypeDefinition(state, workflow);

      if (!definition || workflow.step !== "confirm" || !workflow.selectedActionFamilyId) {
        throw new Error("Workflow is not ready for confirmation.");
      }

      for (const parameterDefinition of definition.parameterDefinitions) {
        if (parameterDefinition.required && !(parameterDefinition.key in workflow.parameters)) {
          throw new Error(`Missing required parameter: ${parameterDefinition.key}`);
        }
      }

      if (workflow.selectedActionFamilyId === "end_turn") {
        drafts.push({
          name: "workflow_confirmed",
          actorParticipantId: workflow.actorParticipantId,
          message: `${workflow.actorParticipantId} confirmed end turn.`,
        });
        advanceTurnMutation(nextState, command, drafts);
        break;
      }

      nextState.pendingResolution = createPendingResolutionFromWorkflow(state, workflow);
      drafts.push({
        name: "workflow_confirmed",
        actorParticipantId: workflow.actorParticipantId,
        message: `${workflow.actorParticipantId} confirmed ${workflow.selectedSubtypeId}.`,
        payload: {
          subtypeId: workflow.selectedSubtypeId,
          targetIds: workflow.selectedTargetIds,
          parameters: workflow.parameters,
        },
      });

      if (nextState.pendingResolution.currentReactionParticipantId) {
        nextState.stage = "reaction_window";
        nextState.workflow = createReactionWorkflow(
          nextState.pendingResolution.currentReactionParticipantId,
          command
        );
        drafts.push({
          name: "reaction_window_opened",
          actorParticipantId: nextState.pendingResolution.currentReactionParticipantId,
          message: "Reaction window opened.",
          payload: {
            reactionQueue: nextState.pendingResolution.reactionQueue,
          },
        });
      } else {
        nextState.stage = "resolving";
        nextState.workflow = null;
        resolvePendingAction(nextState, command, drafts);
      }
      break;
    }
    case "select_reaction": {
      assertActorControl(state, command, command.actorParticipantId);

      if (
        state.stage !== "reaction_window" ||
        !state.pendingResolution ||
        state.pendingResolution.currentReactionParticipantId !== command.actorParticipantId
      ) {
        throw new Error("No reaction prompt is open for this participant.");
      }

      const participant = assertParticipantExists(state, command.actorParticipantId);
      participant.actionState = spendAction(participant.actionState, "reaction").nextState;
      participant.perTurnTrackers.reactionsResolved += 1;
      drafts.push({
        name: "reaction_selected",
        actorParticipantId: command.actorParticipantId,
        message: `${participant.displayName} resolved a reaction.`,
        payload: {
          reactionSubtypeId: command.reactionSubtypeId,
          parameters: command.parameters ?? {},
        },
      });

      const pendingResolution = nextState.pendingResolution;

      if (!pendingResolution) {
        throw new Error("Pending resolution disappeared during reaction handling.");
      }

      pendingResolution.reactionQueue = pendingResolution.reactionQueue.slice(1);
      pendingResolution.currentReactionParticipantId = pendingResolution.reactionQueue[0] ?? null;

      if (pendingResolution.currentReactionParticipantId) {
        nextState.workflow = createReactionWorkflow(
          pendingResolution.currentReactionParticipantId,
          command
        );
      } else {
        nextState.stage = "resolving";
        nextState.workflow = null;
        resolvePendingAction(nextState, command, drafts);
      }
      break;
    }
    case "skip_reaction": {
      assertActorControl(state, command, command.actorParticipantId);

      if (
        state.stage !== "reaction_window" ||
        !state.pendingResolution ||
        state.pendingResolution.currentReactionParticipantId !== command.actorParticipantId
      ) {
        throw new Error("No reaction prompt is open for this participant.");
      }

      drafts.push({
        name: "reaction_skipped",
        actorParticipantId: command.actorParticipantId,
        message: `${command.actorParticipantId} skipped the reaction prompt.`,
      });

      const pendingResolution = nextState.pendingResolution;

      if (!pendingResolution) {
        throw new Error("Pending resolution disappeared during reaction handling.");
      }

      pendingResolution.reactionQueue = pendingResolution.reactionQueue.slice(1);
      pendingResolution.currentReactionParticipantId = pendingResolution.reactionQueue[0] ?? null;

      if (pendingResolution.currentReactionParticipantId) {
        nextState.workflow = createReactionWorkflow(
          pendingResolution.currentReactionParticipantId,
          command
        );
      } else {
        nextState.stage = "resolving";
        nextState.workflow = null;
        resolvePendingAction(nextState, command, drafts);
      }
      break;
    }
    case "advance_turn": {
      assertDmController(state, command);

      if (state.stage !== "turn_active") {
        throw new Error("Turn can only advance from the active turn stage.");
      }

      advanceTurnMutation(nextState, command, drafts);
      break;
    }
    case "finalize_combat": {
      assertDmController(state, command);
      nextState.stage = "completed";
      nextState.workflow = null;
      nextState.pendingResolution = null;
      drafts.push({
        name: "combat_finalized",
        message: "Combat finalized.",
      });
      break;
    }
  }

  return commitState(state, nextState, command, drafts);
}
