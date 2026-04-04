import type { ActivePowerEffect } from "../types/activePowerEffects";
import {
  buildCharacterItemModifierSources,
  getCharacterItemUtilityTraits,
} from "../lib/items.ts";
import {
  getPassiveManaBonus,
  getPassiveSkillSources,
  getPassiveUtilityTraits,
} from "../powers/passiveRegistry.ts";
import type {
  CharacterDraft,
  SkillEntry,
  StatEntry,
  StatSource,
} from "./characterTemplate.ts";
import type { StatId } from "../types/character.ts";
import type { DamageTypeId, ResistanceLevel } from "../rules/resistances.ts";
import {
  calculateArmorClass,
  calculateInitiative,
  calculateMaxHP,
  calculateOccultManaBonus,
  calculateRangedBonusDice,
} from "../rules/stats.ts";
import type { SharedItemRecord } from "../types/items.ts";

export type CharacterBreakdown = {
  base: number;
  gearSources: StatSource[];
  buffSources: StatSource[];
  value: number;
  summary: string;
  detail: string;
};

export type CharacterDerivedValues = {
  currentStats: Record<StatId, number>;
  currentMana: number;
  maxMana: number;
  baseMana: number;
  passiveManaBonus: number;
  occultManaBonus: number;
  maxHp: number;
  temporaryHp: number;
  permanentInspiration: number;
  temporaryInspiration: number;
  totalInspiration: number;
  initiative: number;
  movement: string;
  movementSelectable: number;
  armorClass: number;
  damageReduction: number;
  soak: number;
  meleeAttack: number;
  rangedAttack: number;
  meleeDamage: number;
  rangedDamage: string;
  utilityTraits: string[];
  activePowerEffects: ActivePowerEffect[];
};

function sumSources(sources: StatSource[]): number {
  return sources.reduce((total, source) => total + source.value, 0);
}

function buildSummary(base: number, gearSources: StatSource[], buffSources: StatSource[]): string {
  return `Base ${base} + Gears ${sumSources(gearSources)} + Buffs ${sumSources(buffSources)}`;
}

function buildDetail(gearSources: StatSource[], buffSources: StatSource[]): string {
  const gearText =
    gearSources.length > 0
      ? gearSources
          .map((source) => `${source.label} ${source.value >= 0 ? "+" : ""}${source.value}`)
          .join(", ")
      : "none";
  const buffText =
    buffSources.length > 0
      ? buffSources
          .map((source) => `${source.label} ${source.value >= 0 ? "+" : ""}${source.value}`)
          .join(", ")
      : "none";

  return `Gear: ${gearText} | Buffs: ${buffText}`;
}

function getPowerEffectSources(
  sheet: CharacterDraft,
  targetType: "stat" | "skill" | "derived" | "resistance",
  targetId: string
): StatSource[] {
  return (sheet.activePowerEffects ?? []).flatMap((effect) =>
    effect.modifiers
      .filter((modifier) => modifier.targetType === targetType && modifier.targetId === targetId)
      .map((modifier) => ({
        label: modifier.sourceLabel,
        value: modifier.value,
      }))
  );
}

function getItemSources(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord>,
  targetType: "stat" | "skill" | "derived" | "resistance",
  targetId: string
): StatSource[] {
  return buildCharacterItemModifierSources(sheet, itemsById)
    .filter((modifier) => modifier.targetType === targetType && modifier.targetId === targetId)
    .map((modifier) => ({
      label: modifier.sourceLabel,
      value: modifier.value,
    }));
}

export function getStatBreakdown(
  sheet: CharacterDraft,
  statId: StatId,
  itemsById: Record<string, SharedItemRecord> = {}
): CharacterBreakdown {
  const stat = sheet.statState[statId];
  const gearSources = [...stat.gearSources, ...getItemSources(sheet, itemsById, "stat", statId)];
  const buffSources = [...stat.buffSources, ...getPowerEffectSources(sheet, "stat", statId)];

  return {
    base: stat.base,
    gearSources,
    buffSources,
    value: stat.base + sumSources(gearSources) + sumSources(buffSources),
    summary: buildSummary(stat.base, gearSources, buffSources),
    detail: buildDetail(gearSources, buffSources),
  };
}

export function getSkillEntry(sheet: CharacterDraft, skillId: string): SkillEntry | undefined {
  return sheet.skills.find((entry) => entry.id === skillId);
}

export function getSkillBreakdown(
  sheet: CharacterDraft,
  skillId: string,
  itemsById: Record<string, SharedItemRecord> = {}
): CharacterBreakdown {
  const skill = getSkillEntry(sheet, skillId);
  const gearSources = [...(skill?.gearSources ?? []), ...getItemSources(sheet, itemsById, "skill", skillId)];
  const buffSources = [
    ...(skill?.buffSources ?? []),
    ...getPowerEffectSources(sheet, "skill", skillId),
    ...getPassiveSkillSources(sheet, skillId, itemsById),
  ];
  const base = skill?.base ?? 0;

  return {
    base,
    gearSources,
    buffSources,
    value: base + sumSources(gearSources) + sumSources(buffSources),
    summary: buildSummary(base, gearSources, buffSources),
    detail: buildDetail(gearSources, buffSources),
  };
}

export function getCurrentStatValue(
  sheet: CharacterDraft,
  statId: StatId,
  itemsById: Record<string, SharedItemRecord> = {}
): number {
  return getStatBreakdown(sheet, statId, itemsById).value;
}

export function getCurrentSkillValue(
  sheet: CharacterDraft,
  skillId: string,
  itemsById: Record<string, SharedItemRecord> = {}
): number {
  return getSkillBreakdown(sheet, skillId, itemsById).value;
}

