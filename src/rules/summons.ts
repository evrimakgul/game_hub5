import rawPowerData from "../../json_refs/powers.json" with { type: "json" };

import {
  PLAYER_CHARACTER_TEMPLATE,
  type CharacterDraft,
  type PowerEntry,
} from "../config/characterTemplate.ts";
import { getCurrentStatValue } from "../config/characterRuntime.ts";
import { createTimestampedId } from "../lib/ids.ts";
import { calculateMaxHP } from "../rules/stats.ts";
import type { ActivePowerEffect } from "../types/activePowerEffects.ts";
import type { CharacterRecord, StatId } from "../types/character.ts";
import type {
  CombatEncounterParticipant,
  EncounterTransientCombatant,
} from "../types/combatEncounter.ts";
import { getRuntimePowerLevelDefinition } from "./powerData.ts";
import type { DamageTypeId, ResistanceLevel } from "./resistances.ts";

export type RuntimeSummonOption = {
  id: string;
  templateId: string;
  quantity: number;
  manaCost: number;
  label: string;
};

type RuntimeSummonBuildRequest = {
  casterCharacter: CharacterRecord;
  casterParticipant: CombatEncounterParticipant;
  power: PowerEntry;
  selectedSummonOptionId: string;
  activeTransientCombatants: EncounterTransientCombatant[];
};

type RuntimeTemplateAttack = {
  hitBonus: number;
  damageBonus: number;
  attacksPerAction: number;
  damageTypes: DamageTypeId[];
};

type RuntimeTemplateRules = {
  label: string;
  buffRules: EncounterTransientCombatant["buffRules"];
  statusTags: CharacterDraft["statusTags"];
  stats: Partial<Record<StatId, number>>;
  naturalDamageReduction: number;
  meleeSkill: number;
  attack: RuntimeTemplateAttack | null;
  resistances: Partial<Record<DamageTypeId, ResistanceLevel>>;
};

type RuntimePowerRecord = {
  id: string;
  summon_templates?: Record<string, unknown>;
};

type RuntimePowerData = {
  powers?: RuntimePowerRecord[];
};

