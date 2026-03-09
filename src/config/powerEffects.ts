import type { ActivePowerEffect, ActivePowerEffectModifier } from "../types/activePowerEffects";
import type { CharacterDraft, PowerEntry, StatId } from "./characterTemplate.ts";
import { buildCharacterDerivedValues } from "./characterRuntime.ts";
import { getRuntimePowerLevelDefinition } from "./powerData.ts";

export type CastPowerTargetMode = "self" | "single" | "multiple";

export type CastPowerBuildRequest = {
  casterCharacterId: string;
  casterName: string;
  targetCharacterId: string;
  targetName: string;
  power: PowerEntry;
  selectedStatId?: StatId | null;
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
  label: string,
  summary: string,
  selectedStatId: StatId | null,
  modifiers: ActivePowerEffectModifier[]
): ActivePowerEffect {
  return {
    id: `power-effect-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stackKey,
    powerId: request.power.id,
    powerName: request.power.name,
    sourceLevel: request.power.level,
    casterCharacterId: request.casterCharacterId,
    casterName: request.casterName,
    targetCharacterId: request.targetCharacterId,
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
  return ["body_reinforcement", "light_support", "shadow_control"];
}

export function isSupportedCastablePower(powerId: string): boolean {
  return getSupportedCastablePowerIds().includes(powerId);
}

export function getSupportedCastablePowers(sheet: CharacterDraft): PowerEntry[] {
  return sheet.powers.filter((power) => isSupportedCastablePower(power.id) && power.level > 0);
}

export function getCastPowerTargetMode(power: PowerEntry): CastPowerTargetMode {
  if (power.id === "light_support") {
    return "multiple";
  }

  if (power.id === "shadow_control" && power.level < 4) {
    return "self";
  }

  if (power.id === "shadow_control" && power.level >= 4) {
    return "multiple";
  }

  if (power.id === "body_reinforcement" && power.level === 1) {
    return "self";
  }

  return "single";
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
        `${request.power.name} Lv ${request.power.level}`,
        joinSummary(summaryParts),
        null,
        modifiers
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
      request.targetCharacterId === request.casterCharacterId
        ? asNumber(manaCostVariants.self_only) || manaCost
        : asNumber(manaCostVariants.shared_with_allies) || manaCost;
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
        `${request.power.name} Lv ${request.power.level}`,
        joinSummary(summaryParts),
        null,
        modifiers
      ),
      manaCost: resolvedManaCost,
    };
  }

  return { error: `${request.power.name} is not supported by the first cast slice yet.` };
}

export function applyActivePowerEffect(
  sheet: CharacterDraft,
  effect: ActivePowerEffect
): CharacterDraft {
  return {
    ...sheet,
    activePowerEffects: [
      ...(sheet.activePowerEffects ?? []).filter(
        (existingEffect) =>
          !(
            existingEffect.targetCharacterId === effect.targetCharacterId &&
            existingEffect.stackKey === effect.stackKey
          )
      ),
      effect,
    ],
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
