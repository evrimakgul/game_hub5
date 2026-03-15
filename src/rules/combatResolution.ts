import type { CharacterDraft } from "../config/characterTemplate.ts";
import {
  buildCharacterDerivedValues,
  getResolvedResistanceLevel,
} from "../config/characterRuntime.ts";
import { RESISTANCE_LEVELS, type DamageTypeId } from "./resistances.ts";
import type { DamageMitigationChannel } from "./powerEffects.ts";
import type { SharedItemRecord } from "../types/items.ts";

export function applyHealingToSheet(
  sheet: CharacterDraft,
  amount: number,
  options?: {
    temporaryHpCap?: number | null;
    itemsById?: Record<string, SharedItemRecord>;
  }
): { sheet: CharacterDraft; appliedAmount: number } {
  const resolvedAmount = Math.max(0, Math.trunc(amount));
  const derived = buildCharacterDerivedValues(sheet, options?.itemsById ?? {});
  const nextHp = Math.min(sheet.currentHp + resolvedAmount, derived.maxHp);
  const overflowAmount = Math.max(0, sheet.currentHp + resolvedAmount - derived.maxHp);
  const temporaryHpCap = Math.max(0, Math.trunc(options?.temporaryHpCap ?? 0));
  const grantedTemporaryHp =
    temporaryHpCap > 0 ? Math.min(overflowAmount, temporaryHpCap) : 0;
  const appliedAmount = Math.max(0, nextHp - sheet.currentHp) + grantedTemporaryHp;

  return {
    sheet: {
      ...sheet,
      currentHp: nextHp,
      temporaryHp: sheet.temporaryHp + grantedTemporaryHp,
    },
    appliedAmount,
  };
}

export function applyDamageToSheet(
  sheet: CharacterDraft,
  options: {
    rawAmount: number;
    damageType: DamageTypeId;
    mitigationChannel: DamageMitigationChannel;
    itemsById?: Record<string, SharedItemRecord>;
  }
): {
  sheet: CharacterDraft;
  appliedDamage: number;
  mitigatedAmount: number;
  resistedAmount: number;
} {
  const resolvedAmount = Math.max(0, Math.trunc(options.rawAmount));
  const derived = buildCharacterDerivedValues(sheet, options.itemsById ?? {});
  const mitigationValue =
    options.mitigationChannel === "dr" ? derived.damageReduction : derived.soak;
  const mitigatedAmount = Math.max(0, resolvedAmount - mitigationValue);
  const resistanceLevel = getResolvedResistanceLevel(sheet, options.damageType, options.itemsById ?? {});
  const resistanceRule = RESISTANCE_LEVELS[resistanceLevel];
  const resistedAmount = Math.max(
    0,
    Math.ceil(mitigatedAmount * resistanceRule.damageMultiplier)
  );
  const absorbedByTemporaryHp = Math.min(sheet.temporaryHp, resistedAmount);
  const hpDamage = resistedAmount - absorbedByTemporaryHp;
  const nextHp = sheet.currentHp - hpDamage;

  return {
    sheet: {
      ...sheet,
      temporaryHp: sheet.temporaryHp - absorbedByTemporaryHp,
      currentHp: nextHp,
    },
    appliedDamage: Math.max(0, hpDamage),
    mitigatedAmount,
    resistedAmount,
  };
}
