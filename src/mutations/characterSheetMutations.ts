import { buildCharacterDerivedValues } from "../config/characterRuntime";
import type {
  CharacterDraft,
  PowerEntry,
} from "../config/characterTemplate";
import { buildGameHistoryNoteEntry, prependGameHistoryEntry } from "../lib/historyEntries";
import { getDecrementRefund, getIncrementCost } from "../lib/progressionCosts";
import { T1_POWER_XP_BY_LEVEL, T1_SKILL_XP_BY_LEVEL, STAT_XP_BY_LEVEL } from "../rules/xpTables";
import type { StatId } from "../types/character";
import type { SharedItemRecord } from "../types/items.ts";

export type RuntimeEditableField =
  | "currentHp"
  | "currentMana"
  | "inspiration"
  | "positiveKarma"
  | "negativeKarma";

type PowerTemplateSelection = Pick<PowerEntry, "id" | "name" | "governingStat">;

export function appendHistoryNote(
  sheet: CharacterDraft,
  note: string,
  createdAt: Date
): CharacterDraft {
  const trimmedNote = note.trim();
  if (!trimmedNote) {
    return sheet;
  }

  const entry = buildGameHistoryNoteEntry(trimmedNote, sheet.gameDateTime, createdAt);

  return {
    ...sheet,
    gameHistory: prependGameHistoryEntry(sheet.gameHistory ?? [], entry),
  };
}

export function adjustStatProgression(
  sheet: CharacterDraft,
  statId: StatId,
  direction: 1 | -1,
  availableXp: number,
  floorLevel: number
): CharacterDraft {
  const currentLevel = sheet.statState[statId].base;
  const nextLevel = currentLevel + direction;
  if (nextLevel < floorLevel || nextLevel >= STAT_XP_BY_LEVEL.length) {
    return sheet;
  }

  const xpDelta =
    direction === 1
      ? getIncrementCost(STAT_XP_BY_LEVEL, currentLevel)
      : -getDecrementRefund(STAT_XP_BY_LEVEL, currentLevel);
  if (direction === 1 && availableXp < xpDelta) {
    return sheet;
  }

  return {
    ...sheet,
    xpUsed: sheet.xpUsed + xpDelta,
    statState: {
      ...sheet.statState,
      [statId]: {
        ...sheet.statState[statId],
        base: nextLevel,
      },
    },
  };
}

export function adjustSkillProgression(
  sheet: CharacterDraft,
  skillId: string,
  direction: 1 | -1,
  availableXp: number
): CharacterDraft {
  const currentSkill = sheet.skills.find((skill) => skill.id === skillId);
  if (!currentSkill) {
    return sheet;
  }

  const nextLevel = currentSkill.base + direction;
  if (nextLevel < 0 || nextLevel >= T1_SKILL_XP_BY_LEVEL.length) {
    return sheet;
  }

  const xpDelta =
    direction === 1
      ? getIncrementCost(T1_SKILL_XP_BY_LEVEL, currentSkill.base)
      : -getDecrementRefund(T1_SKILL_XP_BY_LEVEL, currentSkill.base);
  if (direction === 1 && availableXp < xpDelta) {
    return sheet;
  }

  return {
    ...sheet,
    xpUsed: sheet.xpUsed + xpDelta,
    skills: sheet.skills.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            base: nextLevel,
          }
        : skill
    ),
  };
}

export function adjustPowerProgression(
  sheet: CharacterDraft,
  powerId: string,
  direction: 1 | -1,
  availableXp: number
): CharacterDraft {
  const currentPower = sheet.powers.find((power) => power.id === powerId);
  if (!currentPower) {
    return sheet;
  }

  const nextLevel = currentPower.level + direction;
  if (nextLevel < 0 || nextLevel >= T1_POWER_XP_BY_LEVEL.length) {
    return sheet;
  }

  const xpDelta =
    direction === 1
      ? getIncrementCost(T1_POWER_XP_BY_LEVEL, currentPower.level)
      : -getDecrementRefund(T1_POWER_XP_BY_LEVEL, currentPower.level);
  if (direction === 1 && availableXp < xpDelta) {
    return sheet;
  }

  return {
    ...sheet,
    xpUsed: sheet.xpUsed + xpDelta,
    powers:
      nextLevel === 0
        ? sheet.powers.filter((power) => power.id !== powerId)
        : sheet.powers.map((power) =>
            power.id === powerId
              ? {
                  ...power,
                  level: nextLevel,
                }
              : power
          ),
  };
}

