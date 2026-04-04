import { POWER_USAGE_KEYS, getPowerUsageCount } from "./powerUsage.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { PreparedCastRequest } from "../types/combatEncounterView.ts";
import type { ActionContext } from "../engine/context.ts";
import { executeAction } from "../engine/effectExecutor.ts";
import { BruteDefianceSpellAction } from "../powers/bodyReinforcement.ts";
import { BODY_REINFORCEMENT_CANTRIP_SPELL_NAME } from "../powers/spellLabels.ts";

export type BruteDefianceState = {
  isAvailable: boolean;
  isEligible: boolean;
  usageSpent: boolean;
  reviveHp: number;
  statusText: string;
};

export function getBruteDefianceState(
  character: CharacterRecord
): BruteDefianceState {
  const powerLevel = character.sheet.powers.find((power) => power.id === "body_reinforcement")?.level ?? 0;
  if (powerLevel < 2) {
    return {
      isAvailable: false,
      isEligible: false,
      usageSpent: false,
      reviveHp: 0,
      statusText: `${BODY_REINFORCEMENT_CANTRIP_SPELL_NAME} is not unlocked.`,
    };
  }

  const reviveHp = powerLevel >= 5 ? 4 : 1;
  const usageSpent =
    getPowerUsageCount(
      character.sheet.powerUsageState,
      "daily",
      POWER_USAGE_KEYS.bodyReinforcementRevive
    ) >= 1;
  const isEligible = !usageSpent && character.sheet.currentHp <= 0 && character.sheet.currentHp >= -5;

  if (usageSpent) {
    return {
      isAvailable: true,
      isEligible: false,
      usageSpent: true,
      reviveHp,
      statusText: `${BODY_REINFORCEMENT_CANTRIP_SPELL_NAME} has already been used today.`,
    };
  }

  if (isEligible) {
    return {
      isAvailable: true,
      isEligible: true,
      usageSpent: false,
      reviveHp,
      statusText: `Eligible while HP is between 0 and -5. Revives to ${reviveHp} HP.`,
    };
  }

  return {
    isAvailable: true,
    isEligible: false,
    usageSpent: false,
    reviveHp,
    statusText: `${BODY_REINFORCEMENT_CANTRIP_SPELL_NAME} becomes available only while HP is between 0 and -5.`,
  };
}

export function prepareBruteDefianceRequest(payload: {
  character: CharacterRecord;
}): { error: string } | { request: PreparedCastRequest; reviveHp: number } {
  const reviveState = getBruteDefianceState(payload.character);
  if (!reviveState.isAvailable) {
    return { error: reviveState.statusText };
  }

  if (!reviveState.isEligible) {
    return { error: reviveState.statusText };
  }

  const selectedPower =
    payload.character.sheet.powers.find((power) => power.id === "body_reinforcement") ?? null;
  if (!selectedPower) {
    return { error: `${BODY_REINFORCEMENT_CANTRIP_SPELL_NAME} is not available.` };
  }

  const selfView = {
    participant: {
      characterId: payload.character.id,
      ownerRole: payload.character.ownerRole,
      displayName: payload.character.sheet.name,
      initiativePool: 0,
      initiativeFaces: [],
      initiativeSuccesses: 0,
      dex: 0,
      wits: 0,
      partyId: null,
      controllerCharacterId: null,
      summonTemplateId: null,
      sourcePowerId: null,
    },
    character: payload.character,
    transientCombatant: null,
    snapshot: null,
  };
  const context: ActionContext = {
    payload: null,
    casterCharacter: payload.character,
    casterName: payload.character.sheet.name.trim() || payload.character.id,
    selectedPower,
    selectedSpellId: "default",
    encounterParticipants: [selfView],
    itemsById: {},
    casterView: selfView,
    validTargetViews: [selfView],
    selectedTargetViews: [selfView],
    fallbackTargetViews: [selfView],
    finalTargetViews: [selfView],
    finalTargets: [payload.character],
    attackOutcome: "hit",
    healingAllocations: {},
    selectedStatId: null,
    castMode: "self",
    selectedDamageType: null,
    bonusManaSpend: 0,
    selectedSummonOptionId: null,
  };

  try {
    const { request } = executeAction(new BruteDefianceSpellAction(), context);
    return { request, reviveHp: reviveState.reviveHp };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : `Failed to prepare ${BODY_REINFORCEMENT_CANTRIP_SPELL_NAME}.`,
    };
  }
}
