import { getSupportedCastablePowers } from "../rules/powerEffects.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { SharedItemRecord } from "../types/items.ts";
import type { WorldCastRequestPayload } from "../lib/powerCasting.ts";
import { getPreferredCastPowerVariantForEnvironment } from "../lib/powerCasting.ts";
import { getWorldCastTargetOptions } from "../lib/worldCasting.ts";
import {
  type PowerCastFormState,
  usePowerCastFormState,
} from "./usePowerCastFormState.ts";

type UseWorldPowerCastStateParams = {
  casterCharacter: CharacterRecord | null;
  characters: CharacterRecord[];
  itemsById: Record<string, SharedItemRecord>;
  requestCast: (payload: WorldCastRequestPayload) => string | null;
};

export type WorldPowerCastState = PowerCastFormState;

export function useWorldPowerCastState({
  casterCharacter,
  characters,
  itemsById,
  requestCast,
}: UseWorldPowerCastStateParams): WorldPowerCastState {
  const castablePowers = casterCharacter ? getSupportedCastablePowers(casterCharacter.sheet) : [];

  return usePowerCastFormState({
    casterCharacter,
    casterDisplayName: casterCharacter?.sheet.name.trim() || "",
    castablePowers,
    itemsById,
    preferredVariantResolver: (power) =>
      getPreferredCastPowerVariantForEnvironment(power, "world"),
    resolveTargetOptions: ({ selectedPower, selectedVariantId }) =>
      casterCharacter
        ? getWorldCastTargetOptions({
            casterCharacter,
            characters,
            selectedPower,
            selectedVariantId,
          })
        : [],
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
      characters,
      itemsById,
    }),
  });
}
