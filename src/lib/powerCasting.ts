import { executeAction } from "../engine/effectExecutor.ts";
import type { ActionContext } from "../engine/context.ts";
import { createActionForContext } from "../powers/registry.ts";
import type { PowerEntry } from "../config/characterTemplate.ts";
import type { CharacterRecord, StatId } from "../types/character.ts";
import type { SharedItemRecord } from "../types/items.ts";
import type { CastOutcomeState, PreparedCastRequest } from "../types/combatEncounterView.ts";
import type { DamageTypeId } from "../rules/resistances.ts";
import {
  getCastPowerVariantOptions,
  type CastPowerMode,
  type CastPowerVariantId,
} from "../rules/powerEffects.ts";

export type PowerUseEnvironment = "world" | "encounter";

export type CastTargetOption = {
  id: string;
  label: string;
};

export type SharedCastRequestPayload = {
  casterCharacter: CharacterRecord;
  casterDisplayName: string;
  selectedPower: PowerEntry;
  selectedVariantId: CastPowerVariantId;
  attackOutcome: CastOutcomeState;
  selectedTargetIds: string[];
  fallbackTargetIds: string[];
  healingAllocations: Record<string, number>;
  selectedStatId: StatId | null;
  castMode: CastPowerMode;
  selectedDamageType: DamageTypeId | null;
  bonusManaSpend: number;
  selectedSummonOptionId: string | null;
  itemsById?: Record<string, SharedItemRecord>;
};

export type WorldCastRequestPayload = SharedCastRequestPayload & {
  characters: CharacterRecord[];
};

export function getCastPowerVariantEnvironments(
  power: PowerEntry,
  variantId: CastPowerVariantId
): PowerUseEnvironment[] {
  const worldSupported =
    (power.id === "awareness" && variantId === "assess_entity") ||
    (power.id === "body_reinforcement" && variantId === "default") ||
    (power.id === "healing" && variantId === "healing_touch") ||
    (power.id === "light_support" && variantId === "luminous_restoration");

  return worldSupported ? ["world", "encounter"] : ["encounter"];
}

export function isCastPowerVariantSupportedInEnvironment(
  power: PowerEntry,
  variantId: CastPowerVariantId,
  environment: PowerUseEnvironment
): boolean {
  return getCastPowerVariantEnvironments(power, variantId).includes(environment);
}

export function getPreferredCastPowerVariantForEnvironment(
  power: PowerEntry,
  environment: PowerUseEnvironment
): CastPowerVariantId {
  const variantOptions = getCastPowerVariantOptions(power);
  return (
    variantOptions.find((option) =>
      isCastPowerVariantSupportedInEnvironment(power, option.id, environment)
    )?.id ??
    variantOptions[0]?.id ??
    "default"
  );
}

export function executePreparedCastForContext(
  context: ActionContext,
  unsupportedMessage: string
): { error: string } | { request: PreparedCastRequest; warnings: string[] } {
  const action = createActionForContext(context);
  if (!action) {
    return {
      error: unsupportedMessage,
    };
  }

  try {
    return executeAction(action, context);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to prepare cast request.",
    };
  }
}