const runtimePowerData = rawPowerData as RuntimePowerData;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function humanizeTemplateId(templateId: string): string {
  return templateId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSummonStatusTags(powerId: string, templateId: string): CharacterDraft["statusTags"] {
  if (powerId === "necromancy") {
    return [{ id: "undead", label: "Undead" }];
  }

  if (
    powerId === "shadow_control" &&
    (templateId === "shadow_soldier" || templateId === "shadow_fighter")
  ) {
    return [{ id: "shadow", label: "Shadow" }];
  }

  return [];
}

function buildSpecialSummonOptions(power: PowerEntry): RuntimeSummonOption[] {
  if (power.id === "necromancy") {
    const options: RuntimeSummonOption[] = [
      {
        id: "non_living_skeleton:1:2",
        templateId: "non_living_skeleton",
        quantity: 1,
        manaCost: 2,
        label: "Non-Living Skeleton (2 Mana)",
      },
    ];

    if (power.level >= 2) {
      options.push({
        id: "non_living_zombie:1:3",
        templateId: "non_living_zombie",
        quantity: 1,
        manaCost: 3,
        label: "Non-Living Zombie (3 Mana)",
      });
    }

    if (power.level >= 4) {
      options.push({
        id: "non_living_skeleton_king:1:4",
        templateId: "non_living_skeleton_king",
        quantity: 1,
        manaCost: 4,
        label: "Non-Living Skeleton King (4 Mana)",
      });
    }

    return options;
  }

  if (power.id === "shadow_control" && power.level >= 5) {
    return [
      {
        id: "shadow_fighter:1:4",
        templateId: "shadow_fighter",
        quantity: 1,
        manaCost: 4,
        label: "Shadow Fighter (4 Mana)",
      },
    ];
  }

  return [];
}

function resolveFormulaValue(
  value: unknown,
  casterSheet: CharacterDraft,
  fallback: number
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (!isRecord(value)) {
    return fallback;
  }

  const base = asNumber(value.base);
  const baseStat = typeof value.base_stat === "string" ? (value.base_stat as StatId) : null;
  const divisor = asNumber(value.base_stat_divisor);
  const round = typeof value.base_stat_round === "string" ? value.base_stat_round : null;
  const statValue = baseStat ? getCurrentStatValue(casterSheet, baseStat) : 0;
  const dividedValue =
    divisor > 0
      ? round === "up"
        ? Math.ceil(statValue / divisor)
        : round === "down"
          ? Math.floor(statValue / divisor)
          : statValue / divisor
      : statValue;

  return Math.trunc(base + dividedValue);
}

function getRawPowerRecord(powerId: string): RuntimePowerRecord | null {
  return runtimePowerData.powers?.find((entry) => entry.id === powerId) ?? null;
}

function readSummonOptions(power: PowerEntry): RuntimeSummonOption[] {
  const specialOptions = buildSpecialSummonOptions(power);
  if (specialOptions.length > 0) {
    return specialOptions;
  }

  const runtimeLevel = getRuntimePowerLevelDefinition(power.id, power.level);
  const summoning =
    runtimeLevel?.mechanics?.summoning && typeof runtimeLevel.mechanics.summoning === "object"
      ? (runtimeLevel.mechanics.summoning as Record<string, unknown>)
      : null;
  const options = Array.isArray(summoning?.options) ? summoning.options : [];
  const defaultManaCost = Math.max(0, Math.trunc(asNumber(runtimeLevel?.mana_cost)));

  return options.flatMap((option) => {
    if (!isRecord(option)) {
      return [];
    }

    const templateId =
      typeof option.template_id === "string" && option.template_id.length > 0
        ? option.template_id
        : null;
    if (!templateId) {
      return [];
    }

    const quantity = Math.max(1, Math.trunc(asNumber(option.quantity) || 1));
    const manaCost = Math.max(
      0,
      Math.trunc(
        option.mana_cost === undefined ? defaultManaCost : asNumber(option.mana_cost)
      )
    );
    const labelPrefix = quantity > 1 ? `${quantity}x ` : "";

    return [
      {
        id: `${templateId}:${quantity}:${manaCost}`,
        templateId,
        quantity,
        manaCost,
        label: `${labelPrefix}${humanizeTemplateId(templateId)}${
          manaCost > 0 ? ` (${manaCost} Mana)` : ""
        }`,
      },
    ];
  });
}

export function getSummonOptionList(power: PowerEntry): RuntimeSummonOption[] {
  return readSummonOptions(power);
}

function readTemplateRules(
  powerId: string,
  powerLevel: number,
  templateId: string,
  casterSheet: CharacterDraft
): RuntimeTemplateRules | null {
  if (powerId === "necromancy") {
    const necromancyLevel = powerLevel;
    const appValue = getCurrentStatValue(casterSheet, "APP");
    const halfNecromancy = Math.ceil(necromancyLevel / 2);
    const halfAppearance = Math.ceil(appValue / 2);

    if (templateId === "non_living_skeleton") {
      const statValue = halfNecromancy + halfAppearance;
      return {
        label: "Non-Living Skeleton",
        buffRules: {
          canReceiveSingleBuffs: false,
          canReceiveGroupBuffs: false,
          canBeHealed: false,
        },
        statusTags: buildSummonStatusTags(powerId, templateId),
        stats: {
          STR: statValue,
          DEX: statValue,
          STAM: statValue,
          CHA: 0,
          APP: 0,
          MAN: 0,
          INT: 0,
          WITS: 0,
          PER: 0,
        },
        naturalDamageReduction: halfNecromancy + 1,
        meleeSkill: 2 + halfNecromancy,
        attack: {
          hitBonus: 3,
          damageBonus: 2,
          attacksPerAction: 1,
          damageTypes: ["physical"],
        },
        resistances: {
          mental: 2,
          shadow: 2,
          fire: 1,
          cold: 1,
          acid: -1,
        },
      };
    }

    if (templateId === "non_living_skeleton_king") {
      const statValue = Math.ceil((3 * necromancyLevel) / 2) + halfAppearance;
      return {
        label: "Non-Living Skeleton King",
        buffRules: {
          canReceiveSingleBuffs: false,
          canReceiveGroupBuffs: false,
          canBeHealed: false,
        },
        statusTags: buildSummonStatusTags(powerId, templateId),
        stats: {
          STR: statValue,
          DEX: statValue,
          STAM: statValue,
          CHA: 0,
          APP: 0,
          MAN: 0,
          INT: 0,
          WITS: 0,
          PER: 0,
        },
        naturalDamageReduction: necromancyLevel + halfAppearance,
        meleeSkill: 3 + halfNecromancy,
        attack: {
          hitBonus: 2 * necromancyLevel,
          damageBonus: necromancyLevel,
          attacksPerAction: 1,
          damageTypes: ["physical"],
        },
        resistances: {
          mental: 2,
          shadow: 2,
          fire: 1,
          cold: 1,
          acid: -1,
        },
      };
    }

    if (templateId === "non_living_zombie") {
      return {
        label: "Non-Living Zombie",
        buffRules: {
          canReceiveSingleBuffs: true,
          canReceiveGroupBuffs: true,
          canBeHealed: true,
        },
        statusTags: buildSummonStatusTags(powerId, templateId),
        stats: {
          STR: necromancyLevel + appValue,
          DEX: necromancyLevel + halfAppearance,
          STAM: necromancyLevel + appValue,
          CHA: 0,
          APP: 0,
          MAN: 0,
          INT: 0,
          WITS: 0,
          PER: 0,
        },
        naturalDamageReduction: necromancyLevel + 3,
        meleeSkill: 3 + halfNecromancy,
        attack: {
          hitBonus: necromancyLevel,
          damageBonus: necromancyLevel,
          attacksPerAction: 1,
          damageTypes: ["physical"],
        },
        resistances: {
          mental: 2,
          shadow: 2,
          fire: 1,
          cold: 1,
          acid: -1,
        },
      };
    }
  }

  if (powerId === "shadow_control" && templateId === "shadow_fighter") {
    const shadowLevel = powerLevel;
    const manValue = getCurrentStatValue(casterSheet, "MAN");
    const statValue = shadowLevel + manValue;

    return {
      label: "Shadow Fighter",
      buffRules: {
        canReceiveSingleBuffs: true,
        canReceiveGroupBuffs: true,
        canBeHealed: false,
      },
      statusTags: buildSummonStatusTags(powerId, templateId),
      stats: {
        STR: statValue,
        DEX: statValue,
        STAM: statValue,
        CHA: 0,
        APP: 0,
        MAN: 0,
        INT: 0,
        WITS: 0,
        PER: 0,
      },
      naturalDamageReduction: 6,
      meleeSkill: 5,
      attack: {
        hitBonus: 2,
        damageBonus: 2,
        attacksPerAction: 1,
        damageTypes: ["physical", "shadow"],
      },
      resistances: {
        shadow: 2,
        cold: 2,
        physical: 1,
        radiant: -1,
      },
    };
  }

  const runtimeLevel = getRuntimePowerLevelDefinition(powerId, powerLevel);
  if (!runtimeLevel) {
    return null;
  }

  const rawPowerRecord = getRawPowerRecord(powerId);
  const summonTemplates =
    rawPowerRecord && isRecord(rawPowerRecord.summon_templates)
      ? rawPowerRecord.summon_templates
      : null;
  const template =
    summonTemplates && isRecord(summonTemplates[templateId]) ? summonTemplates[templateId] : null;
  if (!template) {
    return null;
  }

  const statsRecord = isRecord(template.stats) ? template.stats : {};
  const combatSummary = isRecord(template.combat_summary) ? template.combat_summary : {};
  const defenses = isRecord(template.defenses) ? template.defenses : {};
  const resistanceLevels = isRecord(defenses.resistance_levels) ? defenses.resistance_levels : {};
  const attacks = Array.isArray(template.attacks) ? template.attacks : [];
  const firstAttack =
    attacks.find((attack): attack is Record<string, unknown> => isRecord(attack)) ?? null;
  const attackPool = firstAttack && isRecord(firstAttack.attack_pool) ? firstAttack.attack_pool : {};
  const damageValue =
    firstAttack && isRecord(firstAttack.damage_value) ? firstAttack.damage_value : {};
  const buffRules = isRecord(template.buff_rules) ? template.buff_rules : {};
  const summoning =
    runtimeLevel.mechanics?.summoning && typeof runtimeLevel.mechanics.summoning === "object"
      ? (runtimeLevel.mechanics.summoning as Record<string, unknown>)
      : {};

  const stats: Partial<Record<StatId, number>> = {
    STR: resolveFormulaValue(statsRecord.STR, casterSheet, 0),
    DEX: resolveFormulaValue(statsRecord.DEX, casterSheet, 0),
    STAM: resolveFormulaValue(statsRecord.STAM, casterSheet, 0),
    CHA: resolveFormulaValue(statsRecord.CHA, casterSheet, 0),
    APP: resolveFormulaValue(statsRecord.APP, casterSheet, 0),
    MAN: resolveFormulaValue(statsRecord.MAN, casterSheet, 0),
    INT: resolveFormulaValue(statsRecord.INT, casterSheet, 0),
    WITS: resolveFormulaValue(statsRecord.WITS, casterSheet, 0),
    PER: resolveFormulaValue(statsRecord.PER, casterSheet, 0),
  };

  const meleeSkillOverride = asNumber(summoning.melee_skill_override);
  const meleeSkill = meleeSkillOverride || asNumber(combatSummary.melee_skill);
  const attackBonus = asNumber(summoning.attack_bonus) + asNumber(attackPool.flat_bonus);
  const damageBonus = asNumber(summoning.damage_bonus) + asNumber(damageValue.flat_bonus);

  return {
    label: humanizeTemplateId(templateId),
    buffRules: {
      canReceiveSingleBuffs: buffRules.can_receive_single_buffs !== false,
      canReceiveGroupBuffs: buffRules.can_receive_group_buffs !== false,
      canBeHealed: buffRules.can_be_healed !== false,
    },
    statusTags: buildSummonStatusTags(powerId, templateId),
    stats,
    naturalDamageReduction: asNumber(combatSummary.natural_damage_reduction),
    meleeSkill,
    attack:
      firstAttack !== null
        ? {
            hitBonus: attackBonus,
            damageBonus,
            attacksPerAction: Math.max(
              1,
              Math.trunc(asNumber(firstAttack.attacks_per_action) || 1)
            ),
            damageTypes: Array.isArray(firstAttack.damage_types)
              ? firstAttack.damage_types.filter(
                  (damageType): damageType is DamageTypeId => typeof damageType === "string"
                )
              : ["physical"],
          }
        : null,
    resistances: Object.fromEntries(
      Object.entries(resistanceLevels).flatMap(([damageTypeId, level]) => {
        if (typeof level !== "number" || !Number.isFinite(level)) {
          return [];
        }

        return [[damageTypeId, Math.max(-2, Math.min(2, Math.trunc(level)))]];
      })
    ) as Partial<Record<DamageTypeId, ResistanceLevel>>,
  };
}

function buildSummonBaseEffect(
  summonId: string,
  power: PowerEntry,
  templateRules: RuntimeTemplateRules,
  casterName: string,
  casterCharacterId: string
): ActivePowerEffect[] {
  const modifiers = [];

  if (templateRules.naturalDamageReduction > 0) {
    modifiers.push({
      targetType: "derived" as const,
      targetId: "damage_reduction",
      value: templateRules.naturalDamageReduction,
      sourceLabel: `${power.name} Summon`,
    });
  }

  if (templateRules.attack && templateRules.attack.hitBonus > 0) {
    modifiers.push({
      targetType: "derived" as const,
      targetId: "melee_attack",
      value: templateRules.attack.hitBonus,
      sourceLabel: `${power.name} Summon`,
    });
  }

  if (templateRules.attack && templateRules.attack.damageBonus > 0) {
    modifiers.push({
      targetType: "derived" as const,
      targetId: "melee_damage",
      value: templateRules.attack.damageBonus,
      sourceLabel: `${power.name} Summon`,
    });
  }

  if (modifiers.length === 0) {
    return [];
  }

  const extraSummary =
    templateRules.attack && templateRules.attack.attacksPerAction > 1
      ? `, ${templateRules.attack.attacksPerAction} attacks`
      : "";
  const damageTypeSummary =
    templateRules.attack && templateRules.attack.damageTypes.length > 0
      ? `, ${templateRules.attack.damageTypes.join(" / ")}`
      : "";

  return [
    {
      id: createTimestampedId("summon-effect"),
      stackKey: `summon:${summonId}`,
      effectKind: "direct",
      powerId: power.id,
      powerName: `${power.name} Summon`,
      sourceLevel: power.level,
      casterCharacterId,
      casterName,
      targetCharacterId: summonId,
      sourceEffectId: null,
      shareMode: null,
      sharedTargetCharacterIds: null,
      label: `${templateRules.label} Base Rules`,
      summary: `DR ${templateRules.naturalDamageReduction}, +${
        templateRules.attack?.hitBonus ?? 0
      } hit, +${templateRules.attack?.damageBonus ?? 0} dmg${extraSummary}${damageTypeSummary}`,
      actionType: null,
      manaCost: null,
      selectedStatId: null,
      modifiers,
      appliedAt: new Date().toISOString(),
    },
  ];
}

function buildSummonSheet(
  summonId: string,
  power: PowerEntry,
  templateRules: RuntimeTemplateRules,
  casterCharacter: CharacterRecord,
  summonIndex: number,
  totalQuantity: number
): CharacterDraft {
  const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
  const nextName = totalQuantity > 1 ? `${templateRules.label} ${summonIndex}` : templateRules.label;

  sheet.name = nextName;
  sheet.concept = "Summon";
  sheet.faction = casterCharacter.sheet.faction;
  sheet.gameDateTime = casterCharacter.sheet.gameDateTime;
  sheet.xpEarned = 0;
  sheet.xpUsed = 0;
  sheet.inspiration = 0;
  sheet.temporaryInspiration = 0;
  sheet.currentMana = 0;
  sheet.manaInitialized = true;
  sheet.statusTags = templateRules.statusTags.map((tag) => ({ ...tag }));

  for (const statId of Object.keys(sheet.statState) as StatId[]) {
    sheet.statState[statId].base = Math.max(0, Math.trunc(templateRules.stats[statId] ?? 0));
  }

  sheet.currentHp = calculateMaxHP(sheet.statState.STAM.base);
  sheet.skills = sheet.skills.map((skill) =>
    skill.id === "melee"
      ? {
          ...skill,
          base: templateRules.meleeSkill,
        }
      : {
          ...skill,
          base: 0,
        }
  );

  for (const [damageTypeId, level] of Object.entries(templateRules.resistances) as Array<
    [DamageTypeId, ResistanceLevel]
  >) {
    sheet.resistances[damageTypeId] = level;
  }

  sheet.activePowerEffects = buildSummonBaseEffect(
    summonId,
    power,
    templateRules,
    casterCharacter.sheet.name.trim() || casterCharacter.id,
    casterCharacter.id
  );

  return sheet;
}

export function buildSummonCastResolution({
  casterCharacter,
  casterParticipant,
  power,
  selectedSummonOptionId,
  activeTransientCombatants,
}: RuntimeSummonBuildRequest):
  | { error: string }
  | {
      manaCost: number;
      summons: EncounterTransientCombatant[];
      participants: CombatEncounterParticipant[];
      dismissIds: string[];
    } {
  const summonOptions = readSummonOptions(power);
  const selectedOption =
    summonOptions.find((option) => option.id === selectedSummonOptionId) ?? null;
  if (!selectedOption) {
    return { error: "Select a summon option first." };
  }

  const templateRules = readTemplateRules(
    power.id,
    power.level,
    selectedOption.templateId,
    casterCharacter.sheet
  );
  if (!templateRules) {
    return { error: `Summon template data for ${selectedOption.templateId} is missing.` };
  }

  const dismissIds = activeTransientCombatants
    .filter(
      (entry) =>
        entry.controllerCharacterId === casterCharacter.id &&
        entry.sourcePowerId === power.id &&
        (power.id === "necromancy"
          ? entry.summonTemplateId === selectedOption.templateId
          : true)
    )
    .map((entry) => entry.id);
  const summons = Array.from({ length: selectedOption.quantity }, (_, index) => {
    const summonId = createTimestampedId(selectedOption.templateId);

    return {
      id: summonId,
      ownerRole: casterCharacter.ownerRole,
      controllerCharacterId: casterCharacter.id,
      sourcePowerId: power.id,
      sourcePowerLevel: power.level,
      summonTemplateId: selectedOption.templateId,
      buffRules: templateRules.buffRules,
      sheet: buildSummonSheet(
        summonId,
        power,
        templateRules,
        casterCharacter,
        index + 1,
        selectedOption.quantity
      ),
    };
  });

  const participants = summons.map<CombatEncounterParticipant>((summon) => ({
    characterId: summon.id,
    ownerRole: summon.ownerRole,
    displayName: summon.sheet.name,
    initiativePool: casterParticipant.initiativePool,
    initiativeFaces: [...casterParticipant.initiativeFaces],
    initiativeSuccesses: casterParticipant.initiativeSuccesses,
    dex: casterParticipant.dex,
    wits: casterParticipant.wits,
    partyId: casterParticipant.partyId,
    controllerCharacterId: casterCharacter.id,
    summonTemplateId: selectedOption.templateId,
    sourcePowerId: power.id,
  }));

  return {
    manaCost: selectedOption.manaCost,
    summons,
    participants,
    dismissIds,
  };
}
