import type { CharacterDraft } from "../config/characterTemplate.ts";
import { buildCharacterDerivedValues } from "../config/characterRuntime.ts";
import { RESISTANCE_LEVELS, type DamageTypeId } from "./resistances.ts";
import type { DamageMitigationChannel } from "./powerEffects.ts";

export function applyHealingToSheet(
  sheet: CharacterDraft,
  amount: number
): { sheet: CharacterDraft; appliedAmount: number } {
  const resolvedAmount = Math.max(0, Math.trunc(amount));
  const derived = buildCharacterDerivedValues(sheet);
  const nextHp = Math.min(sheet.currentHp + resolvedAmount, derived.maxHp);
  const appliedAmount = Math.max(0, nextHp - sheet.currentHp);

  return {
    sheet: {
      ...sheet,
      currentHp: nextHp,
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
  }
): {
  sheet: CharacterDraft;
  appliedDamage: number;
  mitigatedAmount: number;
  resistedAmount: number;
} {
  const resolvedAmount = Math.max(0, Math.trunc(options.rawAmount));
  const derived = buildCharacterDerivedValues(sheet);
  const mitigationValue =
    options.mitigationChannel === "dr" ? derived.damageReduction : derived.soak;
  const mitigatedAmount = Math.max(0, resolvedAmount - mitigationValue);
  const resistanceLevel = sheet.resistances[options.damageType] ?? 0;
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
