import type { CharacterDraft } from "../config/characterTemplate";
import type {
  PowerUsageResetScope,
  PowerUsageState,
  PowerUsageSummaryEntry,
} from "../types/powerUsage";
import {
  BODY_REINFORCEMENT_CANTRIP_SPELL_NAME,
  HEALING_TOUCH_SPELL_NAME,
} from "../powers/spellLabels.ts";

export const POWER_USAGE_KEYS = {
  bodyReinforcementRevive: "body_reinforcement:cantrip:revive",
  elementalistLockedDamageType: "elementalist:locked_damage_type",
  healingOverheal: "healing:overheal",
  healingCantrip: "healing:cantrip:wound_mend",
  lightSupportManaRestore: "light_support:mana_restore",
} as const;

export function createEmptyPowerUsageState(): PowerUsageState {
  return {
    daily: {},
    longRest: {},
    perTargetDaily: {},
    longRestSelections: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCounterRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, rawCount]) => {
      if (typeof rawCount !== "number" || !Number.isFinite(rawCount)) {
        return [];
      }

      return [[key, Math.max(0, Math.trunc(rawCount))]];
    })
  );
}

export function normalizePowerUsageState(value: unknown): PowerUsageState {
  const record = isRecord(value) ? value : {};
  const perTargetDaily = isRecord(record.perTargetDaily)
    ? Object.fromEntries(
        Object.entries(record.perTargetDaily).map(([key, targetCounts]) => [
          key,
          normalizeCounterRecord(targetCounts),
        ])
      )
    : {};

  return {
    daily: normalizeCounterRecord(record.daily),
    longRest: normalizeCounterRecord(record.longRest),
    perTargetDaily,
    longRestSelections: isRecord(record.longRestSelections)
      ? Object.fromEntries(
          Object.entries(record.longRestSelections).flatMap(([key, rawValue]) =>
            typeof rawValue === "string" ? [[key, rawValue]] : []
          )
        )
      : {},
  };
}

export function getPowerUsageCount(
  state: PowerUsageState,
  scope: PowerUsageResetScope,
  key: string
): number {
  return Math.max(0, Math.trunc(state[scope][key] ?? 0));
}

export function getPerTargetDailyPowerUsageCount(
  state: PowerUsageState,
  key: string,
  targetCharacterId: string
): number {
  return Math.max(0, Math.trunc(state.perTargetDaily[key]?.[targetCharacterId] ?? 0));
}

export function incrementPowerUsageCount(
  state: PowerUsageState,
  scope: PowerUsageResetScope,
  key: string,
  amount = 1
): PowerUsageState {
  const nextAmount = Math.max(0, Math.trunc(amount));
  if (nextAmount <= 0) {
    return state;
  }

  return {
    ...state,
    [scope]: {
      ...state[scope],
      [key]: getPowerUsageCount(state, scope, key) + nextAmount,
    },
  };
}

export function incrementPerTargetDailyPowerUsageCount(
  state: PowerUsageState,
  key: string,
  targetCharacterId: string,
  amount = 1
): PowerUsageState {
  const nextAmount = Math.max(0, Math.trunc(amount));
  if (!targetCharacterId || nextAmount <= 0) {
    return state;
  }

  const existingTargetCounts = state.perTargetDaily[key] ?? {};

  return {
    ...state,
    perTargetDaily: {
      ...state.perTargetDaily,
      [key]: {
        ...existingTargetCounts,
        [targetCharacterId]:
          getPerTargetDailyPowerUsageCount(state, key, targetCharacterId) + nextAmount,
      },
    },
  };
}

export function resetPowerUsageScope(
  state: PowerUsageState,
  scope: PowerUsageResetScope
): PowerUsageState {
  if (scope === "daily") {
    return {
      ...state,
      daily: {},
      perTargetDaily: {},
    };
  }

  return {
    ...state,
    longRest: {},
    longRestSelections: {},
  };
}

export function getLongRestSelection(state: PowerUsageState, key: string): string | null {
  return typeof state.longRestSelections[key] === "string" ? state.longRestSelections[key] : null;
}

export function setLongRestSelection(
  state: PowerUsageState,
  key: string,
  value: string | null
): PowerUsageState {
  if (!key) {
    return state;
  }

  if (!value) {
    const { [key]: _removed, ...rest } = state.longRestSelections;
    return {
      ...state,
      longRestSelections: rest,
    };
  }

  return {
    ...state,
    longRestSelections: {
      ...state.longRestSelections,
      [key]: value,
    },
  };
}

export function resetCharacterPowerUsageScope(
  sheet: CharacterDraft,
  scope: PowerUsageResetScope
): CharacterDraft {
  return {
    ...sheet,
    powerUsageState: resetPowerUsageScope(sheet.powerUsageState, scope),
  };
}

export function buildPowerUsageSummary(sheet: CharacterDraft): PowerUsageSummaryEntry[] {
  const state = sheet.powerUsageState;
  const summary: PowerUsageSummaryEntry[] = [];
  const powerLevelById = Object.fromEntries(sheet.powers.map((power) => [power.id, power.level]));

  if ((powerLevelById.body_reinforcement ?? 0) >= 1) {
    summary.push({
      id: POWER_USAGE_KEYS.bodyReinforcementRevive,
      label: BODY_REINFORCEMENT_CANTRIP_SPELL_NAME,
      resetLabel: "Daily",
      detail: `${getPowerUsageCount(state, "daily", POWER_USAGE_KEYS.bodyReinforcementRevive)} / 1 used`,
    });
  }

  if ((powerLevelById.healing ?? 0) >= 3) {
    const woundMendTargets = Object.keys(state.perTargetDaily[POWER_USAGE_KEYS.healingCantrip] ?? {});
    summary.push({
      id: POWER_USAGE_KEYS.healingCantrip,
      label: `${HEALING_TOUCH_SPELL_NAME} Uses`,
      resetLabel: "Daily",
      detail:
        woundMendTargets.length === 0
          ? "No targets tracked today"
          : `${woundMendTargets.length} tracked target${woundMendTargets.length === 1 ? "" : "s"}`,
    });
  }

  if ((powerLevelById.healing ?? 0) >= 5) {
    const overhealTargets = Object.keys(state.perTargetDaily[POWER_USAGE_KEYS.healingOverheal] ?? {});
    summary.push({
      id: POWER_USAGE_KEYS.healingOverheal,
      label: "Healing Overheal",
      resetLabel: "Daily",
      detail:
        overhealTargets.length === 0
          ? "No targets tracked today"
          : `${overhealTargets.length} tracked target${overhealTargets.length === 1 ? "" : "s"}`,
    });
  }

  return summary;
}