export function getDerivedModifierTotal(
  sheet: CharacterDraft,
  targetId: string,
  itemsById: Record<string, SharedItemRecord> = {}
): number {
  return sumSources([
    ...getPowerEffectSources(sheet, "derived", targetId),
    ...getItemSources(sheet, itemsById, "derived", targetId),
  ]);
}

export function getResistanceModifierTotal(
  sheet: CharacterDraft,
  damageTypeId: DamageTypeId,
  itemsById: Record<string, SharedItemRecord> = {}
): number {
  return sumSources([
    ...getPowerEffectSources(sheet, "resistance", damageTypeId),
    ...getItemSources(sheet, itemsById, "resistance", damageTypeId),
  ]);
}

export function getResolvedResistanceLevel(
  sheet: CharacterDraft,
  damageTypeId: DamageTypeId,
  itemsById: Record<string, SharedItemRecord> = {}
): ResistanceLevel {
  const baseLevel = sheet.resistances[damageTypeId] ?? 0;
  const nextLevel = Math.trunc(baseLevel + getResistanceModifierTotal(sheet, damageTypeId, itemsById));

  if (nextLevel < -2) {
    return -2;
  }

  if (nextLevel > 2) {
    return 2;
  }

  return nextLevel as ResistanceLevel;
}

export function calculateT1BaseMana(
  sheet: CharacterDraft,
  currentStats: Record<StatId, number>
): number {
  return sheet.powers.reduce((total, power) => {
    return total + power.level + (currentStats[power.governingStat] ?? 0);
  }, 0);
}

export function getCurrentManaValue(sheet: CharacterDraft, maxMana: number): number {
  if (!sheet.manaInitialized) {
    return maxMana;
  }

  return Math.max(0, Math.min(sheet.currentMana, maxMana));
}

export function buildCharacterDerivedValues(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord> = {}
): CharacterDerivedValues {
  const currentStats = {
    STR: getCurrentStatValue(sheet, "STR", itemsById),
    DEX: getCurrentStatValue(sheet, "DEX", itemsById),
    STAM: getCurrentStatValue(sheet, "STAM", itemsById),
    CHA: getCurrentStatValue(sheet, "CHA", itemsById),
    APP: getCurrentStatValue(sheet, "APP", itemsById),
    MAN: getCurrentStatValue(sheet, "MAN", itemsById),
    INT: getCurrentStatValue(sheet, "INT", itemsById),
    WITS: getCurrentStatValue(sheet, "WITS", itemsById),
    PER: getCurrentStatValue(sheet, "PER", itemsById),
  };
  const occultManaBonus = calculateOccultManaBonus(getCurrentSkillValue(sheet, "occultism", itemsById), sheet.xpUsed);
  const passiveManaBonus = getPassiveManaBonus(sheet, itemsById);
  const maxMana =
    calculateT1BaseMana(sheet, currentStats) +
    occultManaBonus +
    passiveManaBonus +
    getDerivedModifierTotal(sheet, "max_mana", itemsById);
  const currentMana = getCurrentManaValue(sheet, maxMana);
  const attackDiceBonus = getDerivedModifierTotal(sheet, "attack_dice_bonus", itemsById);
  const meleeAttack =
    getCurrentSkillValue(sheet, "melee", itemsById) +
    currentStats.DEX +
    attackDiceBonus +
    getDerivedModifierTotal(sheet, "melee_attack", itemsById);
  const rangedAttack =
    getCurrentSkillValue(sheet, "ranged", itemsById) +
    currentStats.DEX +
    calculateRangedBonusDice(currentStats.PER) +
    attackDiceBonus +
    getDerivedModifierTotal(sheet, "ranged_attack", itemsById);
  const temporaryInspiration = sheet.temporaryInspiration;
  const utilityTraits = [
    ...new Set([
      ...getPassiveUtilityTraits(sheet, itemsById),
      ...getCharacterItemUtilityTraits(sheet, itemsById),
    ]),
  ];

  return {
    currentStats,
    currentMana,
    maxMana,
    baseMana: calculateT1BaseMana(sheet, currentStats),
    passiveManaBonus,
    occultManaBonus,
    maxHp: calculateMaxHP(currentStats.STAM),
    temporaryHp: Math.max(0, sheet.temporaryHp),
    permanentInspiration: sheet.inspiration,
    temporaryInspiration,
    totalInspiration: sheet.inspiration + temporaryInspiration,
    initiative: calculateInitiative(currentStats.DEX, currentStats.WITS),
    movement: "20 + 5",
    movementSelectable: 25,
    armorClass: calculateArmorClass(
      currentStats.DEX,
      getCurrentSkillValue(sheet, "athletics", itemsById),
      getDerivedModifierTotal(sheet, "armor_class", itemsById)
    ),
    damageReduction: getDerivedModifierTotal(sheet, "damage_reduction", itemsById),
    soak: currentStats.STAM + getDerivedModifierTotal(sheet, "soak", itemsById),
    meleeAttack,
    rangedAttack,
    meleeDamage: currentStats.STR + getDerivedModifierTotal(sheet, "melee_damage", itemsById),
    rangedDamage: "-",
    utilityTraits,
    activePowerEffects: [...(sheet.activePowerEffects ?? [])],
  };
}

export function getBreakdownSummary(
  base: number,
  gearSources: StatSource[],
  buffSources: StatSource[]
): string {
  return buildSummary(base, gearSources, buffSources);
}

export function getBreakdownDetail(
  gearSources: StatSource[],
  buffSources: StatSource[]
): string {
  return buildDetail(gearSources, buffSources);
}
