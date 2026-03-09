import type {
  CharacterDraft,
  StatId,
} from "./characterTemplate.ts";
import { DAMAGE_TYPES, RESISTANCE_LEVELS } from "./resistances.ts";
import { resolveDicePool } from "./combat.ts";
import { calculateInitiative } from "./stats.ts";
import {
  buildCharacterDerivedValues,
  getCurrentStatValue,
  getSkillBreakdown,
  getStatBreakdown,
} from "./characterRuntime.ts";
import type {
  CharacterEncounterSnapshot,
  CombatEncounterParty,
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

export function buildEncounterParticipantInput(
  characterId: string,
  ownerRole: "player" | "dm",
  sheet: CharacterDraft,
  partyId: string | null
): CombatEncounterParticipantInput {
  return {
    characterId,
    ownerRole,
    displayName: sheet.name.trim() || "Unnamed Character",
    dex: getCurrentStatValue(sheet, "DEX"),
    wits: getCurrentStatValue(sheet, "WITS"),
    partyId,
  };
}

export function createCombatEncounter(
  label: string,
  participants: CombatEncounterParticipantInput[],
  parties: CombatEncounterParty[]
): CombatEncounterState {
  if (participants.length === 0) {
    throw new RangeError("Add at least one combatant before starting the encounter.");
  }

  const uniquePartyIds = new Set<string>();
  parties.forEach((party) => {
    if (uniquePartyIds.has(party.partyId)) {
      throw new RangeError(`Duplicate party detected: ${party.partyId}`);
    }

    uniquePartyIds.add(party.partyId);
  });

  const uniqueIds = new Set<string>();
  const resolvedParticipants = participants.map((participant) => {
    if (uniqueIds.has(participant.characterId)) {
      throw new RangeError(`Duplicate combatant detected: ${participant.characterId}`);
    }

    uniqueIds.add(participant.characterId);
    if (participant.partyId !== null && !uniquePartyIds.has(participant.partyId)) {
      throw new RangeError(
        `Combatant ${participant.displayName} was assigned to an unknown party.`
      );
    }

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
      partyId: participant.partyId,
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
    parties: [...parties],
    participants: resolvedParticipants,
    createdAt: new Date().toISOString(),
  };
}

export function buildCharacterEncounterSnapshot(sheet: CharacterDraft): CharacterEncounterSnapshot {
  const derived = buildCharacterDerivedValues(sheet);
  const currentStats = derived.currentStats;

  const combatSummary: EncounterCombatSummaryField[] = [
    {
      id: "hp",
      label: "HP",
      value: `${sheet.currentHp} / ${derived.maxHp}`,
      selectableValue: null,
    },
    {
      id: "mana",
      label: "Mana",
      value: `${derived.currentMana} / ${derived.maxMana}`,
      selectableValue: null,
    },
    {
      id: "initiative",
      label: "Initiative",
      value: derived.initiative,
      selectableValue: derived.initiative,
    },
    {
      id: "ac",
      label: "AC",
      value: derived.armorClass,
      selectableValue: null,
    },
    {
      id: "dr",
      label: "DR",
      value: derived.damageReduction,
      selectableValue: null,
    },
    {
      id: "soak",
      label: "Soak",
      value: derived.soak,
      selectableValue: null,
    },
    {
      id: "melee_attack",
      label: "Melee Attack",
      value: derived.meleeAttack,
      selectableValue: derived.meleeAttack,
    },
    {
      id: "ranged_attack",
      label: "Ranged Attack",
      value: derived.rangedAttack,
      selectableValue: derived.rangedAttack,
    },
    {
      id: "melee_damage",
      label: "Melee Damage",
      value: derived.meleeDamage,
      selectableValue: derived.meleeDamage,
    },
    {
      id: "ranged_damage",
      label: "Ranged Damage",
      value: derived.rangedDamage,
      selectableValue: null,
    },
    {
      id: "movement",
      label: "Movement",
      value: derived.movement,
      selectableValue: derived.movementSelectable,
    },
  ];

  const stats: EncounterBreakdownField[] = STAT_IDS.map((statId) => ({
    id: statId,
    label: statId,
    value: currentStats[statId],
    summary: getStatBreakdown(sheet, statId).summary,
    detail: getStatBreakdown(sheet, statId).detail,
  }));

  const highlightedSkills: EncounterBreakdownField[] = HIGHLIGHTED_SKILL_IDS.map((skillId) => {
    const breakdown = getSkillBreakdown(sheet, skillId);
    const skill = sheet.skills.find((entry) => entry.id === skillId);
    return {
      id: skillId,
      label: skill?.label ?? skillId,
      value: breakdown.value,
      summary: breakdown.summary,
      detail: breakdown.detail,
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
    activePowerEffects: derived.activePowerEffects.map((effect) => ({
      id: effect.id,
      label: effect.label,
      summary: effect.summary,
      source: `${effect.casterName} -> ${effect.powerName}`,
    })),
  };
}
