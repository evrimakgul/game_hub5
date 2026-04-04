import type {
  ActivePowerEffect,
  ActivePowerEffectKind,
  ActivePowerEffectModifier,
  ActivePowerShareMode,
} from "../types/activePowerEffects";
import { createTimestampedId, getIsoTimestamp } from "../lib/ids.ts";
import { isStatId, type StatId } from "../types/character.ts";
import {
  LIGHT_SUPPORT_LEVEL_FIVE_EXPOSE_DARKNESS_TYPES,
  type DamageTypeId,
} from "./resistances.ts";
import type { CharacterDraft, PowerEntry } from "../config/characterTemplate.ts";
import { buildCharacterDerivedValues, getCurrentStatValue } from "../config/characterRuntime.ts";
import {
  getRuntimePowerCantripLevels,
  getRuntimePowerLevelDefinition,
} from "./powerData.ts";
import {
  getSummonOptionList,
  type RuntimeSummonOption,
} from "./summons.ts";
import type { SharedItemRecord } from "../types/items.ts";
export type {
  CastPowerDamageTypeOption,
  CastPowerMode,
  CastPowerTargetMode,
  CastPowerVariantId,
  CastPowerVariantOption,
  DamageMitigationChannel,
  DirectDamageCastApplication,
  HealingCastApplication,
} from "../powers/spellTypes";
import type {
  CastPowerDamageTypeOption,
  CastPowerMode,
  CastPowerTargetMode,
  CastPowerVariantId,
  CastPowerVariantOption,
  DamageMitigationChannel,
  DirectDamageCastApplication,
  HealingCastApplication,
} from "../powers/spellTypes";

const LIGHT_SUPPORT_STACK_KEYS = new Set([
  "light_support",
  "light_support:aura",
  "light_support:expose_darkness",
]);
const SHADOW_CLOAK_STACK_KEYS = new Set([
  "shadow_control:cloak",
  "shadow_control:cloak:self",
  "shadow_control:cloak:aura",
]);

function isLegacyAuraSelfEffect(effect: ActivePowerEffect): boolean {
  return (
    effect.effectKind === "direct" &&
    effect.targetCharacterId === effect.casterCharacterId &&
    (effect.powerId === "light_support" || effect.powerId === "shadow_control")
  );
}

function isLegacyAuraSharedEffect(effect: ActivePowerEffect): boolean {
  return (
    effect.effectKind === "direct" &&
    effect.targetCharacterId !== effect.casterCharacterId &&
    (effect.powerId === "light_support" || effect.powerId === "shadow_control")
  );
}

function getNormalizedAuraStackKey(effect: ActivePowerEffect): string {
  if (effect.powerId === "light_support" && LIGHT_SUPPORT_STACK_KEYS.has(effect.stackKey)) {
    return "light_support";
  }

  if (effect.powerId === "shadow_control" && SHADOW_CLOAK_STACK_KEYS.has(effect.stackKey)) {
    return "shadow_control:cloak";
  }

  return effect.stackKey;
}

function inferShadowControlShareMode(effect: ActivePowerEffect): ActivePowerShareMode {
  const runtimeLevel = getRuntimePowerLevelDefinition("shadow_control", effect.sourceLevel);
  const mechanics = runtimeLevel?.mechanics ?? {};
  const manaCostVariants =
    mechanics.mana_cost_variants && typeof mechanics.mana_cost_variants === "object"
      ? (mechanics.mana_cost_variants as Record<string, unknown>)
      : {};
  const selfOnlyManaCost =
    typeof manaCostVariants.self_only === "number" ? manaCostVariants.self_only : null;
  const sharedManaCost =
    typeof manaCostVariants.shared_with_allies === "number"
      ? manaCostVariants.shared_with_allies
      : null;
  const hasSharedTargets = (effect.sharedTargetCharacterIds ?? []).some(
    (targetId) => targetId !== effect.casterCharacterId
  );

  if (hasSharedTargets) {
    return "aura";
  }

  if (
    effect.manaCost !== null &&
    sharedManaCost !== null &&
    selfOnlyManaCost !== sharedManaCost &&
    effect.manaCost === sharedManaCost
  ) {
    return "aura";
  }

  return "self";
}

export function isAuraSourceEffect(effect: ActivePowerEffect): boolean {
  return effect.effectKind === "aura_source" || isLegacyAuraSelfEffect(effect);
}

export function isAuraSharedEffect(effect: ActivePowerEffect): boolean {
  return effect.effectKind === "aura_shared" || isLegacyAuraSharedEffect(effect);
}

export function getAuraShareMode(effect: ActivePowerEffect): ActivePowerShareMode {
  if (
    effect.powerId !== "shadow_control" &&
    (effect.shareMode === "self" || effect.shareMode === "aura")
  ) {
    return effect.shareMode;
  }

  if (effect.powerId === "light_support" && isAuraSourceEffect(effect)) {
    return "aura";
  }

  if (effect.powerId === "shadow_control" && isAuraSourceEffect(effect)) {
    return inferShadowControlShareMode(effect);
  }

  return null;
}

export type CastPowerBuildRequest = {
  casterCharacterId: string;
  casterName: string;
  targetCharacterId: string;
  targetName: string;
  power: PowerEntry;
  variantId?: CastPowerVariantId;
  selectedStatId?: StatId | null;
  castMode?: CastPowerMode | null;
};

type CastPowerBuildSuccess = {
  effect: ActivePowerEffect;
  manaCost: number;
};

