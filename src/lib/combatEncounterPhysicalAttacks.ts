import {
  buildCharacterDerivedValues,
  getDerivedModifierTotal,
} from "../config/characterRuntime.ts";
import { applyDamageToSheet } from "../rules/combatResolution.ts";
import { resolveDicePool } from "../rules/combat.ts";
import { createTimestampedId } from "./ids.ts";
import { rollD10Faces } from "./dice.ts";
import {
  getEquippedWeaponHandItems,
  getLegacyEquippedWeaponItems,
  itemOccupiesBothWeaponHands,
} from "./items.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { PreparedCastRequest } from "../types/combatEncounterView.ts";
import type { SharedItemRecord } from "../types/items.ts";

export type PhysicalAttackProfileId =
  | "brawl"
  | "one_handed"
  | "dual_one_handed"
  | "two_handed"
  | "oversized"
  | "bow";

export type PhysicalAttackProfile = {
  id: PhysicalAttackProfileId;
  label: string;
  attacksPerAction: number;
  attackPool: number;
  successDc: number;
  baseDamagePool: number;
};

type PhysicalAttackSequenceResult = {
  index: number;
  hitSuccesses: number;
  targetArmorClass: number;
  marginal: number;
  damageSuccesses: number;
  targetDamageReduction: number;
  appliedDamage: number;
  missed: boolean;
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

function getPhysicalAttackProfileSuccesses(
  faces: number[],
  poolSize: number,
  successDc: number
): number {
  if (successDc <= 6) {
    return resolveDicePool(faces, poolSize).successes;
  }

  return faces.reduce((total, face) => {
    if (face === 1) {
      return total - 1;
    }

    if (face >= successDc && face <= 9) {
      return total + 1;
    }

    if (face === 10) {
      return total + (poolSize < 10 ? 1 : 2);
    }

    return total;
  }, 0);
}

function getResolvedWeaponCandidates(
  sheet: CharacterRecord["sheet"],
  itemsById: Record<string, SharedItemRecord>
): SharedItemRecord[] {
  const weaponHands = getEquippedWeaponHandItems(sheet, itemsById);
  const handWeapons = [weaponHands.weapon_primary, weaponHands.weapon_secondary]
    .filter((item): item is SharedItemRecord => item !== null && item.category === "weapon")
    .filter(
      (item, index, entries) => entries.findIndex((candidate) => candidate.id === item.id) === index
    );

  if (handWeapons.length > 0) {
    return handWeapons;
  }

  return getLegacyEquippedWeaponItems(sheet, itemsById).filter(
    (item, index, entries) => entries.findIndex((candidate) => candidate.id === item.id) === index
  );
}

export function getResolvedPhysicalAttackProfile(
  sheet: CharacterRecord["sheet"],
  itemsById: Record<string, SharedItemRecord> = {}
): PhysicalAttackProfile {
  const derived = buildCharacterDerivedValues(sheet, itemsById);
  const rangedDamageBonus = getDerivedModifierTotal(sheet, "ranged_damage", itemsById);
  const weaponCandidates = getResolvedWeaponCandidates(sheet, itemsById);
  const occupyingBothHandsWeapon = weaponCandidates.find((item) => itemOccupiesBothWeaponHands(item));
  const oneHandedWeapons = weaponCandidates.filter((item) => item.subtype === "one_handed");
  const brawlWeapons = weaponCandidates.filter((item) => item.subtype === "brawl");

  if (occupyingBothHandsWeapon) {
    if (occupyingBothHandsWeapon.subtype === "oversized") {
      return {
        id: "oversized",
        label: occupyingBothHandsWeapon.name || "Oversized Weapon",
        attacksPerAction: 1,
        attackPool: derived.meleeAttack,
        successDc: 6,
        baseDamagePool: derived.meleeDamage + 9,
      };
    }

    if (occupyingBothHandsWeapon.subtype === "bow") {
      return {
        id: "bow",
        label: occupyingBothHandsWeapon.name || "Bow",
        attacksPerAction: 1,
        attackPool: derived.rangedAttack,
        successDc: 6,
        baseDamagePool: 5 + rangedDamageBonus,
      };
    }

    return {
      id: "two_handed",
      label: occupyingBothHandsWeapon.name || "Two-Handed Weapon",
      attacksPerAction: 1,
      attackPool: derived.meleeAttack,
      successDc: 6,
      baseDamagePool: derived.meleeDamage + 6,
    };
  }

  if (oneHandedWeapons.length >= 2) {
    return {
      id: "dual_one_handed",
      label: "Two One-Handed Weapons",
      attacksPerAction: 2,
      attackPool: derived.meleeAttack,
      successDc: 7,
      baseDamagePool: derived.meleeDamage + 2,
    };
  }

  if (oneHandedWeapons.length === 1) {
    return {
      id: "one_handed",
      label: oneHandedWeapons[0].name || "One-Handed Weapon",
      attacksPerAction: 1,
      attackPool: derived.meleeAttack,
      successDc: 6,
      baseDamagePool: derived.meleeDamage + 2,
    };
  }

  if (brawlWeapons.length > 0) {
    return {
      id: "brawl",
      label: brawlWeapons[0].name || "Brawl Weapon",
      attacksPerAction: 2,
      attackPool: derived.meleeAttack,
      successDc: 6,
      baseDamagePool: derived.meleeDamage,
    };
  }

  return {
    id: "brawl",
    label: "Brawl / Fists",
    attacksPerAction: 2,
    attackPool: derived.meleeAttack,
    successDc: 6,
    baseDamagePool: derived.meleeDamage,
  };
}

function formatPhysicalAttackSequence(result: PhysicalAttackSequenceResult): string {
  if (result.missed) {
    return `A${result.index} miss ${result.hitSuccesses} vs AC ${result.targetArmorClass}`;
  }

  return `A${result.index} hit ${result.hitSuccesses} vs AC ${result.targetArmorClass}, marginal ${result.marginal}, dmg ${result.damageSuccesses} vs DR ${result.targetDamageReduction}, took ${result.appliedDamage}`;
}

export function preparePhysicalAttackRequest(payload: {
  casterCharacter: CharacterRecord;
  targetCharacter: CharacterRecord;
  itemsById?: Record<string, SharedItemRecord>;
}): { error: string } | { request: PreparedCastRequest; profile: PhysicalAttackProfile } {
  if (payload.casterCharacter.id === payload.targetCharacter.id) {
    return { error: "Choose another target for a physical attack." };
  }

  const itemsById = payload.itemsById ?? {};
  const profile = getResolvedPhysicalAttackProfile(payload.casterCharacter.sheet, itemsById);
  const request = buildPreparedActionRequest(payload.casterCharacter.id, payload.targetCharacter.id);
  const sequenceResults: PhysicalAttackSequenceResult[] = [];
  let previewTargetSheet = payload.targetCharacter.sheet;

  for (let index = 0; index < profile.attacksPerAction; index += 1) {
    const targetDerived = buildCharacterDerivedValues(previewTargetSheet, itemsById);
    const hitFaces = rollD10Faces(profile.attackPool);
    const hitSuccesses = getPhysicalAttackProfileSuccesses(
      hitFaces,
      profile.attackPool,
      profile.successDc
    );

    if (hitSuccesses <= targetDerived.armorClass) {
      sequenceResults.push({
        index: index + 1,
        hitSuccesses,
        targetArmorClass: targetDerived.armorClass,
        marginal: 0,
        damageSuccesses: 0,
        targetDamageReduction: targetDerived.damageReduction,
        appliedDamage: 0,
        missed: true,
      });
      continue;
    }

    const marginal = hitSuccesses - targetDerived.armorClass;
    const damagePool = Math.max(0, profile.baseDamagePool + marginal);
    const damageFaces = rollD10Faces(damagePool);
    const damageSuccesses = Math.max(
      0,
      getPhysicalAttackProfileSuccesses(damageFaces, damagePool, 6)
    );
    const damagePreview = applyDamageToSheet(previewTargetSheet, {
      rawAmount: damageSuccesses,
      damageType: "physical",
      mitigationChannel: "dr",
      itemsById,
    });

    if (damageSuccesses > 0) {
      request.damageApplications.push({
        targetCharacterId: payload.targetCharacter.id,
        rawAmount: damageSuccesses,
        damageType: "physical",
        mitigationChannel: "dr",
        sourceCharacterId: payload.casterCharacter.id,
        sourceLabel: profile.label,
        sourceSummary: `${profile.label} (${damageSuccesses} physical)`,
      });
    }

    sequenceResults.push({
      index: index + 1,
      hitSuccesses,
      targetArmorClass: targetDerived.armorClass,
      marginal,
      damageSuccesses,
      targetDamageReduction: targetDerived.damageReduction,
      appliedDamage: damagePreview.appliedDamage,
      missed: false,
    });
    previewTargetSheet = damagePreview.sheet;
  }

  const attackerName = payload.casterCharacter.sheet.name.trim() || payload.casterCharacter.id;
  const targetName = payload.targetCharacter.sheet.name.trim() || payload.targetCharacter.id;
  request.activityLogEntries = [
    buildEncounterActivityLogEntry(
      `${attackerName} attacked ${targetName} with ${profile.label}. ${sequenceResults
        .map(formatPhysicalAttackSequence)
        .join(" | ")}.`
    ),
  ];

  return { request, profile };
}
