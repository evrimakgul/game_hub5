import {
  getInitiativePreviewOrder,
  getSubtypeDefinitionsForActionFamily,
  listActionFamilyDescriptors,
  listSubtypeDescriptors,
  listTargetDescriptors,
} from "../config/combatReducer.ts";
import type { CombatEngineState } from "../types/combatEngine.ts";
import type { ParticipantId } from "../types/game.ts";

export function selectCombatantSummaries(state: CombatEngineState) {
  return Object.values(state.participants)
    .slice()
    .sort((left, right) => left.insertionOrder - right.insertionOrder)
    .map((participant) => ({
      participantId: participant.participantId,
      displayName: participant.displayName,
      ownerRole: participant.ownerRole,
      teamId: participant.teamId,
      active: state.turn.activeParticipantId === participant.participantId,
      defeated: participant.defeated,
      removed: participant.removed,
      hp: participant.resources.hp,
      mana: participant.resources.mana,
      initiativePool: participant.derived.initiativePool,
    }));
}

export function selectInitiativeView(state: CombatEngineState) {
  const orderedParticipantIds = getInitiativePreviewOrder(state);

  return {
    stage: state.stage,
    finalized: state.initiative.finalized,
    orderedEntries: orderedParticipantIds.map((participantId, index) => {
      const participant = state.participants[participantId];
      const roll = state.initiative.submittedRolls[participantId] ?? null;

      return {
        rank: index + 1,
        participantId,
        displayName: participant.displayName,
        active: state.turn.activeParticipantId === participantId,
        successes: roll?.successes ?? null,
        poolSize: roll?.poolSize ?? participant.derived.initiativePool,
        surprise: state.initiative.surpriseParticipantIds.includes(participantId),
        freeRound: state.initiative.freeRoundParticipantIds.includes(participantId),
      };
    }),
  };
}

export function selectActionBar(
  state: CombatEngineState,
  viewerParticipantId: ParticipantId | null = state.turn.activeParticipantId
) {
  if (viewerParticipantId === null) {
    return [];
  }

  if (
    state.stage === "reaction_window" &&
    state.pendingResolution?.currentReactionParticipantId === viewerParticipantId
  ) {
    return [];
  }

  if (state.turn.activeParticipantId === viewerParticipantId && state.stage === "turn_active") {
    return listActionFamilyDescriptors(state, viewerParticipantId);
  }

  return [
    {
      actionFamilyId: "free_action" as const,
      label: "free action",
      enabled: true,
      disabledReason: null,
    },
  ];
}

export function selectWorkflowPanel(state: CombatEngineState) {
  const workflow = state.workflow;

  if (!workflow) {
    return null;
  }

  const subtypeDefinitions =
    workflow.selectedActionFamilyId === null
      ? []
      : getSubtypeDefinitionsForActionFamily(
          state,
          workflow.actorParticipantId,
          workflow.selectedActionFamilyId
        );

  const selectedSubtype =
    workflow.selectedSubtypeId === null
      ? null
      : subtypeDefinitions.find((entry) => entry.subtypeId === workflow.selectedSubtypeId) ?? null;

  const subtypeOptions =
    workflow.selectedActionFamilyId === null
      ? []
      : listSubtypeDescriptors(
          state,
          workflow.actorParticipantId,
          workflow.selectedActionFamilyId
        );

  const targetOptions =
    selectedSubtype === null
      ? []
      : listTargetDescriptors(
          state,
          workflow.actorParticipantId,
          selectedSubtype.targetRule,
          workflow.selectedTargetIds
        );

  return {
    mode: workflow.mode,
    step: workflow.step,
    actorParticipantId: workflow.actorParticipantId,
    selectedActionFamilyId: workflow.selectedActionFamilyId,
    selectedSubtypeId: workflow.selectedSubtypeId,
    selectedTargetIds: workflow.selectedTargetIds,
    parameters: workflow.parameters,
    targetRule: selectedSubtype?.targetRule ?? workflow.targetRule,
    minTargets: selectedSubtype?.minTargets ?? workflow.minTargets,
    maxTargets: selectedSubtype?.maxTargets ?? workflow.maxTargets,
    parameterDefinitions: selectedSubtype?.parameterDefinitions ?? [],
    subtypeOptions,
    targetOptions,
    canBack: workflow.canBack,
    canCancel: workflow.canCancel,
  };
}

export function selectReactionPrompt(state: CombatEngineState) {
  const pendingResolution = state.pendingResolution;

  if (
    state.stage !== "reaction_window" ||
    pendingResolution === null ||
    pendingResolution.currentReactionParticipantId === null
  ) {
    return null;
  }

  const participantId = pendingResolution.currentReactionParticipantId;

  return {
    participantId,
    subtypeOptions: listSubtypeDescriptors(state, participantId, "reaction"),
    canSkip: true,
  };
}

export function selectCombatantInspector(
  state: CombatEngineState,
  participantId: ParticipantId | null = state.turn.activeParticipantId
) {
  if (participantId === null) {
    return null;
  }

  const participant = state.participants[participantId];

  return {
    participantId: participant.participantId,
    displayName: participant.displayName,
    ownerRole: participant.ownerRole,
    teamId: participant.teamId,
    hp: participant.resources.hp,
    mana: participant.resources.mana,
    inspiration: participant.resources.inspiration,
    positiveKarma: participant.resources.positiveKarma,
    negativeKarma: participant.resources.negativeKarma,
    actionState: participant.actionState,
    movement: participant.movement,
    statuses: participant.statuses,
    effects: participant.effects,
    derived: participant.derived,
    active: state.turn.activeParticipantId === participantId,
  };
}

export function selectEventLog(state: CombatEngineState, limit?: number) {
  if (typeof limit === "number" && limit >= 0) {
    return state.events.slice(-limit);
  }

  return state.events;
}