export function setStatBaseLevel(sheet: CharacterDraft, statId: StatId, nextLevel: number): CharacterDraft {
  if (nextLevel < 0 || nextLevel >= STAT_XP_BY_LEVEL.length) {
    return sheet;
  }

  return {
    ...sheet,
    statState: {
      ...sheet.statState,
      [statId]: {
        ...sheet.statState[statId],
        base: nextLevel,
      },
    },
  };
}

export function setSkillBaseLevel(sheet: CharacterDraft, skillId: string, nextLevel: number): CharacterDraft {
  if (nextLevel < 0 || nextLevel >= T1_SKILL_XP_BY_LEVEL.length) {
    return sheet;
  }

  return {
    ...sheet,
    skills: sheet.skills.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            base: nextLevel,
          }
        : skill
    ),
  };
}

export function setPowerLevel(sheet: CharacterDraft, powerId: string, nextLevel: number): CharacterDraft {
  if (nextLevel < 0 || nextLevel >= T1_POWER_XP_BY_LEVEL.length) {
    return sheet;
  }

  return {
    ...sheet,
    powers:
      nextLevel === 0
        ? sheet.powers.filter((power) => power.id !== powerId)
        : sheet.powers.map((power) =>
            power.id === powerId
              ? {
                  ...power,
                  level: nextLevel,
                }
              : power
          ),
  };
}

export function addPowerAtLevelOne(
  sheet: CharacterDraft,
  template: PowerTemplateSelection,
  availableXp: number
): CharacterDraft {
  const levelOneCost = getIncrementCost(T1_POWER_XP_BY_LEVEL, 0);
  if (availableXp < levelOneCost) {
    return sheet;
  }

  return {
    ...sheet,
    xpUsed: sheet.xpUsed + levelOneCost,
    powers: [
      ...sheet.powers,
      {
        id: template.id,
        name: template.name,
        level: 1,
        governingStat: template.governingStat,
      },
    ],
  };
}

export function addPowerAtLevelOneOverride(
  sheet: CharacterDraft,
  template: PowerTemplateSelection
): CharacterDraft {
  return {
    ...sheet,
    powers: [
      ...sheet.powers,
      {
        id: template.id,
        name: template.name,
        level: 1,
        governingStat: template.governingStat,
      },
    ],
  };
}

export function updateRuntimeFieldValue(
  sheet: CharacterDraft,
  field: RuntimeEditableField,
  rawValue: number,
  itemsById: Record<string, SharedItemRecord> = {}
): CharacterDraft {
  const nextBaseValue =
    field === "currentHp" ? Math.trunc(rawValue) : Math.max(0, Math.trunc(rawValue));
  const derivedSnapshot = buildCharacterDerivedValues(sheet, itemsById);
  const currentValue = field === "currentMana" ? derivedSnapshot.currentMana : sheet[field];
  const maxValue =
    field === "currentHp" ? null : field === "currentMana" ? derivedSnapshot.maxMana : null;
  const nextValue = maxValue === null ? nextBaseValue : Math.min(nextBaseValue, maxValue);

  if (nextValue === currentValue) {
    return sheet;
  }

  return {
    ...sheet,
    [field]: nextValue,
    ...(field === "currentMana" ? { manaInitialized: true } : null),
  };
}

export function updateSheetFieldValue<K extends keyof CharacterDraft>(
  sheet: CharacterDraft,
  field: K,
  value: CharacterDraft[K]
): CharacterDraft {
  return {
    ...sheet,
    [field]: value,
  };
}
