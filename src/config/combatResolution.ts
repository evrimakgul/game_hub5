import type { CharacterDraft } from "./characterTemplate.ts";
import { buildCharacterDerivedValues } from "./characterRuntime.ts";

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
