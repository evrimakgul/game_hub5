import type { ActionContext } from "../engine/context.ts";
import { executeAction } from "../engine/effectExecutor.ts";
import { createActionForContext } from "../powers/registry.ts";
import {
  buildAssessCharacterHistoryEntry,
  buildDefaultHealingAllocations,
  canEncounterTargetReceiveGroupBuff,
  canEncounterTargetReceiveHealing,
  canEncounterTargetReceiveSingleBuff,
  getAuraSelectedTargetIds,
  getEncounterCastTargetOptions,
  getEncounterPartyMembers,
  getReplacementWarnings,
  isSummonedEncounterTarget,
  isTargetAffectedByAuraSource,
} from "../powers/runtimeSupport.ts";
import type {
  CastRequestPayload,
  EncounterParticipantView,
  PreparedCastRequest,
} from "../types/combatEncounterView.ts";

function buildActionContext(
  payload: CastRequestPayload
): { error: string } | ActionContext {
  const casterView =
    payload.encounterParticipants.find(
      ({ participant }) => participant.characterId === payload.casterCharacter.id
    ) ?? null;
  const validTargetViews = casterView
    ? getEncounterCastTargetOptions({
        casterView,
        encounterParticipants: payload.encounterParticipants,
        selectedPower: payload.selectedPower,
        selectedVariantId: payload.selectedVariantId,
        castMode: payload.castMode,
      })
    : [];
  const validTargetIds = new Set(
    validTargetViews.map(({ participant }) => participant.characterId)
  );
  const selectedTargetViews = payload.selectedTargetIds
    .map((targetId) =>
      payload.encounterParticipants.find(({ participant }) => participant.characterId === targetId)
    )
    .filter(
      (targetView): targetView is EncounterParticipantView =>
        targetView !== undefined && validTargetIds.has(targetView.participant.characterId)
    );
  const fallbackTargetViews = payload.fallbackTargetIds
    .map((targetId) =>
      payload.encounterParticipants.find(({ participant }) => participant.characterId === targetId)
    )
    .filter(
      (targetView): targetView is EncounterParticipantView =>
        targetView !== undefined && validTargetIds.has(targetView.participant.characterId)
    );
  const finalTargetViews =
    selectedTargetViews.length > 0 ? selectedTargetViews : fallbackTargetViews;
  const finalTargets = finalTargetViews
    .map((targetView) => targetView.character)
    .filter((targetCharacter): targetCharacter is NonNullable<typeof targetCharacter> => targetCharacter !== null);

  if (
    payload.selectedTargetIds.some(
      (targetId) => targetId.length > 0 && !validTargetIds.has(targetId)
    )
  ) {
    return { error: "At least one selected target is not valid for this action." };
  }

  if (finalTargets.length === 0) {
    return { error: "Select at least one valid target before casting." };
  }

  return {
    payload,
    casterCharacter: payload.casterCharacter,
    casterName: payload.casterCharacter.sheet.name.trim() || payload.casterDisplayName,
    selectedPower: payload.selectedPower,
    selectedSpellId: payload.selectedVariantId,
    encounterParticipants: payload.encounterParticipants,
    itemsById: payload.itemsById ?? {},
    casterView,
    validTargetViews,
    selectedTargetViews,
    fallbackTargetViews,
    finalTargetViews,
    finalTargets,
    attackOutcome: payload.attackOutcome,
    healingAllocations: Object.fromEntries(
      Object.entries(payload.healingAllocations).map(([targetId, value]) => [
        targetId,
        Math.max(0, Math.trunc(Number(value) || 0)),
      ])
    ),
    selectedStatId: payload.selectedStatId,
    castMode: payload.castMode,
    selectedDamageType: payload.selectedDamageType,
    bonusManaSpend: Math.max(0, Math.trunc(payload.bonusManaSpend)),
    selectedSummonOptionId: payload.selectedSummonOptionId,
  };
}

export function prepareCastRequest(
  payload: CastRequestPayload
): { error: string } | { request: PreparedCastRequest; warnings: string[] } {
  const contextResult = buildActionContext(payload);
  if ("error" in contextResult) {
    return contextResult;
  }

  const action = createActionForContext(contextResult);
  if (!action) {
    return {
      error: `${payload.selectedPower.name} does not have a supported spell implementation.`,
    };
  }

  try {
    return executeAction(action, contextResult);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to prepare cast request.",
    };
  }
}

export {
  buildAssessCharacterHistoryEntry,
  buildDefaultHealingAllocations,
  canEncounterTargetReceiveGroupBuff,
  canEncounterTargetReceiveHealing,
  canEncounterTargetReceiveSingleBuff,
  getAuraSelectedTargetIds,
  getEncounterCastTargetOptions,
  getEncounterPartyMembers,
  getReplacementWarnings,
  isSummonedEncounterTarget,
  isTargetAffectedByAuraSource,
};
