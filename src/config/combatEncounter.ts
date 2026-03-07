import type {
  CharacterDraft,
  SkillEntry,
  StatEntry,
  StatId,
  StatSource,
} from "./characterTemplate.ts";
import { DAMAGE_TYPES, RESISTANCE_LEVELS } from "./resistances.ts";
import { resolveDicePool } from "./combat.ts";
import {
  calculateArmorClass,
  calculateInitiative,
  calculateMaxHP,
  calculateOccultManaBonus,
  calculateRangedBonusDice,
} from "./stats.ts";
import type {
  CharacterEncounterSnapshot,
  CombatEncounterParticipantInput,
  CombatEncounterState,
  EncounterBreakdownField,
  EncounterCombatSummaryField,
} from "../types/combatEncounter.ts";

const STAT_IDS: StatId[] = ["STR", "DEX", "STAM", "CHA", "APP", "MAN", "INT", "WITS", "PER"];
const HIGHLIGHTED_SKILL_IDS = ["intimidation", "stealth", "alertness"] as const;

function randomD10(): number {
  return Math.floor(Math.random() * 10) + 1;
}

function rollInitiativePool(poolSize: number): number[] {
  return Array.from({ length: Math.max(0, poolSize) }, () => randomD10());
}

function buildSummary(base: number, gearSources: StatSource[], buffSources: StatSource[]): string {
  const gearTotal = gearSources.reduce((total, source) => total + source.value, 0);
  const buffTotal = buffSources.reduce((total, source) => total + source.value, 0);
  return `Base ${base} + Gears ${gearTotal} + Buffs ${buffTotal}`;
}

function buildDetail(gearSources: StatSource[], buffSources: StatSource[]): string {
  const gearText =
    gearSources.length > 0
      ? gearSources
          .map((source) => `${source.label} ${source.value >= 0 ? "+" : ""}${source.value}`)
          .join(", ")
      : "none";
  const buffText =
    buffSources.length > 0
      ? buffSources
          .map((source) => `${source.label} ${source.value >= 0 ? "+" : ""}${source.value}`)
          .join(", ")
      : "none";

  return `Gear: ${gearText} | Buffs: ${buffText}`;
}

export function getCurrentStatValue(
  statState: Record<StatId, StatEntry>,
  statId: StatId
): number {
  const stat = statState[statId];
  const gearTotal = stat.gearSources.reduce((total, source) => total + source.value, 0);
  const buffTotal = stat.buffSources.reduce((total, source) => total + source.value, 0);
  return stat.base + gearTotal + buffTotal;
}

export function getCurrentSkillValue(skills: SkillEntry[], skillId: string): number {
  const skill = skills.find((entry) => entry.id === skillId);
  if (!skill) {
    return 0;
  }

  const gearTotal = skill.gearSources.reduce((total, source) => total + source.value, 0);
  const buffTotal = skill.buffSources.reduce((total, source) => total + source.value, 0);
  return skill.base + gearTotal + buffTotal;
}

export function buildEncounterParticipantInput(
  characterId: string,
  ownerRole: "player" | "dm",
  sheet: CharacterDraft
): CombatEncounterParticipantInput {
  return {
    characterId,
    ownerRole,
    displayName: sheet.name.trim() || "Unnamed Character",
    dex: getCurrentStatValue(sheet.statState, "DEX"),
    wits: getCurrentStatValue(sheet.statState, "WITS"),
  };
}

export function createCombatEncounter(
  label: string,
  participants: CombatEncounterParticipantInput[]
): CombatEncounterState {
  if (participants.length === 0) {
    throw new RangeError("Add at least one combatant before starting the encounter.");
  }

  const uniqueIds = new Set<string>();
  const resolvedParticipants = participants.map((participant) => {
    if (uniqueIds.has(participant.characterId)) {
      throw new RangeError(`Duplicate combatant detected: ${participant.characterId}`);
    }

    uniqueIds.add(participant.characterId);

    const initiativePool = Math.max(0, calculateInitiative(participant.dex, participant.wits));
    const initiativeFaces =
      participant.initiativeFaces !== undefined
        ? participant.initiativeFaces
        : rollInitiativePool(initiativePool);

    if (initiativeFaces.length !== initiativePool) {
      throw new RangeError(
        `Initiative roll for ${participant.displayName} must contain ${initiativePool} dice results.`
      );
    }

    const initiativeSuccesses = resolveDicePool(initiativeFaces, initiativePool).successes;

    return {
      characterId: participant.characterId,
      ownerRole: participant.ownerRole,
      displayName: participant.displayName,
      initiativePool,
      initiativeFaces,
      initiativeSuccesses,
      dex: participant.dex,
      wits: participant.wits,
    };
  });

  resolvedParticipants.sort((left, right) => {
    if (right.initiativeSuccesses !== left.initiativeSuccesses) {
      return right.initiativeSuccesses - left.initiativeSuccesses;
    }

    if (right.initiativePool !== left.initiativePool) {
      return right.initiativePool - left.initiativePool;
    }

    if (right.dex !== left.dex) {
      return right.dex - left.dex;
    }

    if (right.wits !== left.wits) {
      return right.wits - left.wits;
    }

    return left.displayName.localeCompare(right.displayName);
  });

  return {
    encounterId: `encounter-${Date.now()}`,
    label: label.trim() || "Combat Encounter",
    participants: resolvedParticipants,
    createdAt: new Date().toISOString(),
  };
}

