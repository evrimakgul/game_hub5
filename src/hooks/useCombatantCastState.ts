import { buildItemIndex } from "../lib/items.ts";
import type { PowerEntry } from "../config/characterTemplate";
import { getSupportedCastablePowers } from "../rules/powerEffects.ts";
import { getEncounterCastTargetOptions } from "../lib/combatEncounterCasting";
import type {
  CastRequestPayload,
  EncounterParticipantView,
} from "../types/combatEncounterView";
import { useAppFlow } from "../state/appFlow";
import {
  type PowerCastFormState,
  usePowerCastFormState,
} from "./usePowerCastFormState.ts";

type UseCombatantCastStateParams = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  requestCast: (payload: CastRequestPayload) => string | null;
};

export type CombatantCastState = PowerCastFormState;

export function useCombatantCastState({
  view,
  encounterParticipants,
  requestCast,
}: UseCombatantCastStateParams): CombatantCastState {
  const { items } = useAppFlow();
  const itemsById = buildItemIndex(items);
  const character = view.character;
  const castablePowers = character ? getSupportedCastablePowers(character.sheet) : [];
  return usePowerCastFormState({
    casterCharacter: character,
    casterDisplayName: view.participant.displayName,
    castablePowers,
    itemsById,
    resolveTargetOptions: ({ selectedPower, selectedVariantId, castMode }) =>
      getEncounterCastTargetOptions({
        casterView: view,
        encounterParticipants,
        selectedPower,
        selectedVariantId,
        castMode,
      }).map((targetView) => ({
        id: targetView.participant.characterId,
        label: targetView.participant.displayName,
      })),
    requestCast,
    buildRequestPayload: ({
      casterCharacter,
      casterDisplayName,
      selectedPower,
      selectedVariantId,
      attackOutcome,
      selectedTargetIds,
      fallbackTargetIds,
      healingAllocations,
      selectedStatId,
      castMode,
      selectedDamageType,
      bonusManaSpend,
      selectedSummonOptionId,
    }) => ({
      casterCharacter,
      casterDisplayName,
      selectedPower,
      selectedVariantId,
      attackOutcome,
      selectedTargetIds,
      fallbackTargetIds,
      healingAllocations,
      selectedStatId,
      castMode,
      selectedDamageType,
      bonusManaSpend,
      selectedSummonOptionId,
      encounterParticipants,
      itemsById,
    }),
  });
}
