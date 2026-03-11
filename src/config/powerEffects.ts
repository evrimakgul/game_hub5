import type {
  ActivePowerEffect,
  ActivePowerEffectKind,
  ActivePowerEffectModifier,
  ActivePowerShareMode,
} from "../types/activePowerEffects";
import type { DamageTypeId } from "./resistances.ts";
import type { CharacterDraft, PowerEntry, StatId } from "./characterTemplate.ts";
import { buildCharacterDerivedValues, getCurrentStatValue } from "./characterRuntime.ts";
import { getRuntimePowerLevelDefinition } from "./powerData.ts";

export type CastPowerTargetMode = "self" | "single" | "multiple";
export type CastPowerMode = "self" | "aura";
export type DamageMitigationChannel = "dr" | "soak";
export type CastPowerVariantId = "default" | "shadow_cloak" | "shadow_manipulation";
export type CastPowerVariantOption = {
  id: CastPowerVariantId;
  label: string;
};
export type HealingCastApplication = {
  targetCharacterId: string;
  amount: number;
};
export type DirectDamageCastApplication = {
  targetCharacterId: string;
  rawAmount: number;
  damageType: DamageTypeId;
  mitigationChannel: DamageMitigationChannel;
  sourceLabel: string;
  sourceSummary: string;
};

const LIGHT_SUPPORT_STACK_KEYS = new Set(["light_support", "light_support:aura"]);
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

function isStatId(value: unknown): value is StatId {
  return (
    value === "STR" ||
    value === "DEX" ||
    value === "STAM" ||
    value === "CHA" ||
    value === "APP" ||
    value === "MAN" ||
    value === "INT" ||
    value === "WITS" ||
    value === "PER"
  );
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function joinSummary(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(", ");
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
    id: `power-effect-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
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
    appliedAt: new Date().toISOString(),
  };
}

export function getSupportedCastablePowerIds(): string[] {
  return ["body_reinforcement", "healing", "light_support", "shadow_control"];
}

export function isSupportedCastablePower(powerId: string): boolean {
  return getSupportedCastablePowerIds().includes(powerId);
}

export function getSupportedCastablePowers(sheet: CharacterDraft): PowerEntry[] {
  return sheet.powers.filter((power) => isSupportedCastablePower(power.id) && power.level > 0);
}

export function getCastPowerTargetMode(power: PowerEntry): CastPowerTargetMode {
  return getCastPowerTargetModeForVariant(power, "default");
}

export function getCastPowerTargetModeForVariant(
  power: PowerEntry,
  variantId: CastPowerVariantId
): CastPowerTargetMode {
  if (power.id === "healing") {
    return getCastPowerTargetLimit(power) > 1 ? "multiple" : "single";
  }

  if (power.id === "light_support") {
    return "self";
  }

  if (power.id === "shadow_control") {
    if (variantId === "shadow_manipulation") {
      return "single";
    }

    return "self";
  }

  if (power.id === "body_reinforcement" && power.level === 1) {
    return "self";
  }

  return "single";
}

export function getCastPowerTargetLimit(power: PowerEntry): number {
  if (power.id === "healing") {
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
    if (variantId === "shadow_manipulation") {
      return ["self"];
    }

    return ["self", "aura"];
  }

  return ["self"];
}

export function getCastPowerVariantOptions(power: PowerEntry): CastPowerVariantOption[] {
  if (power.id === "shadow_control" && power.level >= 3) {
    return [
      { id: "shadow_cloak", label: "Cloak of Shadow" },
      { id: "shadow_manipulation", label: "Shadow Manipulation" },
    ];
  }

  return [{ id: "default", label: power.name }];
}

export function getHealingPowerTotal(sheet: CharacterDraft, power: PowerEntry): number | null {
  if (power.id !== "healing") {
    return null;
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
  return Math.max(0, getCurrentStatValue(sheet, baseStat) + asNumber(healing.flat_bonus));
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
  targetCharacterIds: string[];
  allocations?: Record<string, number>;
}): { error: string } | { manaCost: number; applications: HealingCastApplication[]; totalAmount: number } {
  if (request.power.id !== "healing") {
    return { error: `${request.power.name} is not a healing power.` };
  }

  const runtimeLevel = getRuntimePowerLevelDefinition(request.power.id, request.power.level);
  if (!runtimeLevel) {
    return { error: `Power data for ${request.power.name} Lv ${request.power.level} is missing.` };
  }

  const totalAmount = getHealingPowerTotal(request.casterSheet, request.power);
  if (totalAmount === null) {
    return { error: `Healing data for ${request.power.name} Lv ${request.power.level} is missing.` };
  }

  const manaCost = asNumber(runtimeLevel.mana_cost);
  const uniqueTargetIds = Array.from(new Set(request.targetCharacterIds));
  const targetLimit = getCastPowerTargetLimit(request.power);

  if (uniqueTargetIds.length === 0) {
    return { error: "Select at least one valid healing target." };
  }

  if (uniqueTargetIds.length > targetLimit) {
    return { error: `Healing can affect at most ${targetLimit} target(s) at this level.` };
  }

  if (targetLimit === 1) {
    return {
      manaCost,
      totalAmount,
      applications: [
        {
          targetCharacterId: uniqueTargetIds[0],
          amount: totalAmount,
        },
      ],
    };
  }

  const fallbackDistribution = splitEvenly(totalAmount, uniqueTargetIds.length);
  const normalizedAllocations = uniqueTargetIds.map((targetId, index) => {
    const rawValue = request.allocations?.[targetId];
    const amount = Number.isFinite(rawValue) ? Math.max(0, Math.trunc(rawValue ?? 0)) : fallbackDistribution[index];
    return {
      targetCharacterId: targetId,
      amount,
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
  };
}

export function buildDirectDamageCastResolution(request: {
  casterSheet: CharacterDraft;
  power: PowerEntry;
  variantId: CastPowerVariantId;
  targetCharacterIds: string[];
}):
  | { error: string }
  | { manaCost: number; applications: DirectDamageCastApplication[] } {
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
      getCurrentStatValue(request.casterSheet, baseStat) +
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

  if (request.power.id === "light_support") {
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

    return {
      effect: createEffect(
        request,
        manaCost,
        actionType,
        "light_support",
        "aura_source",
        `${request.power.name} Lv ${request.power.level}`,
        joinSummary(summaryParts),
        null,
        modifiers,
        {
          shareMode: "aura",
          sharedTargetCharacterIds: [request.casterCharacterId],
        }
      ),
      manaCost,
    };
  }

  if (request.power.id === "shadow_control") {
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
    const resolvedManaCost =
      request.castMode === "aura"
        ? asNumber(manaCostVariants.shared_with_allies) || manaCost
        : asNumber(manaCostVariants.self_only) || manaCost;
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
        "aura_source",
        `${request.power.name} Lv ${request.power.level}`,
        joinSummary(summaryParts),
        null,
        modifiers,
        {
          shareMode: request.castMode === "aura" ? "aura" : "self",
          sharedTargetCharacterIds: [request.casterCharacterId],
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
    id: `power-effect-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    effectKind: "aura_shared",
    stackKey: getNormalizedAuraStackKey(sourceEffect),
    targetCharacterId,
    sourceEffectId: sourceEffect.id,
    sharedTargetCharacterIds: null,
    manaCost: null,
    appliedAt: new Date().toISOString(),
  };
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
  manaCost: number
): { error: string } | { sheet: CharacterDraft } {
  const runtime = buildCharacterDerivedValues(sheet);
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
