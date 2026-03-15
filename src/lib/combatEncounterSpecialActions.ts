import { POWER_USAGE_KEYS, getPowerUsageCount } from "./powerUsage.ts";
import { createTimestampedId } from "./ids.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { PreparedCastRequest } from "../types/combatEncounterView.ts";

export type BodyReinforcementReviveState = {
  isAvailable: boolean;
  isEligible: boolean;
  usageSpent: boolean;
  reviveHp: number;
  statusText: string;
};

function buildPreparedActionRequest(
  casterCharacterId: string,
  targetCharacterId: string
): PreparedCastRequest {
  return {
    casterCharacterId,
    targetCharacterIds: [targetCharacterId],
    manaCost: 0,
    effects: [],
    historyEntries: [],
    activityLogEntries: [],
    healingApplications: [],
    damageApplications: [],
    resourceChanges: [],
    statusTagChanges: [],
    usageCounterChanges: [],
    summonChanges: [],
    ongoingStateChanges: [],
  };
}

function buildEncounterActivityLogEntry(summary: string) {
  return {
    id: createTimestampedId("encounter-log"),
    createdAt: new Date().toISOString(),
    summary,
  };
}

export function getBodyReinforcementReviveState(
  character: CharacterRecord
): BodyReinforcementReviveState {
  const powerLevel = character.sheet.powers.find((power) => power.id === "body_reinforcement")?.level ?? 0;
  if (powerLevel < 2) {
    return {
      isAvailable: false,
      isEligible: false,
      usageSpent: false,
      reviveHp: 0,
      statusText: "Body Reinforcement revive is not unlocked.",
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
      statusText: "Body Reinforcement revive has already been used today.",
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
    statusText: "Body Reinforcement revive becomes available only while HP is between 0 and -5.",
  };
}

export function prepareBodyReinforcementReviveRequest(payload: {
  character: CharacterRecord;
}): { error: string } | { request: PreparedCastRequest; reviveHp: number } {
  const reviveState = getBodyReinforcementReviveState(payload.character);
  if (!reviveState.isAvailable) {
    return { error: reviveState.statusText };
  }

  if (!reviveState.isEligible) {
    return { error: reviveState.statusText };
  }

  const request = buildPreparedActionRequest(payload.character.id, payload.character.id);
  request.resourceChanges = [
    {
      characterId: payload.character.id,
      field: "currentHp",
      operation: "set",
      value: reviveState.reviveHp,
    },
  ];
  request.usageCounterChanges = [
    {
      characterId: payload.character.id,
      operation: "increment",
      scope: "daily",
      key: POWER_USAGE_KEYS.bodyReinforcementRevive,
      targetCharacterId: null,
      amount: 1,
    },
  ];
  request.activityLogEntries = [
    buildEncounterActivityLogEntry(
      `Body Reinforcement revived ${payload.character.sheet.name.trim() || payload.character.id} to ${reviveState.reviveHp} HP.`
    ),
  ];

  return { request, reviveHp: reviveState.reviveHp };
}
