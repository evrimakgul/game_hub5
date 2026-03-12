import type { ActivePowerEffect } from "../types/activePowerEffects";
import type {
  CharacterDraft,
  SkillEntry,
  StatEntry,
  StatSource,
} from "./characterTemplate.ts";
import type { StatId } from "../types/character.ts";
import { getRuntimePowerCantripLevels } from "../rules/powerData.ts";
import {
  calculateArmorClass,
  calculateInitiative,
  calculateMaxHP,
  calculateOccultManaBonus,
  calculateRangedBonusDice,
} from "../rules/stats.ts";

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
  targetType: "stat" | "skill" | "derived",
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

function getAwarenessAlertnessPassiveSource(sheet: CharacterDraft): StatSource[] {
  const awarenessPower = sheet.powers.find((power) => power.id === "awareness");
  if (!awarenessPower || awarenessPower.level <= 0) {
    return [];
  }

  return [
    {
      label: "Awareness",
      value: awarenessPower.level,
    },
  ];
}

export function getStatBreakdown(sheet: CharacterDraft, statId: StatId): CharacterBreakdown {
  const stat = sheet.statState[statId];
  const buffSources = [...stat.buffSources, ...getPowerEffectSources(sheet, "stat", statId)];

  return {
    base: stat.base,
    gearSources: stat.gearSources,
    buffSources,
    value: stat.base + sumSources(stat.gearSources) + sumSources(buffSources),
    summary: buildSummary(stat.base, stat.gearSources, buffSources),
    detail: buildDetail(stat.gearSources, buffSources),
  };
}

export function getSkillEntry(sheet: CharacterDraft, skillId: string): SkillEntry | undefined {
  return sheet.skills.find((entry) => entry.id === skillId);
}

export function getSkillBreakdown(sheet: CharacterDraft, skillId: string): CharacterBreakdown {
  const skill = getSkillEntry(sheet, skillId);
  const gearSources = skill?.gearSources ?? [];
  const buffSources = [
    ...(skill?.buffSources ?? []),
    ...getPowerEffectSources(sheet, "skill", skillId),
    ...(skillId === "alertness" ? getAwarenessAlertnessPassiveSource(sheet) : []),
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

export function getCurrentStatValue(sheet: CharacterDraft, statId: StatId): number {
  return getStatBreakdown(sheet, statId).value;
}

export function getCurrentSkillValue(sheet: CharacterDraft, skillId: string): number {
  return getSkillBreakdown(sheet, skillId).value;
}

export function getDerivedModifierTotal(sheet: CharacterDraft, targetId: string): number {
  return sumSources(getPowerEffectSources(sheet, "derived", targetId));
}

export function getPassiveManaBonus(sheet: CharacterDraft): number {
  return sheet.powers.reduce((total, power) => {
    const applicableBonus = getRuntimePowerCantripLevels(power.id)
      .filter((level) => level.power_level <= power.level)
      .reduce((bonus, level) => {
        const manaBonus = level.mechanics?.mana_bonus;
        return typeof manaBonus === "number" ? manaBonus : bonus;
      }, 0);

    return total + applicableBonus;
  }, 0);
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

export function buildCharacterDerivedValues(sheet: CharacterDraft): CharacterDerivedValues {
  const currentStats = {
    STR: getCurrentStatValue(sheet, "STR"),
    DEX: getCurrentStatValue(sheet, "DEX"),
    STAM: getCurrentStatValue(sheet, "STAM"),
    CHA: getCurrentStatValue(sheet, "CHA"),
    APP: getCurrentStatValue(sheet, "APP"),
    MAN: getCurrentStatValue(sheet, "MAN"),
    INT: getCurrentStatValue(sheet, "INT"),
    WITS: getCurrentStatValue(sheet, "WITS"),
    PER: getCurrentStatValue(sheet, "PER"),
  };
  const occultManaBonus = calculateOccultManaBonus(getCurrentSkillValue(sheet, "occultism"), sheet.xpUsed);
  const passiveManaBonus = getPassiveManaBonus(sheet);
  const maxMana =
    calculateT1BaseMana(sheet, currentStats) +
    occultManaBonus +
    passiveManaBonus +
    getDerivedModifierTotal(sheet, "max_mana");
  const currentMana = getCurrentManaValue(sheet, maxMana);
  const attackDiceBonus = getDerivedModifierTotal(sheet, "attack_dice_bonus");
  const meleeAttack =
    getCurrentSkillValue(sheet, "melee") +
    currentStats.DEX +
    attackDiceBonus +
    getDerivedModifierTotal(sheet, "melee_attack");
  const rangedAttack =
    getCurrentSkillValue(sheet, "ranged") +
    currentStats.DEX +
    calculateRangedBonusDice(currentStats.PER) +
    attackDiceBonus +
    getDerivedModifierTotal(sheet, "ranged_attack");
  const temporaryInspiration = sheet.temporaryInspiration;

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
      getCurrentSkillValue(sheet, "athletics"),
      getDerivedModifierTotal(sheet, "armor_class")
    ),
    damageReduction: getDerivedModifierTotal(sheet, "damage_reduction"),
    soak: currentStats.STAM + getDerivedModifierTotal(sheet, "soak"),
    meleeAttack,
    rangedAttack,
    meleeDamage: currentStats.STR + getDerivedModifierTotal(sheet, "melee_damage"),
    rangedDamage: "-",
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