export function buildCharacterEncounterSnapshot(sheet: CharacterDraft): CharacterEncounterSnapshot {
  const currentStats = Object.fromEntries(
    STAT_IDS.map((statId) => [statId, getCurrentStatValue(sheet.statState, statId)])
  ) as Record<StatId, number>;
  const occultManaBonus = calculateOccultManaBonus(
    getCurrentSkillValue(sheet.skills, "occultism"),
    sheet.xpUsed
  );

  const combatSummary: EncounterCombatSummaryField[] = [
    {
      id: "hp",
      label: "HP",
      value: `${sheet.currentHp} / ${calculateMaxHP(currentStats.STAM)}`,
    },
    {
      id: "mana",
      label: "Mana",
      value: `${sheet.currentMana} / ${sheet.currentMana + occultManaBonus}`,
    },
    {
      id: "initiative",
      label: "Initiative",
      value: calculateInitiative(currentStats.DEX, currentStats.WITS),
    },
    {
      id: "ac",
      label: "AC",
      value: calculateArmorClass(
        currentStats.DEX,
        getCurrentSkillValue(sheet.skills, "athletics"),
        0
      ),
    },
    {
      id: "dr",
      label: "DR",
      value: 0,
    },
    {
      id: "soak",
      label: "Soak",
      value: currentStats.STAM,
    },
    {
      id: "melee_attack",
      label: "Melee Attack",
      value: getCurrentSkillValue(sheet.skills, "melee") + currentStats.DEX,
    },
    {
      id: "ranged_attack",
      label: "Ranged Attack",
      value:
        getCurrentSkillValue(sheet.skills, "ranged") +
        currentStats.DEX +
        calculateRangedBonusDice(currentStats.PER),
    },
    {
      id: "melee_damage",
      label: "Melee Damage",
      value: currentStats.STR,
    },
    {
      id: "ranged_damage",
      label: "Ranged Damage",
      value: "-",
    },
  ];

  const stats: EncounterBreakdownField[] = STAT_IDS.map((statId) => {
    const stat = sheet.statState[statId];
    return {
      id: statId,
      label: statId,
      value: currentStats[statId],
      summary: buildSummary(stat.base, stat.gearSources, stat.buffSources),
      detail: buildDetail(stat.gearSources, stat.buffSources),
    };
  });

  const highlightedSkills: EncounterBreakdownField[] = HIGHLIGHTED_SKILL_IDS.map((skillId) => {
    const skill = sheet.skills.find((entry) => entry.id === skillId);
    return {
      id: skillId,
      label: skill?.label ?? skillId,
      value: getCurrentSkillValue(sheet.skills, skillId),
      summary: buildSummary(skill?.base ?? 0, skill?.gearSources ?? [], skill?.buffSources ?? []),
      detail: buildDetail(skill?.gearSources ?? [], skill?.buffSources ?? []),
    };
  });

  const visibleResistances = DAMAGE_TYPES.flatMap((damageType) => {
    const level = sheet.resistances[damageType.id];
    if (level === 0) {
      return [];
    }

    const rule = RESISTANCE_LEVELS[level];
    return [
      {
        id: damageType.id,
        label: damageType.label,
        levelLabel: rule.label,
        multiplierLabel: `(x${rule.damageMultiplier})`,
      },
    ];
  });

  return {
    combatSummary,
    stats,
    highlightedSkills,
    visibleResistances,
    inspiration: sheet.inspiration,
  };
}
