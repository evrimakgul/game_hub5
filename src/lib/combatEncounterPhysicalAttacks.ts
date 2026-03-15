import { buildCharacterDerivedValues } from "../config/characterRuntime";
import { createTimestampedId } from "./ids";
import type { CharacterRecord } from "../types/character";
import type { PreparedCastRequest } from "../types/combatEncounterView";
import type { SharedItemRecord } from "../types/items.ts";

export type PhysicalAttackProfileId =
  | "brawl"
  | "one_handed"
  | "dual_one_handed"
  | "two_handed"
  | "bow";

export type PhysicalAttackOption = {
  id: PhysicalAttackProfileId;
  label: string;
  attacksPerAction: number;
  attackPool: number;
  successDc: number;
  damagePerHit: number;
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

export function getPhysicalAttackOptions(
  sheet: CharacterRecord["sheet"],
  itemsById: Record<string, SharedItemRecord> = {}
): PhysicalAttackOption[] {
  const derived = buildCharacterDerivedValues(sheet, itemsById);
  const equippedWeapons = (sheet.equipment ?? [])
    .map((entry) => (entry.itemId ? itemsById[entry.itemId] : null))
    .filter(
      (item): item is SharedItemRecord => item !== null && item !== undefined && item.category === "weapon"
    );
  const oneHandedCount = equippedWeapons.filter((item) => item.subtype === "one_handed").length;
  const hasTwoHanded = equippedWeapons.some((item) => item.subtype === "two_handed");
  const hasOversized = equippedWeapons.some((item) => item.subtype === "oversized");
  const hasBow = equippedWeapons.some((item) => item.subtype === "bow");
  const hasBrawlWeapon = equippedWeapons.some((item) => item.subtype === "brawl");

  const options: PhysicalAttackOption[] = [
    {
      id: "brawl",
      label: hasBrawlWeapon ? "Brawl Weapon" : "Brawl",
      attacksPerAction: 2,
      attackPool: derived.meleeAttack,
      successDc: 6,
      damagePerHit: derived.currentStats.STR,
    },
  ];

  if (oneHandedCount >= 1) {
    options.push({
      id: "one_handed",
      label: "One-Handed Weapon",
      attacksPerAction: 1,
      attackPool: derived.meleeAttack,
      successDc: 6,
      damagePerHit: derived.currentStats.STR + 2,
    });
  }

  if (oneHandedCount >= 2) {
    options.push({
      id: "dual_one_handed",
      label: "Two One-Handed Weapons",
      attacksPerAction: 2,
      attackPool: derived.meleeAttack,
      successDc: 7,
      damagePerHit: derived.currentStats.STR + 2,
    });
  }

  if (hasTwoHanded || hasOversized) {
    options.push({
      id: "two_handed",
      label: hasOversized ? "Oversized Weapon" : "Two-Handed Weapon",
      attacksPerAction: 1,
      attackPool: derived.meleeAttack,
      successDc: 6,
      damagePerHit: derived.currentStats.STR + (hasOversized ? 9 : 6),
    });
  }

  if (hasBow) {
    options.push({
      id: "bow",
      label: "Bow",
      attacksPerAction: 1,
      attackPool: derived.rangedAttack,
      successDc: 6,
      damagePerHit: 5,
    });
  }

  return options;
}

export function preparePhysicalAttackRequest(payload: {
  casterCharacter: CharacterRecord;
  targetCharacter: CharacterRecord;
  profileId: PhysicalAttackProfileId;
  landedHits: number;
  itemsById?: Record<string, SharedItemRecord>;
}): { error: string } | { request: PreparedCastRequest; option: PhysicalAttackOption } {
  if (payload.casterCharacter.id === payload.targetCharacter.id) {
    return { error: "Choose another target for a physical attack." };
  }

  const option = getPhysicalAttackOptions(
    payload.casterCharacter.sheet,
    payload.itemsById ?? {}
  ).find(
    (candidate) => candidate.id === payload.profileId
  );
  if (!option) {
    return { error: "Choose a valid physical attack option first." };
  }

  const landedHits = Math.max(0, Math.trunc(payload.landedHits));
  if (landedHits > option.attacksPerAction) {
    return {
      error: `${option.label} can land at most ${option.attacksPerAction} hit(s) per action.`,
    };
  }

  const request = buildPreparedActionRequest(
    payload.casterCharacter.id,
    payload.targetCharacter.id
  );
  request.damageApplications = Array.from({ length: landedHits }, () => ({
    targetCharacterId: payload.targetCharacter.id,
    rawAmount: option.damagePerHit,
    damageType: "physical" as const,
    mitigationChannel: "dr" as const,
    sourceCharacterId: payload.casterCharacter.id,
    sourceLabel: option.label,
    sourceSummary: `${option.label} (${option.damagePerHit} physical)`,
  }));
  request.activityLogEntries = [
    buildEncounterActivityLogEntry(
      landedHits === 0
        ? `${payload.casterCharacter.sheet.name.trim() || payload.casterCharacter.id} missed ${payload.targetCharacter.sheet.name.trim() || payload.targetCharacter.id} with ${option.label}.`
        : `${payload.casterCharacter.sheet.name.trim() || payload.casterCharacter.id} hit ${payload.targetCharacter.sheet.name.trim() || payload.targetCharacter.id} with ${option.label} (${landedHits} hit${landedHits === 1 ? "" : "s"}).`
    ),
  ];

  return { request, option };
}
