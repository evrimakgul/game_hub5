import { POWER_USAGE_KEYS, getPowerUsageCount } from "./powerUsage.ts";
import { BODY_REINFORCEMENT_CANTRIP_SPELL_NAME } from "../powers/spellLabels.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { EncounterOngoingState } from "../types/combatEncounter.ts";

export type BruteDefianceState = {
  isAvailable: boolean;
  isEligible: boolean;
  usageSpent: boolean;
  reviveHp: number;
  statusText: string;
};

export function getBruteDefianceReviveHp(powerLevel: number): number {
  if (powerLevel >= 5) {
    return 16;
  }

  if (powerLevel === 4) {
    return 8;
  }

  if (powerLevel === 3) {
    return 4;
  }

  if (powerLevel === 2) {
    return 2;
  }

  if (powerLevel === 1) {
    return 1;
  }

  return 0;
}

export function getBodyReinforcementLevel(character: CharacterRecord): number {
  return (
    character.sheet.powers.find((power) => power.id === "body_reinforcement")?.level ?? 0
  );
}

export function hasPendingBruteDefianceRevive(
  ongoingStates: EncounterOngoingState[],
  characterId: string
): boolean {
  return ongoingStates.some(
    (state) => state.kind === "body_reinforcement_revive" && state.characterId === characterId
  );
}

export function getBruteDefianceState(
  character: CharacterRecord,
  ongoingStates: EncounterOngoingState[] = []
): BruteDefianceState {
  const powerLevel = getBodyReinforcementLevel(character);
  if (powerLevel < 1) {
    return {
      isAvailable: false,
      isEligible: false,
      usageSpent: false,
      reviveHp: 0,
      statusText: `${BODY_REINFORCEMENT_CANTRIP_SPELL_NAME} is not unlocked.`,
    };
  }

  const reviveHp = getBruteDefianceReviveHp(powerLevel);
  const usageSpent =
    getPowerUsageCount(
      character.sheet.powerUsageState,
      "daily",
      POWER_USAGE_KEYS.bodyReinforcementRevive
    ) >= 1;
  const pending = hasPendingBruteDefianceRevive(ongoingStates, character.id);
  const isEligible =
    !usageSpent && !pending && character.sheet.currentHp <= 0 && character.sheet.currentHp >= -5;

  if (usageSpent) {
    return {
      isAvailable: true,
      isEligible: false,
      usageSpent: true,
      reviveHp,
      statusText: `${BODY_REINFORCEMENT_CANTRIP_SPELL_NAME} has already been used today.`,
    };
  }

  if (pending) {
    return {
      isAvailable: true,
      isEligible: false,
      usageSpent: false,
      reviveHp,
      statusText: `${BODY_REINFORCEMENT_CANTRIP_SPELL_NAME} is already queued to revive after one turn.`,
    };
  }

  if (isEligible) {
    return {
      isAvailable: true,
      isEligible: true,
      usageSpent: false,
      reviveHp,
      statusText: `Will revive to ${reviveHp} HP after one turn while HP stays between 0 and -5.`,
    };
  }

  return {
    isAvailable: true,
    isEligible: false,
    usageSpent: false,
    reviveHp,
    statusText: `${BODY_REINFORCEMENT_CANTRIP_SPELL_NAME} triggers only while HP is between 0 and -5.`,
  };
}
