import { getRuntimePowerCantripLevels } from "../rules/powerData.ts";
import type { PowerEntry, StatSource } from "../config/characterTemplate.ts";
import type { PowerPassiveProviderResult } from "./types.ts";

export function getUnlockedCantripMechanics(power: PowerEntry): Record<string, unknown> | null {
  if (power.level <= 0) {
    return null;
  }

  const unlockedLevel =
    getRuntimePowerCantripLevels(power.id)
      .filter((level) => level.power_level <= power.level)
      .at(-1) ?? null;

  return unlockedLevel?.mechanics ?? null;
}

export function createSkillSource(label: string, value: number): StatSource {
  return {
    label,
    value: Math.trunc(value),
  };
}

export function createEmptyPassiveProviderResult(): PowerPassiveProviderResult {
  return {
    skillSources: [],
    utilityTraits: [],
    manaBonus: 0,
  };
}
