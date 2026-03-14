import type { ActivePowerEffect } from "../types/activePowerEffects";
import type {
  CharacterDraft,
  SkillEntry,
  StatEntry,
  StatSource,
} from "./characterTemplate.ts";
import type { StatId } from "../types/character.ts";
import type { DamageTypeId, ResistanceLevel } from "../rules/resistances.ts";
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

function getUnlockedCantripMechanics(
  sheet: CharacterDraft,
  powerId: string
): Record<string, unknown> | null {
  const power = sheet.powers.find((entry) => entry.id === powerId);
  if (!power || power.level <= 0) {
    return null;
  }

  const unlockedLevel =
    getRuntimePowerCantripLevels(powerId)
      .filter((level) => level.power_level <= power.level)
      .at(-1) ?? null;

  return unlockedLevel?.mechanics ?? null;
}

function getPassiveSkillBonusSources(sheet: CharacterDraft, skillId: string): StatSource[] {
  const sources: StatSource[] = [];
  const crowdControlMechanics = getUnlockedCantripMechanics(sheet, "crowd_control");
  const necromancyMechanics = getUnlockedCantripMechanics(sheet, "necromancy");

  if (crowdControlMechanics) {
    const crowdControlBonusBySkillId: Record<string, string> = {
      social: "social_skill_bonus",
      intimidation: "intimidation_skill_bonus",
      mechanics: "mechanics_skill_bonus",
      technology: "technology_skill_bonus",
    };
    const mechanicKey = crowdControlBonusBySkillId[skillId];
    const bonus = mechanicKey ? crowdControlMechanics[mechanicKey] : 0;

    if (typeof bonus === "number" && Number.isFinite(bonus) && bonus > 0) {
      sources.push({
        label: "Crowd Control",
        value: Math.trunc(bonus),
      });
    }
  }

  if (skillId === "melee" && necromancyMechanics) {
    const bonus = necromancyMechanics.melee_skill_bonus;
    if (typeof bonus === "number" && Number.isFinite(bonus) && bonus > 0) {
      sources.push({
        label: "Necromancy",
        value: Math.trunc(bonus),
      });
    }
  }

  return sources;
}

function getPassiveUtilityTraits(sheet: CharacterDraft): string[] {
  const traits = new Set<string>();
  const awareness = sheet.powers.find((power) => power.id === "awareness") ?? null;
  const lightSupport = sheet.powers.find((power) => power.id === "light_support") ?? null;
  const necromancy = sheet.powers.find((power) => power.id === "necromancy") ?? null;
  const shadowControl = sheet.powers.find((power) => power.id === "shadow_control") ?? null;
  const lightSupportMechanics = getUnlockedCantripMechanics(sheet, "light_support");
  const necromancyMechanics = getUnlockedCantripMechanics(sheet, "necromancy");

  if ((awareness?.level ?? 0) >= 3) {
    traits.add("Techno-Invisibility Immunity");
  }

  if (lightSupport && lightSupportMechanics?.nightvision === true) {
    traits.add("Nightvision");
  }

  if (necromancy && typeof necromancyMechanics?.hostile_undead_aggro_priority === "string") {
    traits.add(
      necromancyMechanics.hostile_undead_aggro_priority === "ignore_unless_attacked"
        ? "Hostile Undead Ignore Unless Attacked"
        : "Hostile Undead Aggro Last"
    );
  }

  if ((shadowControl?.level ?? 0) >= 2) {
    traits.add(`Shadow Walk ${25 * shadowControl!.level}m`);
  }

  if ((shadowControl?.level ?? 0) >= 3) {
    traits.add("Cosmetic Clothing / Armor Shift");
  }

  if ((shadowControl?.level ?? 0) >= 5) {
    traits.add("Minor Body Cosmetics");
  }

  return [...traits];
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
    ...getPassiveSkillBonusSources(sheet, skillId),
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

export function getResistanceModifierTotal(
  sheet: CharacterDraft,
  damageTypeId: DamageTypeId
): number {
  return sumSources(getPowerEffectSources(sheet, "resistance", damageTypeId));
}

export function getResolvedResistanceLevel(
  sheet: CharacterDraft,
  damageTypeId: DamageTypeId
): ResistanceLevel {
  const baseLevel = sheet.resistances[damageTypeId] ?? 0;
  const nextLevel = Math.trunc(baseLevel + getResistanceModifierTotal(sheet, damageTypeId));

  if (nextLevel < -2) {
    return -2;
  }

  if (nextLevel > 2) {
    return 2;
  }

  return nextLevel as ResistanceLevel;
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
  const utilityTraits = getPassiveUtilityTraits(sheet);

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