function resolveAuraCastMode(request: CastPowerBuildRequest): CastPowerMode {
  if (request.castMode === "aura") {
    return "aura";
  }

  if (request.targetCharacterId !== request.casterCharacterId) {
    return "aura";
  }

  return "self";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getLightSupportExposeDarknessMechanics(sourceLevel: number): Record<string, unknown> | null {
  const runtimeLevel = getRuntimePowerLevelDefinition("light_support", sourceLevel);
  return runtimeLevel?.mechanics?.expose_darkness &&
    typeof runtimeLevel.mechanics.expose_darkness === "object"
    ? (runtimeLevel.mechanics.expose_darkness as Record<string, unknown>)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinSummary(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(", ");
}

function getUnlockedCantripLevel(powerId: string, powerLevel: number) {
  return (
    getRuntimePowerCantripLevels(powerId)
      .filter((level) => level.power_level <= powerLevel)
      .at(-1) ?? null
  );
}

function getElementalistDamageTypeOptions(
  power: PowerEntry,
  variantId: CastPowerVariantId
): DamageTypeId[] {
  if (power.id !== "elementalist") {
    return [];
  }

  if (variantId === "elemental_cantrip") {
    const cantrip = getUnlockedCantripLevel(power.id, power.level);
    const cantripDamage =
      cantrip?.mechanics?.damage && typeof cantrip.mechanics.damage === "object"
        ? (cantrip.mechanics.damage as Record<string, unknown>)
        : null;
    const disallowedTypes = Array.isArray(cantripDamage?.disallowed_damage_types)
      ? cantripDamage.disallowed_damage_types.filter(
          (damageType): damageType is DamageTypeId => typeof damageType === "string"
        )
      : [];

    return (["fire", "cold", "lightning", "acid", "necrotic"] as DamageTypeId[]).filter(
      (damageType) => !disallowedTypes.includes(damageType)
    );
  }

  return power.level >= 5
    ? ["fire", "cold", "lightning", "acid", "necrotic"]
    : ["fire", "cold", "lightning", "acid"];
}

function getDamageTypeLabel(damageType: DamageTypeId): string {
  return damageType.charAt(0).toUpperCase() + damageType.slice(1);
}

function getSplitAmount(total: number, divisor: number, round: unknown): number {
  if (divisor <= 1) {
    return total;
  }

  const rawValue = total / divisor;
  if (round === "down") {
    return Math.floor(rawValue);
  }

  return Math.ceil(rawValue);
}

function createEffect(
  request: CastPowerBuildRequest,
  manaCost: number,
  actionType: string | null,
  stackKey: string,
  effectKind: ActivePowerEffectKind,
  label: string,
  summary: string,
  selectedStatId: StatId | null,
  modifiers: ActivePowerEffectModifier[],
  options?: {
    sourceEffectId?: string | null;
    shareMode?: ActivePowerShareMode;
    sharedTargetCharacterIds?: string[] | null;
  }
): ActivePowerEffect {
  return {
    id: createTimestampedId("power-effect"),
    stackKey,
    effectKind,
    powerId: request.power.id,
    powerName: request.power.name,
    sourceLevel: request.power.level,
    casterCharacterId: request.casterCharacterId,
    casterName: request.casterName,
    targetCharacterId: request.targetCharacterId,
    sourceEffectId: options?.sourceEffectId ?? null,
    shareMode: options?.shareMode ?? null,
    sharedTargetCharacterIds: options?.sharedTargetCharacterIds ?? null,
    label,
    summary,
    actionType,
    manaCost,
    selectedStatId: selectedStatId ?? null,
    modifiers,
    appliedAt: getIsoTimestamp(),
  };
}

export function getSupportedCastablePowerIds(): string[] {
  return [
    "awareness",
    "body_reinforcement",
    "crowd_control",
    "elementalist",
    "healing",
    "light_support",
    "necromancy",
    "shadow_control",
  ];
}

export function isSupportedCastablePower(powerId: string): boolean {
  return getSupportedCastablePowerIds().includes(powerId);
}

export function getSupportedCastablePowers(sheet: CharacterDraft): PowerEntry[] {
  return sheet.powers.filter(
    (power) => isSupportedCastablePower(power.id) && power.level > 0
  );
}

export function getCastPowerTargetMode(power: PowerEntry): CastPowerTargetMode {
  return getCastPowerTargetModeForVariant(power, "default");
}

export function getCastPowerTargetModeForVariant(
  power: PowerEntry,
  variantId: CastPowerVariantId
): CastPowerTargetMode {
  if (power.id === "awareness") {
    return "single";
  }

  if (power.id === "body_reinforcement") {
    return power.level === 1 ? "self" : "single";
  }

  if (power.id === "crowd_control") {
    return getCastPowerTargetLimit(power, variantId) > 1 ? "multiple" : "single";
  }

  if (power.id === "elementalist") {
    return getCastPowerTargetLimit(power, variantId) > 1 ? "multiple" : "single";
  }

  if (power.id === "healing") {
    if (variantId === "cure" || variantId === "wound_mend") {
      return "single";
    }

    return getCastPowerTargetLimit(power, variantId) > 1 ? "multiple" : "single";
  }

  if (power.id === "light_support") {
    return variantId === "mana_restore" ? "single" : "self";
  }

  if (power.id === "necromancy") {
    if (variantId === "summon_undead" || variantId === "dismiss_summon") {
      return "self";
    }

    return "single";
  }

  if (power.id === "shadow_control") {
    if (variantId === "shadow_soldier" || variantId === "dismiss_summon") {
      return "self";
    }

    if (variantId === "shadow_manipulation") {
      return "single";
    }

    return variantId === "shadow_walk" ? "single" : "self";
  }

  return "single";
}

export function getCastPowerTargetLimit(
  power: PowerEntry,
  variantId: CastPowerVariantId = "default"
): number {
  if (power.id === "crowd_control") {
    const runtimeLevel = getRuntimePowerLevelDefinition(power.id, power.level);
    return Math.max(1, asNumber(runtimeLevel?.mechanics?.max_controlled_targets) || 1);
  }

  if (power.id === "elementalist") {
    if (variantId === "elemental_cantrip") {
      const cantrip = getUnlockedCantripLevel(power.id, power.level);
      const damage =
        cantrip?.mechanics?.damage && typeof cantrip.mechanics.damage === "object"
          ? (cantrip.mechanics.damage as Record<string, unknown>)
          : null;

      return Math.max(1, asNumber(damage?.max_targets) || 1);
    }

    const runtimeLevel = getRuntimePowerLevelDefinition(power.id, power.level);
    const damage =
      runtimeLevel?.mechanics?.damage && typeof runtimeLevel.mechanics.damage === "object"
        ? (runtimeLevel.mechanics.damage as Record<string, unknown>)
        : null;

    return Math.max(1, asNumber(damage?.max_targets) || 1);
  }

  if (power.id === "healing") {
    if (variantId === "cure" || variantId === "wound_mend") {
      return 1;
    }

    const runtimeLevel = getRuntimePowerLevelDefinition(power.id, power.level);
    const healing =
      runtimeLevel?.mechanics?.healing && typeof runtimeLevel.mechanics.healing === "object"
        ? (runtimeLevel.mechanics.healing as Record<string, unknown>)
        : null;
    const maxTargets = healing ? asNumber(healing.max_targets) : 0;
    return Math.max(1, maxTargets || 1);
  }

  return 1;
}

export function getCastPowerAllowedStats(power: PowerEntry): StatId[] {
  if (power.id !== "body_reinforcement") {
    return [];
  }

  const runtimeLevel = getRuntimePowerLevelDefinition(power.id, power.level);
  const allowedStats = runtimeLevel?.mechanics?.allowed_stats;
  if (!Array.isArray(allowedStats)) {
    return [];
  }

  return allowedStats.filter(isStatId);
}

export function getCastPowerModeOptions(power: PowerEntry): CastPowerMode[] {
  return getCastPowerModeOptionsForVariant(power, "default");
}

export function getCastPowerModeOptionsForVariant(
  power: PowerEntry,
  variantId: CastPowerVariantId
): CastPowerMode[] {
  if (power.id === "shadow_control" && power.level >= 4) {
    if (variantId !== "default" && variantId !== "shadow_cloak") {
      return ["self"];
    }

    return ["self", "aura"];
  }

  return ["self"];
}

export function getCastPowerVariantOptions(power: PowerEntry): CastPowerVariantOption[] {
  if (power.id === "awareness") {
    return [{ id: "assess_character", label: "Assess Character" }];
  }

  if (power.id === "crowd_control") {
    return [
      { id: "crowd_control", label: "Control Target" },
      { id: "release_control", label: "Release Target" },
    ];
  }

  if (power.id === "elementalist") {
    return power.level >= 2
      ? [
          { id: "elemental_bolt", label: "Elemental Bolt" },
          { id: "elemental_cantrip", label: "Elemental Cantrip" },
        ]
      : [{ id: "elemental_bolt", label: "Elemental Bolt" }];
  }

  if (power.id === "healing") {
    return power.level >= 3
      ? [
          { id: "default", label: "Heal" },
          { id: "cure", label: "Cure" },
          { id: "wound_mend", label: "Wound Mend" },
        ]
      : [{ id: "default", label: "Heal" }];
  }

  if (power.id === "light_support") {
    const variants: CastPowerVariantOption[] = [{ id: "default", label: "Light Aura" }];

    if (power.level >= 4) {
      variants.push({ id: "mana_restore", label: "Mana Restore" });
    }

    return variants;
  }

  if (power.id === "necromancy") {
    const variants: CastPowerVariantOption[] = [
      { id: "summon_undead", label: "Summon Undead" },
      { id: "dismiss_summon", label: "Remove Summon" },
    ];

    if (power.level >= 3) {
      variants.push({ id: "necrotic_touch", label: "Necrotic Touch" });
    }

    if (power.level >= 5) {
      variants.push({ id: "resurrection", label: "Resurrection" });
    }

    return variants;
  }

  if (power.id === "shadow_control") {
    const variants: CastPowerVariantOption[] = [{ id: "shadow_cloak", label: "Cloak of Shadow" }];

    if (power.level >= 2) {
      variants.push({ id: "shadow_walk", label: "Shadow Walk" });
    }

    if (power.level >= 3) {
      variants.push({ id: "shadow_manipulation", label: "Shadow Manipulation" });
    }

    if (power.level >= 5) {
      variants.push({ id: "shadow_soldier", label: "Shadow Soldier" });
      variants.push({ id: "dismiss_summon", label: "Remove Summon" });
    }

    return variants;
  }

  return [{ id: "default", label: power.name }];
}

export function getCastPowerDamageTypeOptions(
  power: PowerEntry,
  variantId: CastPowerVariantId
): CastPowerDamageTypeOption[] {
  return getElementalistDamageTypeOptions(power, variantId).map((damageType) => ({
    id: damageType,
    label: getDamageTypeLabel(damageType),
  }));
}

export function getCastPowerSummonOptions(
  power: PowerEntry,
  variantId: CastPowerVariantId
): RuntimeSummonOption[] {
  if (
    (power.id === "necromancy" && variantId === "summon_undead") ||
    (power.id === "shadow_control" && variantId === "shadow_soldier")
  ) {
    return getSummonOptionList(power);
  }

  return [];
}

export function getCastPowerMaxBonusManaSpend(
  sheet: CharacterDraft,
  power: PowerEntry,
  variantId: CastPowerVariantId,
  targetCount: number,
  itemsById: Record<string, SharedItemRecord> = {}
): number {
  if (power.id !== "elementalist" || variantId !== "elemental_bolt" || targetCount <= 1) {
    return 0;
  }

  const runtimeLevel = getRuntimePowerLevelDefinition(power.id, power.level);
  const damage =
    runtimeLevel?.mechanics?.damage && typeof runtimeLevel.mechanics.damage === "object"
      ? (runtimeLevel.mechanics.damage as Record<string, unknown>)
      : null;
  if (!damage) {
    return 0;
  }

  const baseStat = isStatId(damage.base_stat) ? damage.base_stat : "INT";
  const totalDamage = Math.max(
    0,
    getCurrentStatValue(sheet, baseStat, itemsById) + asNumber(damage.flat_bonus)
  );
  const splitAmount = getSplitAmount(
    totalDamage,
    Math.max(1, asNumber(damage.split_divisor) || 1),
    damage.split_round
  );
  const splitBonusPerMana =
    Math.max(0, asNumber(damage.split_bonus_per_mana)) || (power.level >= 3 ? 2 : 0);

  if (splitBonusPerMana <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor((totalDamage - splitAmount) / splitBonusPerMana));
}

export function getHealingPowerTotal(
  sheet: CharacterDraft,
  power: PowerEntry,
  variantId: CastPowerVariantId = "default",
  itemsById: Record<string, SharedItemRecord> = {}
): number | null {
  if (power.id !== "healing") {
    return null;
  }

  if (variantId === "wound_mend") {
    const cantrip = getUnlockedCantripLevel(power.id, power.level);
    const healing =
      cantrip?.mechanics?.healing && typeof cantrip.mechanics.healing === "object"
        ? (cantrip.mechanics.healing as Record<string, unknown>)
        : null;

    return healing ? Math.max(0, asNumber(healing.flat_amount)) : null;
  }

  if (variantId === "cure") {
    return 0;
  }

  const runtimeLevel = getRuntimePowerLevelDefinition(power.id, power.level);
  if (!runtimeLevel) {
    return null;
  }

  const healing =
    runtimeLevel.mechanics?.healing && typeof runtimeLevel.mechanics.healing === "object"
      ? (runtimeLevel.mechanics.healing as Record<string, unknown>)
      : null;
  if (!healing) {
    return null;
  }

  const baseStat = isStatId(healing.base_stat) ? healing.base_stat : "INT";
  return Math.max(0, getCurrentStatValue(sheet, baseStat, itemsById) + asNumber(healing.flat_bonus));
}

function splitEvenly(totalAmount: number, targetCount: number): number[] {
  if (targetCount <= 0) {
    return [];
  }

  const normalizedTotal = Math.max(0, Math.trunc(totalAmount));
  const baseAmount = Math.floor(normalizedTotal / targetCount);
  const remainder = normalizedTotal % targetCount;

  return Array.from({ length: targetCount }, (_, index) =>
    baseAmount + (index < remainder ? 1 : 0)
  );
}

export function buildHealingCastResolution(request: {
  casterSheet: CharacterDraft;
  power: PowerEntry;
  variantId: CastPowerVariantId;
  targetCharacterIds: string[];
  allocations?: Record<string, number>;
  itemsById?: Record<string, SharedItemRecord>;
}):
  | { error: string }
  | {
      manaCost: number;
      applications: HealingCastApplication[];
      totalAmount: number;
      removedStatuses: string[];
      canRegrowLimbs: boolean;
      overhealCapStat: StatId | null;
      perTargetDailyLimit: number | null;
    } {
  if (request.power.id !== "healing") {
    return { error: `${request.power.name} is not a healing power.` };
  }

  if (request.variantId === "wound_mend") {
    const cantrip = getUnlockedCantripLevel(request.power.id, request.power.level);
    const mechanics = cantrip?.mechanics ?? {};
    const healing =
      mechanics.healing && typeof mechanics.healing === "object"
        ? (mechanics.healing as Record<string, unknown>)
        : null;
    const totalAmount = healing ? Math.max(0, asNumber(healing.flat_amount)) : null;
    const uniqueTargetIds = Array.from(new Set(request.targetCharacterIds));

    if (totalAmount === null || !cantrip) {
      return { error: `Healing cantrip data for ${request.power.name} is missing.` };
    }

    if (uniqueTargetIds.length !== 1) {
      return { error: "Wound Mend requires exactly one target." };
    }

    return {
      manaCost: 0,
      totalAmount,
      removedStatuses: mechanics.stops_bleeding === true ? ["bleeding"] : [],
      canRegrowLimbs: false,
      overhealCapStat: null,
      perTargetDailyLimit:
        typeof mechanics.max_uses_per_target_per_day === "number"
          ? Math.max(0, Math.trunc(mechanics.max_uses_per_target_per_day))
          : null,
      applications: [
        {
          targetCharacterId: uniqueTargetIds[0],
          amount: totalAmount,
          temporaryHpCap: null,
        },
      ],
    };
  }

  const runtimeLevel = getRuntimePowerLevelDefinition(request.power.id, request.power.level);
  if (!runtimeLevel) {
    return { error: `Power data for ${request.power.name} Lv ${request.power.level} is missing.` };
  }

  const mechanics = runtimeLevel.mechanics ?? {};
  const totalAmount = getHealingPowerTotal(
    request.casterSheet,
    request.power,
    request.variantId,
    request.itemsById ?? {}
  );
  if (totalAmount === null) {
    return { error: `Healing data for ${request.power.name} Lv ${request.power.level} is missing.` };
  }

  const manaCost = request.variantId === "cure" ? 3 : 2;
  const uniqueTargetIds = Array.from(new Set(request.targetCharacterIds));
  const targetLimit = getCastPowerTargetLimit(request.power, request.variantId);
  const removedStatuses = Array.isArray(mechanics.removes_statuses)
    ? mechanics.removes_statuses.filter((status): status is string => typeof status === "string")
    : [];
  const cureStatuses = removedStatuses.filter((status) => status !== "bleeding");
  const healStatuses = removedStatuses.includes("bleeding") ? ["bleeding"] : [];
  const overheal =
    mechanics.overheal && typeof mechanics.overheal === "object"
      ? (mechanics.overheal as Record<string, unknown>)
      : null;
  const overhealCapStat =
    overheal && overheal.enabled === true && isStatId(overheal.cap_stat)
      ? overheal.cap_stat
      : null;

  if (uniqueTargetIds.length === 0) {
    return { error: "Select at least one valid healing target." };
  }

  if (uniqueTargetIds.length > targetLimit) {
    return { error: `Healing can affect at most ${targetLimit} target(s) at this level.` };
  }

  if (request.variantId === "cure") {
    if (request.power.level < 3) {
      return { error: "Cure is not unlocked for this Healing level." };
    }

    return {
      manaCost,
      totalAmount: 0,
      applications: [
        {
          targetCharacterId: uniqueTargetIds[0],
          amount: 0,
          temporaryHpCap: null,
        },
      ],
      removedStatuses: cureStatuses,
      canRegrowLimbs: false,
      overhealCapStat: null,
      perTargetDailyLimit: null,
    };
  }

  if (targetLimit === 1) {
    return {
      manaCost,
      totalAmount,
      applications: [
        {
          targetCharacterId: uniqueTargetIds[0],
          amount: totalAmount,
          temporaryHpCap: null,
        },
      ],
      removedStatuses: healStatuses,
      canRegrowLimbs: mechanics.can_regrow_limbs === true,
      overhealCapStat,
      perTargetDailyLimit: null,
    };
  }

  const fallbackDistribution = splitEvenly(totalAmount, uniqueTargetIds.length);
  const normalizedAllocations = uniqueTargetIds.map((targetId, index) => {
    const rawValue = request.allocations?.[targetId];
    const amount = Number.isFinite(rawValue)
      ? Math.max(0, Math.trunc(rawValue ?? 0))
      : fallbackDistribution[index];
    return {
      targetCharacterId: targetId,
      amount,
      temporaryHpCap: null,
    };
  });
  const allocatedTotal = normalizedAllocations.reduce((sum, entry) => sum + entry.amount, 0);

  if (allocatedTotal > totalAmount) {
    return {
      error: `Healing allocation exceeds the available heal pool (${allocatedTotal} / ${totalAmount}).`,
    };
  }

  const positiveAllocations = normalizedAllocations.filter((entry) => entry.amount > 0);
  if (positiveAllocations.length === 0) {
    return { error: "Allocate at least 1 healing to one selected target." };
  }

  return {
    manaCost,
    totalAmount,
    applications: positiveAllocations,
    removedStatuses: healStatuses,
    canRegrowLimbs: mechanics.can_regrow_limbs === true,
    overhealCapStat,
    perTargetDailyLimit: null,
  };
}

export function buildDirectDamageCastResolution(request: {
  casterSheet: CharacterDraft;
  power: PowerEntry;
  variantId: CastPowerVariantId;
  targetCharacterIds: string[];
  selectedDamageType?: DamageTypeId | null;
  bonusManaSpend?: number;
  targetMetadata?: Array<{
    characterId: string;
    isLiving: boolean;
    isUndead: boolean;
    blocksNecroticTouch?: boolean;
  }>;
  itemsById?: Record<string, SharedItemRecord>;
}):
  | { error: string }
  | {
      manaCost: number;
      applications: DirectDamageCastApplication[];
      healingApplications?: Array<{
        targetCharacterId: string;
        amount: number;
      }>;
    } {
  if (
    request.power.id === "elementalist" &&
    (request.variantId === "elemental_bolt" || request.variantId === "elemental_cantrip")
  ) {
    const runtimeEntry =
      request.variantId === "elemental_cantrip"
        ? getUnlockedCantripLevel(request.power.id, request.power.level)
        : getRuntimePowerLevelDefinition(request.power.id, request.power.level);
    const mechanics = runtimeEntry?.mechanics ?? {};
    const damage =
      mechanics.damage && typeof mechanics.damage === "object"
        ? (mechanics.damage as Record<string, unknown>)
        : null;
    const allowedDamageTypes = getElementalistDamageTypeOptions(request.power, request.variantId);
    const uniqueTargetIds = Array.from(new Set(request.targetCharacterIds));

    if (!damage || !runtimeEntry) {
      return {
        error: `Power data for ${request.power.name} Lv ${request.power.level} is missing elementalist damage data.`,
      };
    }

    if (uniqueTargetIds.length === 0) {
      return { error: "Select at least one target for Elemental Bolt." };
    }

    if (uniqueTargetIds.length > getCastPowerTargetLimit(request.power, request.variantId)) {
      return {
        error: `Elemental Bolt can affect at most ${getCastPowerTargetLimit(
          request.power,
          request.variantId
        )} target(s) at this level.`,
      };
    }

    if (!request.selectedDamageType || !allowedDamageTypes.includes(request.selectedDamageType)) {
      return { error: "Choose a valid damage type first." };
    }
    const selectedDamageType = request.selectedDamageType;

    const baseStat = isStatId(damage.base_stat) ? damage.base_stat : "INT";
    const totalAmount = Math.max(
      0,
      getCurrentStatValue(request.casterSheet, baseStat, request.itemsById ?? {}) +
        asNumber(damage.flat_bonus)
    );
    const splitAmount = getSplitAmount(
      totalAmount,
      Math.max(1, asNumber(damage.split_divisor) || 1),
      damage.split_round
    );
    const splitBonusPerMana =
      request.variantId === "elemental_bolt"
        ? Math.max(0, asNumber(damage.split_bonus_per_mana)) || (request.power.level >= 3 ? 2 : 0)
        : 0;
    const bonusManaSpend =
      uniqueTargetIds.length > 1 && request.variantId === "elemental_bolt"
        ? Math.max(0, Math.trunc(request.bonusManaSpend ?? 0))
        : 0;
    const perTargetBaseAmount =
      uniqueTargetIds.length > 1 && asNumber(damage.split_divisor) > 1
        ? Math.min(totalAmount, splitAmount + bonusManaSpend * splitBonusPerMana)
        : totalAmount;
    const manaCostVariant =
      Array.isArray(mechanics.mana_cost_variants) && request.variantId === "elemental_bolt"
        ? mechanics.mana_cost_variants.find(
            (entry) =>
              isRecord(entry) && entry.damage_type === request.selectedDamageType
          )
        : null;
    const manaCost =
      request.variantId === "elemental_cantrip"
        ? 0
        : Math.max(
            0,
            Math.trunc(
            (isRecord(manaCostVariant) ? asNumber(manaCostVariant.mana_cost) : 0) ||
                asNumber((runtimeEntry as { mana_cost?: number | null }).mana_cost)
            )
          ) + bonusManaSpend;
    const vulnerabilityMultiplier =
      selectedDamageType === "necrotic"
        ? typeof damage.vulnerability_multiplier === "number"
          ? damage.vulnerability_multiplier
          : 1
        : 1;

    return {
      manaCost,
      applications: uniqueTargetIds.flatMap((targetCharacterId) => {
        const targetMetadata =
          request.targetMetadata?.find((entry) => entry.characterId === targetCharacterId) ?? null;
        const isLiving = targetMetadata?.isLiving ?? true;
        const isUndead = targetMetadata?.isUndead === true;
        const rawAmount =
          selectedDamageType === "necrotic" && isLiving
            ? Math.ceil(perTargetBaseAmount * vulnerabilityMultiplier)
            : perTargetBaseAmount;

        if (selectedDamageType === "necrotic" && isUndead) {
          return [];
        }

        return [
          {
            targetCharacterId,
            rawAmount,
            damageType: selectedDamageType,
            mitigationChannel: selectedDamageType === "physical" ? "dr" : "soak",
            sourceLabel: `${request.power.name} Lv ${request.power.level}`,
            sourceSummary: `${request.variantId === "elemental_cantrip" ? "Elemental Cantrip" : "Elemental Bolt"} (${rawAmount} ${selectedDamageType})`,
          },
        ];
      }),
      healingApplications:
        selectedDamageType === "necrotic"
          ? uniqueTargetIds.flatMap((targetCharacterId) => {
              const isUndead =
                request.targetMetadata?.find((entry) => entry.characterId === targetCharacterId)
                  ?.isUndead === true;
              return isUndead
                ? [
                    {
                      targetCharacterId,
                      amount: perTargetBaseAmount,
                    },
                  ]
                : [];
            })
          : [],
    };
  }

  if (request.power.id === "shadow_control" && request.variantId === "shadow_manipulation") {
    const runtimeLevel = getRuntimePowerLevelDefinition(request.power.id, request.power.level);
    const shadowManipulation =
      runtimeLevel?.mechanics?.shadow_manipulation &&
      typeof runtimeLevel.mechanics.shadow_manipulation === "object"
        ? (runtimeLevel.mechanics.shadow_manipulation as Record<string, unknown>)
        : null;
    const damage =
      shadowManipulation?.damage && typeof shadowManipulation.damage === "object"
        ? (shadowManipulation.damage as Record<string, unknown>)
        : null;

    if (!runtimeLevel || !shadowManipulation || !damage) {
      return {
        error: `Power data for ${request.power.name} Lv ${request.power.level} is missing shadow manipulation damage data.`,
      };
    }

    const uniqueTargetIds = Array.from(new Set(request.targetCharacterIds));
    if (uniqueTargetIds.length !== 1) {
      return { error: "Shadow Manipulation requires exactly one target." };
    }

    const baseStat = isStatId(damage.base_stat) ? damage.base_stat : "MAN";
    const rawAmount =
      getCurrentStatValue(request.casterSheet, baseStat, request.itemsById ?? {}) +
      request.power.level * asNumber(damage.power_level_multiplier);
    const damageType = typeof damage.damage_type === "string" ? (damage.damage_type as DamageTypeId) : "shadow";
    const mitigationChannel: DamageMitigationChannel = damageType === "physical" ? "dr" : "soak";

    return {
      manaCost: asNumber(runtimeLevel.mana_cost),
      applications: [
        {
          targetCharacterId: uniqueTargetIds[0],
          rawAmount,
          damageType,
          mitigationChannel,
          sourceLabel: `${request.power.name} Lv ${request.power.level}`,
          sourceSummary: `Shadow Manipulation (${rawAmount} ${damageType})`,
        },
      ],
    };
  }

  if (request.power.id === "necromancy" && request.variantId === "necrotic_touch") {
    const runtimeLevel = getRuntimePowerLevelDefinition(request.power.id, request.power.level);
    const necroticTouch =
      runtimeLevel?.mechanics?.necrotic_touch &&
      typeof runtimeLevel.mechanics.necrotic_touch === "object"
        ? (runtimeLevel.mechanics.necrotic_touch as Record<string, unknown>)
        : null;
    const damage =
      necroticTouch?.damage && typeof necroticTouch.damage === "object"
        ? (necroticTouch.damage as Record<string, unknown>)
        : null;

    if (!runtimeLevel || !necroticTouch || !damage) {
      return {
        error: `Power data for ${request.power.name} Lv ${request.power.level} is missing necrotic touch data.`,
      };
    }

    const uniqueTargetIds = Array.from(new Set(request.targetCharacterIds));
    if (uniqueTargetIds.length !== 1) {
      return { error: "Necrotic Touch requires exactly one target." };
    }

    const baseStat = isStatId(damage.base_stat) ? damage.base_stat : "APP";
    const baseAmount =
      getCurrentStatValue(request.casterSheet, baseStat, request.itemsById ?? {}) +
      request.power.level * asNumber(damage.power_level_multiplier);
    const isLiving =
      request.targetMetadata?.find((entry) => entry.characterId === uniqueTargetIds[0])?.isLiving ??
      true;
    const isUndead =
      request.targetMetadata?.find((entry) => entry.characterId === uniqueTargetIds[0])?.isUndead ===
      true;
    const blocksNecroticTouch =
      request.targetMetadata?.find((entry) => entry.characterId === uniqueTargetIds[0])
        ?.blocksNecroticTouch === true;

    if (blocksNecroticTouch) {
      return {
        error: "Necrotic Touch does not work on shadow or incorporeal targets.",
      };
    }

    const livingMultiplier =
      isLiving && typeof necroticTouch.living_damage_multiplier === "number"
        ? necroticTouch.living_damage_multiplier
        : 1;
    const rawAmount = Math.max(0, Math.ceil(baseAmount * livingMultiplier));
    const manaCost =
      typeof necroticTouch.mana_cost === "number"
        ? necroticTouch.mana_cost
        : asNumber(runtimeLevel.mana_cost);

    return {
      manaCost,
      applications: isUndead
        ? []
        : [
            {
              targetCharacterId: uniqueTargetIds[0],
              rawAmount,
              damageType: "necrotic",
              mitigationChannel: "soak",
              sourceLabel: `${request.power.name} Lv ${request.power.level}`,
              sourceSummary: `Necrotic Touch (${rawAmount} necrotic)`,
            },
          ],
      healingApplications: isUndead
        ? [
            {
              targetCharacterId: uniqueTargetIds[0],
              amount: baseAmount,
            },
          ]
        : [],
    };
  }

  return {
    error: `${request.power.name} does not have a supported direct-damage variant in this slice yet.`,
  };
}

export function buildActivePowerEffect(
  request: CastPowerBuildRequest
): { error: string } | CastPowerBuildSuccess {
  const runtimeLevel = getRuntimePowerLevelDefinition(request.power.id, request.power.level);
  if (!runtimeLevel) {
    return { error: `Power data for ${request.power.name} Lv ${request.power.level} is missing.` };
  }

  const mechanics = runtimeLevel.mechanics ?? {};
  const manaCost = asNumber(runtimeLevel.mana_cost);
  const actionType = typeof runtimeLevel.action_type === "string" ? runtimeLevel.action_type : null;

  if (request.power.id === "body_reinforcement") {
    const allowedStats = getCastPowerAllowedStats(request.power);
    if (!request.selectedStatId || !allowedStats.includes(request.selectedStatId)) {
      return { error: "Body Reinforcement needs a valid physical stat selection." };
    }

    const statBonus = asNumber(mechanics.stat_bonus);
    const damageReductionBonus = asNumber(mechanics.damage_reduction_bonus);
    const summaryParts = [`+${statBonus} ${request.selectedStatId}`];
    const modifiers: ActivePowerEffectModifier[] = [
      {
        targetType: "stat",
        targetId: request.selectedStatId,
        value: statBonus,
        sourceLabel: `${request.power.name} Lv ${request.power.level}`,
      },
    ];

    if (damageReductionBonus > 0) {
      summaryParts.push(`+${damageReductionBonus} DR`);
      modifiers.push({
        targetType: "derived",
        targetId: "damage_reduction",
        value: damageReductionBonus,
        sourceLabel: `${request.power.name} Lv ${request.power.level}`,
      });
    }

    return {
      effect: createEffect(
        request,
        manaCost,
        actionType,
        `body_reinforcement:${request.selectedStatId}`,
        "direct",
        `${request.power.name} Lv ${request.power.level}`,
        joinSummary(summaryParts),
        request.selectedStatId,
        modifiers
      ),
      manaCost,
    };
  }

  if (
    request.power.id === "light_support" &&
    (request.variantId === undefined || request.variantId === "default")
  ) {
    const auraBonuses =
      mechanics.aura_bonuses && typeof mechanics.aura_bonuses === "object"
        ? (mechanics.aura_bonuses as Record<string, unknown>)
        : {};
    const attackDiceBonus = asNumber(auraBonuses.attack_dice_bonus);
    const damageReductionBonus = asNumber(auraBonuses.damage_reduction_bonus);
    const soakBonus = asNumber(auraBonuses.soak_bonus);
    const modifiers: ActivePowerEffectModifier[] = [];
    const summaryParts: string[] = [];

    if (attackDiceBonus > 0) {
      summaryParts.push(`+${attackDiceBonus} Hit`);
      modifiers.push({
        targetType: "derived",
        targetId: "attack_dice_bonus",
        value: attackDiceBonus,
        sourceLabel: `${request.power.name} Lv ${request.power.level}`,
      });
    }

    if (damageReductionBonus > 0) {
      summaryParts.push(`+${damageReductionBonus} DR`);
      modifiers.push({
        targetType: "derived",
        targetId: "damage_reduction",
        value: damageReductionBonus,
        sourceLabel: `${request.power.name} Lv ${request.power.level}`,
      });
    }

    if (soakBonus > 0) {
      summaryParts.push(`+${soakBonus} Soak`);
      modifiers.push({
        targetType: "derived",
        targetId: "soak",
        value: soakBonus,
        sourceLabel: `${request.power.name} Lv ${request.power.level}`,
      });
    }

    const resolvedShareMode = resolveAuraCastMode(request);
    const effectKind =
      resolvedShareMode === "aura" && request.targetCharacterId !== request.casterCharacterId
        ? "aura_shared"
        : "aura_source";

    return {
      effect: createEffect(
        request,
        manaCost,
        actionType,
        "light_support",
        effectKind,
        `${request.power.name} Lv ${request.power.level}`,
        joinSummary(summaryParts),
        null,
        modifiers,
        {
          shareMode: "aura",
          sharedTargetCharacterIds: effectKind === "aura_source" ? [request.casterCharacterId] : null,
        }
      ),
      manaCost,
    };
  }

  if (
    request.power.id === "shadow_control" &&
    (request.variantId === undefined ||
      request.variantId === "default" ||
      request.variantId === "shadow_cloak")
  ) {
    const cloak =
      mechanics.cloak_of_shadow && typeof mechanics.cloak_of_shadow === "object"
        ? (mechanics.cloak_of_shadow as Record<string, unknown>)
        : {};
    const manaCostVariants =
      mechanics.mana_cost_variants && typeof mechanics.mana_cost_variants === "object"
        ? (mechanics.mana_cost_variants as Record<string, unknown>)
        : {};
    const stealthBonus = asNumber(cloak.stealth_skill_bonus);
    const intimidationBonus = asNumber(cloak.intimidation_skill_bonus);
    const armorClassBonus = asNumber(cloak.armor_class_bonus);
    const resolvedShareMode = resolveAuraCastMode(request);
    const resolvedManaCost =
      resolvedShareMode === "aura"
        ? asNumber(manaCostVariants.shared_with_allies) || manaCost
        : asNumber(manaCostVariants.self_only) || manaCost;
    const effectKind =
      resolvedShareMode === "aura" && request.targetCharacterId !== request.casterCharacterId
        ? "aura_shared"
        : "aura_source";
    const modifiers: ActivePowerEffectModifier[] = [];
    const summaryParts: string[] = [];

    if (stealthBonus > 0) {
      summaryParts.push(`+${stealthBonus} Stealth`);
      modifiers.push({
        targetType: "skill",
        targetId: "stealth",
        value: stealthBonus,
        sourceLabel: `${request.power.name} Lv ${request.power.level}`,
      });
    }

    if (intimidationBonus > 0) {
      summaryParts.push(`+${intimidationBonus} Intimidation`);
      modifiers.push({
        targetType: "skill",
        targetId: "intimidation",
        value: intimidationBonus,
        sourceLabel: `${request.power.name} Lv ${request.power.level}`,
      });
    }

    if (armorClassBonus > 0) {
      summaryParts.push(`+${armorClassBonus} AC`);
      modifiers.push({
        targetType: "derived",
        targetId: "armor_class",
        value: armorClassBonus,
        sourceLabel: `${request.power.name} Lv ${request.power.level}`,
      });
    }

    return {
      effect: createEffect(
        request,
        resolvedManaCost,
        actionType,
        "shadow_control:cloak",
        effectKind,
        `${request.power.name} Lv ${request.power.level}`,
        joinSummary(summaryParts),
        null,
        modifiers,
        {
          shareMode: resolvedShareMode,
          sharedTargetCharacterIds: effectKind === "aura_source" ? [request.casterCharacterId] : null,
        }
      ),
      manaCost: resolvedManaCost,
    };
  }

  return { error: `${request.power.name} is not supported by the first cast slice yet.` };
}

export function doesActivePowerEffectConflict(
  existingEffect: ActivePowerEffect,
  incomingEffect: ActivePowerEffect
): boolean {
  if (existingEffect.targetCharacterId !== incomingEffect.targetCharacterId) {
    return false;
  }

  if (getNormalizedAuraStackKey(existingEffect) === getNormalizedAuraStackKey(incomingEffect)) {
    return true;
  }

  if (
    existingEffect.powerId === "light_support" &&
    incomingEffect.powerId === "light_support" &&
    LIGHT_SUPPORT_STACK_KEYS.has(existingEffect.stackKey) &&
    LIGHT_SUPPORT_STACK_KEYS.has(incomingEffect.stackKey)
  ) {
    return true;
  }

  if (
    existingEffect.powerId === "shadow_control" &&
    incomingEffect.powerId === "shadow_control" &&
    SHADOW_CLOAK_STACK_KEYS.has(existingEffect.stackKey) &&
    SHADOW_CLOAK_STACK_KEYS.has(incomingEffect.stackKey)
  ) {
    return true;
  }

  return false;
}

export function applyActivePowerEffect(
  sheet: CharacterDraft,
  effect: ActivePowerEffect
): CharacterDraft {
  return {
    ...sheet,
    activePowerEffects: [
      ...(sheet.activePowerEffects ?? []).filter(
        (existingEffect) => !doesActivePowerEffectConflict(existingEffect, effect)
      ),
      effect,
    ],
  };
}

export function buildAuraSharedPowerEffect(
  sourceEffect: ActivePowerEffect,
  targetCharacterId: string
): ActivePowerEffect {
  return {
    ...sourceEffect,
    id: createTimestampedId("power-effect"),
    effectKind: "aura_shared",
    stackKey: getNormalizedAuraStackKey(sourceEffect),
    targetCharacterId,
    sourceEffectId: sourceEffect.id,
    sharedTargetCharacterIds: null,
    manaCost: null,
    appliedAt: getIsoTimestamp(),
  };
}

export function buildLinkedAuraEffectForTarget(
  sourceEffect: ActivePowerEffect,
  targetCharacterId: string,
  options?: {
    targetDisposition?: "ally" | "enemy";
  }
): ActivePowerEffect {
  if (
    sourceEffect.powerId === "light_support" &&
    options?.targetDisposition === "enemy" &&
    sourceEffect.sourceLevel >= 5
  ) {
    const exposeDarkness = getLightSupportExposeDarknessMechanics(sourceEffect.sourceLevel);
    const resistanceLevelDelta = Math.trunc(asNumber(exposeDarkness?.resistance_level_delta));

    return {
      ...sourceEffect,
      id: createTimestampedId("power-effect"),
      effectKind: "aura_shared",
      stackKey: "light_support:expose_darkness",
      targetCharacterId,
      sourceEffectId: sourceEffect.id,
      label: "Expose Darkness",
      summary: "-1 physical / elemental resistance",
      manaCost: null,
      modifiers: LIGHT_SUPPORT_LEVEL_FIVE_EXPOSE_DARKNESS_TYPES.map((damageType) => ({
        targetType: "resistance" as const,
        targetId: damageType,
        value: resistanceLevelDelta,
        sourceLabel: "Expose Darkness",
      })),
      appliedAt: getIsoTimestamp(),
    };
  }

  return buildAuraSharedPowerEffect(sourceEffect, targetCharacterId);
}

export function canSelectAuraTargets(effect: ActivePowerEffect): boolean {
  return isAuraSourceEffect(effect) && getAuraShareMode(effect) === "aura";
}

export function updateAuraSourceTargets(
  sheet: CharacterDraft,
  sourceEffectId: string,
  targetCharacterIds: string[]
): CharacterDraft {
  return {
    ...sheet,
    activePowerEffects: (sheet.activePowerEffects ?? []).map((effect) =>
      effect.id === sourceEffectId
        ? {
            ...effect,
            effectKind: "aura_source",
            stackKey: getNormalizedAuraStackKey(effect),
            shareMode: getAuraShareMode(effect),
            sharedTargetCharacterIds: [...targetCharacterIds],
          }
        : effect
    ),
  };
}

export function removeAuraSharedEffectsBySource(
  sheet: CharacterDraft,
  sourceEffectId: string
): CharacterDraft {
  return {
    ...sheet,
    activePowerEffects: (sheet.activePowerEffects ?? []).filter(
      (effect) => effect.sourceEffectId !== sourceEffectId
    ),
  };
}

export function removeAuraSharedEffectsForTarget(
  sheet: CharacterDraft,
  sourceEffect: ActivePowerEffect,
  targetCharacterId: string
): CharacterDraft {
  const comparisonEffect = buildAuraSharedPowerEffect(sourceEffect, targetCharacterId);

  return {
    ...sheet,
    activePowerEffects: (sheet.activePowerEffects ?? []).filter((effect) => {
      if (effect.targetCharacterId !== targetCharacterId) {
        return true;
      }

      if (effect.sourceEffectId === sourceEffect.id) {
        return false;
      }

      if (!isAuraSharedEffect(effect)) {
        return true;
      }

      return !doesActivePowerEffectConflict(effect, comparisonEffect);
    }),
  };
}

export function removeActivePowerEffect(
  sheet: CharacterDraft,
  effectId: string
): CharacterDraft {
  return {
    ...sheet,
    activePowerEffects: (sheet.activePowerEffects ?? []).filter(
      (effect) => effect.id !== effectId
    ),
  };
}

export function spendPowerMana(
  sheet: CharacterDraft,
  manaCost: number,
  itemsById: Record<string, SharedItemRecord> = {}
): { error: string } | { sheet: CharacterDraft } {
  const runtime = buildCharacterDerivedValues(sheet, itemsById);
  if (manaCost > runtime.currentMana) {
    return {
      error: `Not enough mana. ${runtime.currentMana} available, ${manaCost} required.`,
    };
  }

  return {
    sheet: {
      ...sheet,
      manaInitialized: true,
      currentMana: runtime.currentMana - manaCost,
    },
  };
}
