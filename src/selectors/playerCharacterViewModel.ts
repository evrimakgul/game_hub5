import {
  buildCharacterDerivedValues,
  getCurrentSkillValue,
} from "../config/characterRuntime.ts";
import {
  powerLibrary,
  statGroups,
  type CharacterDraft,
} from "../config/characterTemplate.ts";
import { getCrAndRankFromXpUsed } from "../rules/xpTables.ts";
import type { StatId } from "../types/character.ts";
import type { SharedItemRecord } from "../types/items.ts";

export type PlayerRollTarget = {
  id: string;
  label: string;
  value: number;
  category: "stat" | "skill";
};

export function buildEditSessionStatFloor(sheet: CharacterDraft): Record<StatId, number> {
  return {
    STR: sheet.statState.STR.base,
    DEX: sheet.statState.DEX.base,
    STAM: sheet.statState.STAM.base,
    CHA: sheet.statState.CHA.base,
    APP: sheet.statState.APP.base,
    MAN: sheet.statState.MAN.base,
    INT: sheet.statState.INT.base,
    WITS: sheet.statState.WITS.base,
    PER: sheet.statState.PER.base,
  };
}

export function buildPlayerCharacterViewModel(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord> = {}
) {
  const derived = buildCharacterDerivedValues(sheet, itemsById);
  const currentStats = derived.currentStats;
  const progression = getCrAndRankFromXpUsed(sheet.xpUsed);
  const xpLeftOver = sheet.xpEarned - sheet.xpUsed;
  const rollTargets: PlayerRollTarget[] = [
    ...statGroups.flatMap((group) =>
      group.ids.map((statId) => ({
        id: `stat:${statId}`,
        label: statId,
        value: currentStats[statId],
        category: "stat" as const,
      }))
    ),
    ...sheet.skills.map((skill) => ({
      id: `skill:${skill.id}`,
      label: skill.label,
      value: getCurrentSkillValue(sheet, skill.id, itemsById),
      category: "skill" as const,
    })),
  ];

  return {
    derived,
    currentStats,
    progression,
    xpLeftOver,
    rollTargets,
    statRollTargets: rollTargets.filter((target) => target.category === "stat"),
    skillRollTargets: rollTargets.filter((target) => target.category === "skill"),
    availablePowerOptions: powerLibrary.filter(
      (power) => !sheet.powers.some((knownPower) => knownPower.id === power.id)
    ),
  };
}


