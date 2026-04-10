import {
  createDefaultResistances,
  LIGHT_SUPPORT_LEVEL_FIVE_EXPOSE_DARKNESS_TYPES,
  type DamageTypeId,
  type ResistanceLevel,
} from "../rules/resistances.ts";
import {
  createEmptyPowerUsageState,
  normalizePowerUsageState,
} from "../lib/powerUsage.ts";
import { getRuntimePowerLevelDefinition } from "../rules/powerData.ts";
import { getRuntimePowerCantripLevels } from "../rules/powerData.ts";
import { calculateMaxHP } from "../rules/stats.ts";
import type {
  ActivePowerEffect,
  ActivePowerEffectModifier,
} from "../types/activePowerEffects";
import type { CharacterEquipmentReference } from "../types/items.ts";
import { STAT_IDS, isStatId, type CharacterOwnerRole, type StatId } from "../types/character.ts";
import type { PowerUsageState } from "../types/powerUsage.ts";
import type { KnowledgeHistoryLink } from "../types/knowledge.ts";

export type { StatId } from "../types/character.ts";

export type StatSource = {
  label: string;
  value: number;
};

export type StatEntry = {
  base: number;
  gearSources: StatSource[];
  buffSources: StatSource[];
};

export type SkillEntry = {
  id: string;
  label: string;
  base: number;
  rollStat: string;
  gearSources: StatSource[];
  buffSources: StatSource[];
};

export type PowerEntry = {
  id: string;
  name: string;
  level: number;
  governingStat: StatId;
};

export type EncounterStatusTag = {
  id: string;
  label: string;
};

export type GameHistoryNoteEntry = {
  id: string;
  type: "note";
  actualDateTime: string;
  gameDateTime: string;
  note: string;
  knowledgeLink?: KnowledgeHistoryLink | null;
};

export type IntelSnapshotField = {
  label: string;
  value: string | number;
};

export type GameHistoryIntelSnapshotEntry = {
  id: string;
  type: "intel_snapshot";
  actualDateTime: string;
  gameDateTime: string;
  sourcePower: string;
  targetCharacterId: string | null;
  targetName: string;
  summary: string;
  knowledgeLink?: KnowledgeHistoryLink | null;
  snapshot: {
    rank: string;
    cr: number;
    age: number | null;
    karma: string;
    biographyPrimary: string;
    resistances: string[];
    combatSummary: IntelSnapshotField[];
    stats: IntelSnapshotField[];
    skills: IntelSnapshotField[];
    powers: string[];
    specials: string[];
    notes: string[];
  };
};

export type GameHistoryEntry = GameHistoryNoteEntry | GameHistoryIntelSnapshotEntry;

export type DmAuditEntry = {
  id: string;
  timestamp: string;
  characterId: string;
  targetOwnerRole: CharacterOwnerRole;
  editLayer: "runtime" | "sheet" | "admin_override";
  fieldPath: string;
  beforeValue: string;
  afterValue: string;
  reason: string;
  sourceScreen: string;
};

export type CharacterDraft = {
  name: string;
  concept: string;
  faction: string;
  age: number | null;
  gameDateTime: string;
  biographyPrimary: string;
  biographySecondary: string;
  xpEarned: number;
  xpUsed: number;
  money: number;
  inspiration: number;
  temporaryInspiration: number;
  awarenessInsightGranted: boolean;
  positiveKarma: number;
  negativeKarma: number;
  currentHp: number;
  temporaryHp: number;
  currentMana: number;
  manaInitialized: boolean;
  resistances: Record<DamageTypeId, ResistanceLevel>;
  statState: Record<StatId, StatEntry>;
  skills: SkillEntry[];
  powers: PowerEntry[];
  activePowerEffects: ActivePowerEffect[];
  powerUsageState: PowerUsageState;
  ownedItemIds: string[];
  inventoryItemIds: string[];
  activeItemIds: string[];
  equipment: CharacterEquipmentReference[];
  gameHistory: GameHistoryEntry[];
  statusTags: EncounterStatusTag[];
  effects: string[];
  dmAuditLog: DmAuditEntry[];
};

export type PowerTemplate = {
  id: string;
  name: string;
  governingStat: StatId;
  levelBenefits: Record<number, string[]>;
};

export type PowerBenefitSection = {
  title: string;
  bullets: string[];
};

export const CHARACTER_DRAFT_SCHEMA_VERSION = 6;

const BLANK_STAT_ENTRY = (): StatEntry => ({
  base: 2,
  gearSources: [],
  buffSources: [],
});

const BLANK_SKILLS: SkillEntry[] = [
  { id: "melee", label: "Melee", base: 0, rollStat: "DEX", gearSources: [], buffSources: [] },
  {
    id: "ranged",
    label: "Ranged",
    base: 0,
    rollStat: "DEX + floor((PER - 1) / 2)",
    gearSources: [],
    buffSources: [],
  },
  { id: "athletics", label: "Athletics", base: 0, rollStat: "DEX", gearSources: [], buffSources: [] },
  { id: "stealth", label: "Stealth", base: 0, rollStat: "DEX", gearSources: [], buffSources: [] },
  { id: "alertness", label: "Alertness", base: 0, rollStat: "PER", gearSources: [], buffSources: [] },
  { id: "intimidation", label: "Intimidation", base: 0, rollStat: "CHA", gearSources: [], buffSources: [] },
  { id: "social", label: "Social", base: 0, rollStat: "CHA / MAN / APP", gearSources: [], buffSources: [] },
  { id: "medicine", label: "Medicine", base: 0, rollStat: "INT", gearSources: [], buffSources: [] },
  { id: "technology", label: "Technology", base: 0, rollStat: "INT", gearSources: [], buffSources: [] },
  { id: "academics", label: "Academics", base: 0, rollStat: "INT", gearSources: [], buffSources: [] },
  { id: "mechanics", label: "Mechanics", base: 0, rollStat: "DEX", gearSources: [], buffSources: [] },
  { id: "occultism", label: "Occultism", base: 0, rollStat: "INT", gearSources: [], buffSources: [] },
];

export const statGroups = [
  { title: "Physical", ids: ["STR", "DEX", "STAM"] as const, accent: "physical" },
  { title: "Social", ids: ["CHA", "APP", "MAN"] as const, accent: "social" },
  { title: "Mental", ids: ["INT", "WITS", "PER"] as const, accent: "mental" },
];

export const powerLibrary: PowerTemplate[] = [
  {
    id: "awareness",
    name: "Awareness",
    governingStat: "PER",
    levelBenefits: {
      1: [
        "AS: alertness gains Awareness level",
        "AI: +1 temporary inspiration per session",
        "AC: stats/skills up to CR min(PER + 1, 6)",
        "AA: common to masterwork items",
      ],
      2: [
        "AC: also reveals powers and specials up to CR min(PER + 2, 9)",
        "AA: rare or lesser items",
      ],
      3: [
        "AC: ignore techno-infused invisibility up to CR min(PER + 3, 12)",
        "AA: epic or lesser items",
      ],
      4: [
        "AC: CR min(PER + 4, 15)",
        "AA: legendary or lesser items",
      ],
      5: [
        "AC: CR min(PER + 5, 18), may share results with party",
        "AA: demonic, celestial, mythical, or lesser items",
      ],
    },
  },
  {
    id: "body_reinforcement",
    name: "Body Reinforcement",
    governingStat: "STAM",
    levelBenefits: {
      1: ["Increase one physical stat by +1", "Standard action, 2 Mana"],
      2: ["Increase one touched target physical stat by +1", "Cantrip: self-revive with 1 HP once per day"],
      3: ["Increase one physical stat by +2", "Standard action, 3 Mana"],
      4: ["Increase one physical stat by +2", "Also grants +1 DR"],
      5: ["Increase one physical stat by +3", "Also grants +2 DR"],
    },
  },
  {
    id: "crowd_control",
    name: "Crowd Control",
    governingStat: "CHA",
    levelBenefits: {
      1: ["Paralyze one living target", "Maintenance cost: 1 Mana per turn"],
      2: ["Issue simple commands", "Orders cost a bonus action"],
      3: ["Control two targets", "Others dealing damage no longer breaks control"],
      4: ["Control is a bonus action", "Commands become free"],
      5: ["Control three targets", "Can affect non-living targets except other summons"],
    },
  },
  {
    id: "elementalist",
    name: "Elementalist",
    governingStat: "INT",
    levelBenefits: {
      1: ["Elemental bolt damage: INT + 1", "One target, 1 Mana"],
      2: ["Elemental bolt damage: INT + 2", "Can split between two targets"],
      3: ["Elemental bolt damage: INT + 3", "Switch between fire, cold, lightning, acid"],
      4: ["Elemental bolt damage: INT + 4", "Can affect three targets"],
      5: ["Elemental bolt damage: INT + 5", "Necrotic option unlocked"],
    },
  },
  {
    id: "healing",
    name: "Healing",
    governingStat: "INT",
    levelBenefits: {
      1: ["Heal INT + 1", "Removes bleeding"],
      2: ["Heal INT + 2", "Can spread across allies in range"],
      3: ["Heal INT + 3", "Removes poison, disease, curse"],
      4: ["Heal INT + 4", "Can regrow missing limbs"],
      5: ["Heal INT + 5", "Advanced restoration"],
    },
  },
  {
    id: "light_support",
    name: "Light Support",
    governingStat: "APP",
    levelBenefits: {
      1: ["Light Aura bonus: +1 Hit - 10 minutes - 25 meters", "Cantrip: Nightvision, +1 Mana"],
      2: ["Light Aura bonus: +2 Hit, +1 DR - 30 minutes - 50 meters", "Hostile targets cannot see it"],
      3: ["Light Aura bonus: +3 Hit, +1 DR, +1 Soak - 1 Hour - 50 meters", "Cantrip: Nightvision, +2 Mana"],
      4: ["Light Aura bonus: +3 Hit, +2 DR, +1 Soak - 3 Hours - 100 meters", "One mana restore use per long rest"],
      5: ["Light Aura bonus: +4 Hit, +2 DR, +2 Soak - 8 Hours - 100 meters", "Expose darkness while concentrating"],
    },
  },
  {
    id: "necromancy",
    name: "Necromancy",
    governingStat: "APP",
    levelBenefits: {
      1: ["Summon one simple skeleton", "10 minutes or portal duration"],
      2: ["Summon two simple skeletons or one skeleton king", "Cantrip: undead aggro drops"],
      3: ["Necrotic Touch unlocked (3 Mana)", "Summons retained"],
      4: ["Zombie unlocked (4 Mana)", "Summons gain +2 attack and damage"],
      5: ["Summons gain +5 attack and damage", "Resurrection unlocked (6 Mana)"],
    },
  },
  {
    id: "shadow_control",
    name: "Shadow Control",
    governingStat: "MAN",
    levelBenefits: {
      1: ["Cloak of shadow: +1 stealth, +1 intimidation, +1 AC"],
      2: ["Shadow Walk unlocked", "Cloak bonuses improve"],
      3: ["Shadow Manipulation unlocked", "Cloak bonuses improve"],
      4: ["Cloak can cover allies", "Shared shadow protection"],
      5: ["Summon Shadow Soldier", "Cloak reaches strongest form"],
    },
  },
];

export class CharacterSheetTemplate {
  createInstance(): CharacterDraft {
    return {
      name: "",
      concept: "",
      faction: "",
      age: null,
      gameDateTime: "17.09.2124 - 08:00",
      biographyPrimary: "",
      biographySecondary: "",
      xpEarned: 79,
      xpUsed: 0,
      money: 0,
      inspiration: 0,
      temporaryInspiration: 0,
      awarenessInsightGranted: false,
      positiveKarma: 0,
      negativeKarma: 0,
      currentHp: calculateMaxHP(2),
      temporaryHp: 0,
      currentMana: 0,
      manaInitialized: false,
      resistances: createDefaultResistances(),
      statState: {
        STR: BLANK_STAT_ENTRY(),
        DEX: BLANK_STAT_ENTRY(),
        STAM: BLANK_STAT_ENTRY(),
        CHA: BLANK_STAT_ENTRY(),
        APP: BLANK_STAT_ENTRY(),
        MAN: BLANK_STAT_ENTRY(),
        INT: BLANK_STAT_ENTRY(),
        WITS: BLANK_STAT_ENTRY(),
        PER: BLANK_STAT_ENTRY(),
      },
      skills: BLANK_SKILLS.map((skill) => ({ ...skill, gearSources: [], buffSources: [] })),
      powers: [],
      activePowerEffects: [],
      powerUsageState: createEmptyPowerUsageState(),
      ownedItemIds: [],
      inventoryItemIds: [],
      activeItemIds: [],
      equipment: [],
      gameHistory: [],
      statusTags: [],
      effects: [],
      dmAuditLog: [],
    };
  }
}

export const PLAYER_CHARACTER_TEMPLATE = new CharacterSheetTemplate();

export function normalizeCharacterDraft(sheet: CharacterDraft): CharacterDraft {
  const normalizedUsageState = normalizePowerUsageState(sheet.powerUsageState);
  const normalizedOwnedItemIds = [...new Set((sheet.ownedItemIds ?? []).filter((entry) => entry.trim().length > 0))];
  const normalizedInventoryItemIds = [...new Set((sheet.inventoryItemIds ?? []).filter((entry) => entry.trim().length > 0))];
  const normalizedActiveItemIds = [...new Set((sheet.activeItemIds ?? []).filter((entry) => entry.trim().length > 0))];
  const normalizedEquipment = (sheet.equipment ?? []).map((entry) => ({
    slot: entry.slot,
    itemId: entry.itemId && entry.itemId.trim().length > 0 ? entry.itemId : null,
  }));
  const hasAwareness = sheet.powers.some((power) => power.id === "awareness" && power.level > 0);

  if (hasAwareness && !sheet.awarenessInsightGranted) {
    return {
      ...sheet,
      powerUsageState: normalizedUsageState,
      ownedItemIds: normalizedOwnedItemIds,
      inventoryItemIds: normalizedInventoryItemIds,
      activeItemIds: normalizedActiveItemIds,
      equipment: normalizedEquipment,
      temporaryInspiration: sheet.temporaryInspiration + 1,
      awarenessInsightGranted: true,
    };
  }

  if (!hasAwareness && sheet.awarenessInsightGranted) {
    return {
      ...sheet,
      powerUsageState: normalizedUsageState,
      ownedItemIds: normalizedOwnedItemIds,
      inventoryItemIds: normalizedInventoryItemIds,
      activeItemIds: normalizedActiveItemIds,
      equipment: normalizedEquipment,
      temporaryInspiration: Math.max(0, sheet.temporaryInspiration - 1),
      awarenessInsightGranted: false,
    };
  }

  return {
    ...sheet,
    powerUsageState: normalizedUsageState,
    ownedItemIds: normalizedOwnedItemIds,
    inventoryItemIds: normalizedInventoryItemIds,
    activeItemIds: normalizedActiveItemIds,
    equipment: normalizedEquipment,
  };
}

export function getPowerTemplate(powerId: string): PowerTemplate | undefined {
  return powerLibrary.find((power) => power.id === powerId);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getLatestCantripLevel(powerId: string, currentLevel: number): Record<string, unknown> | null {
  const latestEntry = getRuntimePowerCantripLevels(powerId)
    .filter((entry) => entry.power_level <= currentLevel)
    .at(-1);

  return asRecord(latestEntry?.mechanics);
}

function joinList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function getAwarenessSections(level: number): PowerBenefitSection[] {
  const levelDefinition = getRuntimePowerLevelDefinition("awareness", level);
  const mechanics = asRecord(levelDefinition?.mechanics);
  const assessCharacter = asRecord(mechanics?.assess_character);
  const crLimitFormula = asRecord(assessCharacter?.cr_limit_formula);
  const artifactAppraisalSummaryByLevel: Record<number, string> = {
    1: "Identifies masterwork or lesser items.",
    2: "Identifies rare or lesser items.",
    3: "Identifies epic or lesser items.",
    4: "Identifies legendary or lesser items.",
    5: "Identifies demonic, celestial, mythical, or lesser items.",
  };

  return [
    {
      title: "Alerted Self",
      bullets: ["Alertness skill bonus equals Awareness level."],
    },
    {
      title: "Awakened Insight",
      bullets: ["Gain +1 temporary inspiration per session."],
    },
    {
      title: "Assess Character",
      bullets: [
        level >= 2 ? "Reveal stats, skills, powers, and specials." : "Reveal stats and skills.",
        `Allowed CR equals min(PER + ${asNumber(crLimitFormula?.flat_bonus) ?? level}, ${asNumber(assessCharacter?.cr_cap) ?? 0}).`,
        ...(level >= 3 ? ["Ignores techno-infused invisibility."] : []),
        ...(level >= 5 ? ["May share results with the party."] : []),
      ],
    },
    {
      title: "Artifact Appraisal",
      bullets: [artifactAppraisalSummaryByLevel[level] ?? "Item appraisal details pending."],
    },
  ];
}

function getBodyReinforcementSections(level: number): PowerBenefitSection[] {
  const levelDefinition = getRuntimePowerLevelDefinition("body_reinforcement", level);
  const mechanics = asRecord(levelDefinition?.mechanics);

  return [
    {
      title: "Boost Physique",
      bullets: [
        `Increase one physical stat by +${asNumber(mechanics?.stat_bonus) ?? 0}.`,
        ...(level >= 4
          ? [`Also grants +${asNumber(mechanics?.damage_reduction_bonus) ?? 0} DR.`]
          : []),
        ...(level >= 2 ? ["Can target one friendly character by touch."] : []),
      ],
    },
    ...(level >= 2
      ? [
          {
            title: "Brute Defiance",
            bullets: ["Revive HP by level is 1, 2, 4, 8, 16."],
          },
        ]
      : []),
  ];
}

function getCrowdControlSections(level: number): PowerBenefitSection[] {
  const levelDefinition = getRuntimePowerLevelDefinition("crowd_control", level);
  const mechanics = asRecord(levelDefinition?.mechanics);
  const allowedTargetTypes = (Array.isArray(mechanics?.allowed_target_types)
    ? mechanics?.allowed_target_types.filter((entry): entry is string => typeof entry === "string")
    : []) ?? [];
  const cantripMechanics = getLatestCantripLevel("crowd_control", level);
  const socialBonus = asNumber(cantripMechanics?.social_skill_bonus);
  const intimidationBonus = asNumber(cantripMechanics?.intimidation_skill_bonus);
  const mechanicsBonus = asNumber(cantripMechanics?.mechanics_skill_bonus);
  const technologyBonus = asNumber(cantripMechanics?.technology_skill_bonus);

  return [
    {
      title: "Control Entity",
      bullets: [
        `Control up to ${asNumber(mechanics?.max_controlled_targets) ?? 1} target(s) at once.`,
        allowedTargetTypes.includes("non_living_except_other_occult_summons")
          ? "Can affect living and non-living targets except other occult summons."
          : "Affects living targets.",
        ...(level >= 2
          ? [
              asString(mechanics?.command_action_type) === "free"
                ? "Issue commands for free."
                : "Issue commands as a bonus action.",
            ]
          : []),
        ...((asBoolean(mechanics?.breaks_on_damage_from_caster) === false &&
        asBoolean(mechanics?.breaks_on_damage_from_others) === false)
          ? ["Damage no longer breaks control."]
          : asBoolean(mechanics?.breaks_on_damage_from_others) === false
            ? ["Damage from others no longer breaks control."]
            : []),
      ],
    },
    ...(level >= 2
      ? [
          {
            title: "Cantrip",
            bullets: [
              ...(socialBonus !== null && intimidationBonus !== null
                ? [`Gain +${socialBonus} Social and +${intimidationBonus} Intimidation.`]
                : []),
              ...(mechanicsBonus !== null &&
              technologyBonus !== null &&
              (mechanicsBonus > 0 || technologyBonus > 0)
                ? [`Also gain +${mechanicsBonus} Mechanics and +${technologyBonus} Technology.`]
                : []),
            ],
          },
        ]
      : []),
  ];
}

function getElementalistSections(level: number): PowerBenefitSection[] {
  const levelDefinition = getRuntimePowerLevelDefinition("elementalist", level);
  const mechanics = asRecord(levelDefinition?.mechanics);
  const damage = asRecord(mechanics?.damage);
  const damageTypes = (Array.isArray(damage?.damage_types)
    ? damage?.damage_types.filter((entry): entry is string => typeof entry === "string")
    : []) ?? [];

  return [
    {
      title: "Elemental Bolt",
      bullets: [
        `Deal INT + ${asNumber(damage?.flat_bonus) ?? 0} damage.`,
        `Can affect up to ${asNumber(damage?.max_targets) ?? 1} target(s).`,
        ...(damageTypes.length > 0
          ? [`Available damage types: ${joinList(damageTypes)}.`]
          : ["Available damage type: fire."]),
      ],
    },
  ];
}

function getHealingSections(level: number): PowerBenefitSection[] {
  const levelDefinition = getRuntimePowerLevelDefinition("healing", level);
  const mechanics = asRecord(levelDefinition?.mechanics);
  const healing = asRecord(mechanics?.healing);

  return [
    {
      title: "Heal Living",
      bullets: [
        `Heal INT + ${asNumber(healing?.flat_bonus) ?? level}.`,
        ...(level >= 2 ? ["May spread the healing across up to 4 targets within 25m."] : []),
        "Removes bleeding.",
        ...(level >= 4 ? ["Can regrow missing limbs."] : []),
        ...(level >= 5 ? ["Can overheal once per character per day up to target STAM."] : []),
        "Against undead, healing becomes radiant damage.",
      ],
    },
    ...(level >= 3
      ? [
          {
            title: "Holy Purge",
            bullets: ["Cures poison, disease, and curse."],
          },
          {
            title: "Healing Touch",
            bullets: [
              "Heals half of Heal Living, rounded up.",
              "Stops bleeding.",
              "A target can receive it at most twice per day.",
              "Against undead, healing becomes radiant damage.",
            ],
          },
        ]
      : []),
  ];
}

function getLightSupportSections(level: number): PowerBenefitSection[] {
  const levelDefinition = getRuntimePowerLevelDefinition("light_support", level);
  const mechanics = asRecord(levelDefinition?.mechanics);
  const auraBonuses = asRecord(mechanics?.aura_bonuses);
  const adjudication = asRecord(levelDefinition?.adjudication);
  const cantripMechanics = getLatestCantripLevel("light_support", level);
  const manaBonus = asNumber(cantripMechanics?.mana_bonus) ?? 0;

  return [
    {
      title: "Lunar Bless",
      bullets: [`Gain nightvision and +${manaBonus} mana.`],
    },
    {
      title: "Let There Be Light",
      bullets: [
        `Aura grants +${asNumber(auraBonuses?.attack_dice_bonus) ?? 0} Hit, +${asNumber(auraBonuses?.damage_reduction_bonus) ?? 0} DR, and +${asNumber(auraBonuses?.soak_bonus) ?? 0} Soak.`,
        `Range ${asString(adjudication?.radius) ?? "self"} for ${asString(adjudication?.duration) ?? "the current duration"}.`,
        ...(level >= 2 ? ["Hostile targets cannot see the light source."] : []),
      ],
    },
    ...(level >= 4
      ? [
          {
            title: "Luminous Restoration",
            bullets: ["Restore up to APP x 2 mana once per long rest."],
          },
        ]
      : []),
    ...(level >= 5
      ? [
          {
            title: "Lessen Darkness",
            bullets: ["While concentrating, reduce darkness-based resistances and immunities by 1."],
          },
        ]
      : []),
  ];
}

function getNecromancySections(level: number): PowerBenefitSection[] {
  const levelDefinition = getRuntimePowerLevelDefinition("necromancy", level);
  const mechanics = asRecord(levelDefinition?.mechanics);
  const summoning = asRecord(mechanics?.summoning);
  const cantripMechanics = getLatestCantripLevel("necromancy", level);
  const meleeSkillBonus = asNumber(cantripMechanics?.melee_skill_bonus) ?? 0;
  const aggroPriority = asString(cantripMechanics?.hostile_undead_aggro_priority);
  const summonOptions = (Array.isArray(summoning?.options)
    ? summoning?.options
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
        .map((entry) => {
          const templateId = asString(entry.template_id);
          const quantity = asNumber(entry.quantity) ?? 1;
          if (templateId === "simple_skeleton") {
            return quantity > 1 ? `${quantity} simple skeletons` : "1 simple skeleton";
          }

          if (templateId === "skeleton_king") {
            return "1 skeleton king";
          }

          if (templateId === "zombie") {
            return "1 zombie";
          }

          return null;
        })
        .filter((entry): entry is string => entry !== null)
    : []) ?? [];
  const necroticTouch = asRecord(mechanics?.necrotic_touch);
  const necroticDamage = asRecord(necroticTouch?.damage);
  const attackBonus = asNumber(summoning?.attack_bonus);
  const damageBonus = asNumber(summoning?.damage_bonus);

  return [
    {
      title: "Necromancer's Deception",
      bullets: [
        ...(meleeSkillBonus > 0 ? [`Gain +${meleeSkillBonus} Melee.`] : []),
        ...(aggroPriority === "ignore_unless_attacked"
          ? ["Hostile undead ignore you unless you attack first."]
          : aggroPriority === "last"
            ? ["Hostile undead place you last on their aggro list."]
            : []),
      ],
    },
    {
      title: "Non-Living Warriors",
      bullets: [
        ...(summonOptions.length > 0 ? [`Available summons: ${joinList(summonOptions)}.`] : []),
        `Max active summons: ${asNumber(summoning?.max_active) ?? 1}.`,
        ...(attackBonus !== null && damageBonus !== null
          ? [`Summons gain +${attackBonus} attack and +${damageBonus} damage.`]
          : []),
      ],
    },
    ...(level >= 3
      ? [
          {
            title: "Necrotic Touch",
            bullets: [
              `On hit, deal APP + ${asNumber(necroticDamage?.power_level_multiplier) === 2 ? "2 x Necromancy level" : "Necromancy level"} necrotic damage.`,
              "Heals the caster by Necromancy level.",
              "Heals undead instead of damaging them.",
            ],
          },
        ]
      : []),
    ...(level >= 5
      ? [
          {
            title: "Necromancer's Bless",
            bullets: ["Resurrects a recently fallen living being to 1 HP."],
          },
        ]
      : []),
  ];
}

function getShadowControlSections(level: number): PowerBenefitSection[] {
  const levelDefinition = getRuntimePowerLevelDefinition("shadow_control", level);
  const mechanics = asRecord(levelDefinition?.mechanics);
  const cloak = asRecord(mechanics?.cloak_of_shadow);
  const shadowWalk = asRecord(mechanics?.shadow_walk);

  return [
    ...(level >= 3
      ? [
          {
            title: "Sleek Visage",
            bullets: [
              ...(level >= 3 ? ["Can make cosmetic outfit and armor changes."] : []),
              ...(level >= 5 ? ["Can also make minor body appearance changes."] : []),
            ],
          },
        ]
      : []),
    {
      title: "Smoldering Shadow",
      bullets: [
        `Gain +${asNumber(cloak?.stealth_skill_bonus) ?? 0} Stealth, +${asNumber(cloak?.intimidation_skill_bonus) ?? 0} Intimidation, and +${asNumber(cloak?.armor_class_bonus) ?? 0} AC.`,
        ...(level >= 4 ? ["Can be shared with selected allies in aura mode."] : []),
      ],
    },
    ...(level >= 2
      ? [
          {
            title: "Shadow Walk",
            bullets: [`Relocate through shadow up to ${(asNumber(shadowWalk?.range_per_power_level_meters) ?? 25) * level}m.`],
          },
          {
            title: "Shadow Walk and Attack",
            bullets: ["Ambush the target; they lose AC for that attack."],
          },
        ]
      : []),
    ...(level >= 3
      ? [
          {
            title: "Shadow Manipulation",
            bullets: ["Deals MAN + Shadow Control level shadow damage and auto-hits."],
          },
        ]
      : []),
    ...(level >= 5
      ? [
          {
            title: "Shadow Fighter",
            bullets: ["Creates one shadow fighter summon using MAN and Shadow Control scaling."],
          },
        ]
      : []),
  ];
}

export function getPowerBenefitSections(powerId: string, level: number): PowerBenefitSection[] {
  let sections: PowerBenefitSection[];

  switch (powerId) {
    case "awareness":
      sections = getAwarenessSections(level);
      break;
    case "body_reinforcement":
      sections = getBodyReinforcementSections(level);
      break;
    case "crowd_control":
      sections = getCrowdControlSections(level);
      break;
    case "elementalist":
      sections = getElementalistSections(level);
      break;
    case "healing":
      sections = getHealingSections(level);
      break;
    case "light_support":
      sections = getLightSupportSections(level);
      break;
    case "necromancy":
      sections = getNecromancySections(level);
      break;
    case "shadow_control":
      sections = getShadowControlSections(level);
      break;
    default: {
      const template = getPowerTemplate(powerId);
      sections = [
        {
          title: "Current Benefits",
          bullets: template?.levelBenefits[level] ?? [`Level ${level} details pending in draft.`],
        },
      ];
      break;
    }
  }

  return sections.filter((section) => section.bullets.length > 0);
}

export function getPowerBenefits(powerId: string, level: number): string[] {
  return getPowerBenefitSections(powerId, level).flatMap((section) => section.bullets);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function coerceNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function coerceNullableNumber(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hydrateStatSources(value: unknown): StatSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    return [
      {
        label: coerceString(entry.label, "Unknown"),
        value: Math.trunc(coerceNumber(entry.value, 0)),
      },
    ];
  });
}

function hydrateResistanceLevel(value: unknown, fallback: ResistanceLevel): ResistanceLevel {
  if (value === -2 || value === -1 || value === 0 || value === 1 || value === 2) {
    return value;
  }

  return fallback;
}

function hydrateStatEntry(value: unknown, fallback: StatEntry): StatEntry {
  const record = isRecord(value) ? value : {};

  return {
    base: Math.max(0, Math.trunc(coerceNumber(record.base, fallback.base))),
    gearSources: hydrateStatSources(record.gearSources),
    buffSources: hydrateStatSources(record.buffSources),
  };
}

function hydrateSkillEntry(value: unknown, fallback: SkillEntry): SkillEntry {
  const record = isRecord(value) ? value : {};

  return {
    id: coerceString(record.id, fallback.id),
    label: coerceString(record.label, fallback.label),
    base: Math.max(0, Math.trunc(coerceNumber(record.base, fallback.base))),
    rollStat: coerceString(record.rollStat, fallback.rollStat),
    gearSources: hydrateStatSources(record.gearSources),
    buffSources: hydrateStatSources(record.buffSources),
  };
}

function hydrateSkills(value: unknown): SkillEntry[] {
  const persistedSkills = Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];

  const persistedById = new Map(
    persistedSkills
      .map((entry) => [coerceString(entry.id, ""), entry] as const)
      .filter(([id]) => id.length > 0)
  );

  const matchedSkills = BLANK_SKILLS.map((skill) =>
    hydrateSkillEntry(persistedById.get(skill.id), skill)
  );

  const extraSkills = persistedSkills
    .filter((entry) => {
      const skillId = coerceString(entry.id, "");
      return skillId.length > 0 && !BLANK_SKILLS.some((skill) => skill.id === skillId);
    })
    .map((entry) =>
      hydrateSkillEntry(entry, {
        id: coerceString(entry.id, "unknown-skill"),
        label: coerceString(entry.label, "Unknown Skill"),
        base: 0,
        rollStat: coerceString(entry.rollStat, ""),
        gearSources: [],
        buffSources: [],
      })
    );

  return [...matchedSkills, ...extraSkills];
}

function hydratePowers(value: unknown): PowerEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const powerId = coerceString(entry.id, "");
    if (!powerId) {
      return [];
    }

    const template = getPowerTemplate(powerId);
    return [
      {
        id: powerId,
        name: template?.name ?? coerceString(entry.name, powerId),
        level: Math.max(0, Math.trunc(coerceNumber(entry.level, 0))),
        governingStat:
          template?.governingStat ??
          (isStatId(entry.governingStat) ? entry.governingStat : "PER"),
      },
    ];
  });
}

function hydrateItemIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0))];
}

function hydrateEquipment(value: unknown): CharacterEquipmentReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    return [
      {
        slot: coerceString(entry.slot, ""),
        itemId: typeof entry.itemId === "string" && entry.itemId.trim().length > 0 ? entry.itemId : null,
      },
    ];
  });
}

function hydrateIntelSnapshotFields(value: unknown): IntelSnapshotField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const label = coerceString(entry.label, "");
    const rawValue = entry.value;
    const valueText =
      typeof rawValue === "number" && Number.isFinite(rawValue)
        ? rawValue
        : coerceString(rawValue, "");

    if (!label) {
      return [];
    }

    return [{ label, value: valueText }];
  });
}

function hydrateGameHistory(value: unknown): GameHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<GameHistoryEntry[]>((entries, entry) => {
    if (!isRecord(entry)) {
      return entries;
    }

    const id = coerceString(entry.id, "");
    const type = entry.type === "intel_snapshot" ? "intel_snapshot" : "note";
    const actualDateTime = coerceString(entry.actualDateTime, "");
    const gameDateTime = coerceString(entry.gameDateTime, "");
    const rawKnowledgeLink = isRecord(entry.knowledgeLink) ? entry.knowledgeLink : null;
    const knowledgeLink =
      rawKnowledgeLink &&
      typeof rawKnowledgeLink.knowledgeEntityId === "string" &&
      typeof rawKnowledgeLink.knowledgeRevisionId === "string" &&
      typeof rawKnowledgeLink.knowledgeLabel === "string"
        ? {
            knowledgeEntityId: rawKnowledgeLink.knowledgeEntityId,
            knowledgeRevisionId: rawKnowledgeLink.knowledgeRevisionId,
            knowledgeLabel: rawKnowledgeLink.knowledgeLabel,
          }
        : null;

    if (!id || !actualDateTime || !gameDateTime) {
      return entries;
    }

    if (type === "intel_snapshot") {
      if (!knowledgeLink) {
        return entries;
      }

      const snapshot = isRecord(entry.snapshot) ? entry.snapshot : {};
      entries.push({
        id,
        type,
        actualDateTime,
        gameDateTime,
        sourcePower: coerceString(entry.sourcePower, "Assess Character"),
        targetCharacterId:
          typeof entry.targetCharacterId === "string" ? entry.targetCharacterId : null,
        targetName: coerceString(entry.targetName, "Unknown Target"),
        summary: coerceString(entry.summary, ""),
        knowledgeLink,
        snapshot: {
          rank: coerceString(snapshot.rank, ""),
          cr: Math.max(0, Math.trunc(coerceNumber(snapshot.cr, 0))),
          age: coerceNullableNumber(snapshot.age, null),
          karma: coerceString(snapshot.karma, ""),
          biographyPrimary: coerceString(snapshot.biographyPrimary, ""),
          resistances: Array.isArray(snapshot.resistances)
            ? snapshot.resistances.filter((item): item is string => typeof item === "string")
            : [],
          combatSummary: hydrateIntelSnapshotFields(snapshot.combatSummary),
          stats: hydrateIntelSnapshotFields(snapshot.stats),
          skills: hydrateIntelSnapshotFields(snapshot.skills),
          powers: Array.isArray(snapshot.powers)
            ? snapshot.powers.filter((item): item is string => typeof item === "string")
            : [],
          specials: Array.isArray(snapshot.specials)
            ? snapshot.specials.filter((item): item is string => typeof item === "string")
            : [],
          notes: Array.isArray(snapshot.notes)
            ? snapshot.notes.filter((item): item is string => typeof item === "string")
            : [],
        },
      });
      return entries;
    }

    entries.push({
      id,
      type,
      actualDateTime,
      gameDateTime,
      note: coerceString(entry.note, ""),
      knowledgeLink,
    });
    return entries;
  }, []);
}

function hydrateStatusTags(value: unknown): EncounterStatusTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const id = coerceString(entry.id, "");
    const label = coerceString(entry.label, "");
    if (!id || !label) {
      return [];
    }

    return [{ id, label }];
  });
}

function hydrateEffects(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function hydrateDmAuditLog(value: unknown): DmAuditEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const id = coerceString(entry.id, "");
    const characterId = coerceString(entry.characterId, "");
    const targetOwnerRole = entry.targetOwnerRole === "dm" ? "dm" : "player";
    const editLayer =
      entry.editLayer === "runtime" || entry.editLayer === "admin_override" ? entry.editLayer : "sheet";

    if (!id || !characterId) {
      return [];
    }

    return [
      {
        id,
        timestamp: coerceString(entry.timestamp, new Date(0).toISOString()),
        characterId,
        targetOwnerRole,
        editLayer,
        fieldPath: coerceString(entry.fieldPath, ""),
        beforeValue: coerceString(entry.beforeValue, ""),
        afterValue: coerceString(entry.afterValue, ""),
        reason: coerceString(entry.reason, ""),
        sourceScreen: coerceString(entry.sourceScreen, ""),
      },
    ];
  });
}

function hydrateActivePowerEffectModifier(value: unknown): ActivePowerEffectModifier | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.targetType !== "stat" &&
    value.targetType !== "skill" &&
    value.targetType !== "derived" &&
    value.targetType !== "resistance"
  ) {
    return null;
  }

  return {
    targetType: value.targetType,
    targetId: coerceString(value.targetId, ""),
    value: Math.trunc(coerceNumber(value.value, 0)),
    sourceLabel: coerceString(value.sourceLabel, "Unknown Power"),
  };
}

function backfillHydratedActivePowerEffectModifiers(
  powerId: string,
  stackKey: string,
  label: string,
  summary: string,
  sourceLevel: number,
  casterCharacterId: string,
  targetCharacterId: string,
  modifiers: ActivePowerEffectModifier[]
): ActivePowerEffectModifier[] {
  if (modifiers.length > 0) {
    return modifiers;
  }

  if (powerId !== "light_support" || sourceLevel < 5 || targetCharacterId === casterCharacterId) {
    return modifiers;
  }

  const normalizedLabel = label.trim().toLowerCase();
  const normalizedSummary = summary.trim().toLowerCase();
  const looksLikeExposeDarkness =
    stackKey === "light_support:expose_darkness" ||
    normalizedLabel === "lessen darkness" ||
    normalizedSummary.includes("physical / elemental resistance");

  if (!looksLikeExposeDarkness) {
    return modifiers;
  }

  return LIGHT_SUPPORT_LEVEL_FIVE_EXPOSE_DARKNESS_TYPES.map((damageType) => ({
    targetType: "resistance",
    targetId: damageType,
    value: -1,
    sourceLabel: "Lessen Darkness",
  }));
}

function hydrateActivePowerEffects(value: unknown): ActivePowerEffect[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const parsedModifiers = Array.isArray(entry.modifiers)
      ? entry.modifiers
          .map((modifier) => hydrateActivePowerEffectModifier(modifier))
          .filter((modifier): modifier is ActivePowerEffectModifier => modifier !== null)
      : [];

    const effectId = coerceString(entry.id, "");
    const powerId = coerceString(entry.powerId, "");
    const targetCharacterId = coerceString(entry.targetCharacterId, "");
    const casterCharacterId = coerceString(entry.casterCharacterId, "");
    const persistedStackKey = coerceString(entry.stackKey, "");
    const normalizedStackKey =
      powerId === "light_support" &&
      (persistedStackKey === "light_support" || persistedStackKey === "light_support:aura")
        ? "light_support"
        : powerId === "shadow_control" &&
            (persistedStackKey === "shadow_control:cloak" ||
              persistedStackKey === "shadow_control:cloak:self" ||
              persistedStackKey === "shadow_control:cloak:aura")
          ? "shadow_control:cloak"
          : persistedStackKey;
    const sourceLevel = Math.max(0, Math.trunc(coerceNumber(entry.sourceLevel, 0)));
    const label = coerceString(entry.label, powerId);
    const summary = coerceString(entry.summary, "");
    const inferredEffectKind =
      entry.effectKind === "aura_source" || entry.effectKind === "aura_shared"
        ? entry.effectKind
        : powerId === "light_support" && targetCharacterId === casterCharacterId
          ? "aura_source"
          : powerId === "light_support" && targetCharacterId !== casterCharacterId
            ? "aura_shared"
          : powerId === "shadow_control" && targetCharacterId === casterCharacterId
            ? "aura_source"
            : powerId === "shadow_control" && targetCharacterId !== casterCharacterId
              ? "aura_shared"
            : "direct";
    const persistedManaCost =
      entry.manaCost === null ? null : Math.max(0, Math.trunc(coerceNumber(entry.manaCost, 0)));
    const persistedSharedTargetCharacterIds = Array.isArray(entry.sharedTargetCharacterIds)
      ? entry.sharedTargetCharacterIds.filter((targetId): targetId is string => typeof targetId === "string")
      : null;
    const inferredShareMode =
      powerId === "shadow_control" && inferredEffectKind === "aura_source"
        ? (() => {
            const runtimeLevel = getRuntimePowerLevelDefinition("shadow_control", sourceLevel);
            const mechanics = runtimeLevel?.mechanics ?? {};
            const manaCostVariants =
              mechanics.mana_cost_variants && typeof mechanics.mana_cost_variants === "object"
                ? (mechanics.mana_cost_variants as Record<string, unknown>)
                : {};
            const selfOnlyManaCost =
              typeof manaCostVariants.self_only === "number" ? manaCostVariants.self_only : null;
            const sharedManaCost =
              typeof manaCostVariants.shared_with_allies === "number"
                ? manaCostVariants.shared_with_allies
                : null;
            const hasSharedTargets = (persistedSharedTargetCharacterIds ?? []).some(
              (targetId) => targetId !== casterCharacterId
            );

            if (entry.shareMode === "aura" || hasSharedTargets) {
              return "aura";
            }

            if (
              persistedManaCost !== null &&
              sharedManaCost !== null &&
              selfOnlyManaCost !== sharedManaCost &&
              persistedManaCost === sharedManaCost
            ) {
              return "aura";
            }

            return "self";
          })()
        : entry.shareMode === "self" || entry.shareMode === "aura"
          ? entry.shareMode
        : powerId === "light_support" && inferredEffectKind === "aura_source"
          ? "aura"
        : null;

    if (!effectId || !normalizedStackKey || !powerId || !targetCharacterId) {
      return [];
    }

    const modifiers = backfillHydratedActivePowerEffectModifiers(
      powerId,
      normalizedStackKey,
      label,
      summary,
      sourceLevel,
      casterCharacterId,
      targetCharacterId,
      parsedModifiers
    );

    return [
      {
        id: effectId,
        stackKey: normalizedStackKey,
        effectKind: inferredEffectKind,
        powerId,
        powerName: coerceString(entry.powerName, powerId),
        sourceLevel,
        casterCharacterId,
        casterName: coerceString(entry.casterName, "Unknown Caster"),
        targetCharacterId,
        sourceEffectId:
          typeof entry.sourceEffectId === "string" ? entry.sourceEffectId : null,
        shareMode: inferredShareMode,
        sharedTargetCharacterIds: persistedSharedTargetCharacterIds,
        label,
        summary,
        actionType: typeof entry.actionType === "string" ? entry.actionType : null,
        manaCost: persistedManaCost,
        selectedStatId: isStatId(entry.selectedStatId) ? entry.selectedStatId : null,
        modifiers,
        appliedAt: coerceString(entry.appliedAt, new Date(0).toISOString()),
      },
    ];
  });
}

export function hydrateCharacterDraft(value: unknown): CharacterDraft {
  const defaults = PLAYER_CHARACTER_TEMPLATE.createInstance();
  const record = isRecord(value) ? value : {};
  const statState = Object.fromEntries(
    STAT_IDS.map((statId) => [
      statId,
      hydrateStatEntry(record.statState && isRecord(record.statState) ? record.statState[statId] : undefined, defaults.statState[statId]),
    ])
  ) as Record<StatId, StatEntry>;
  const resistances = { ...defaults.resistances };

  if (isRecord(record.resistances)) {
    for (const damageTypeId of Object.keys(resistances) as DamageTypeId[]) {
      const persistedKey =
        damageTypeId === "cold" &&
        record.resistances[damageTypeId] === undefined &&
        record.resistances.ice !== undefined
          ? "ice"
          : damageTypeId;

      resistances[damageTypeId] = hydrateResistanceLevel(
        record.resistances[persistedKey],
        resistances[damageTypeId]
      );
    }
  }

  const defaultHp = calculateMaxHP(statState.STAM.base);

  return normalizeCharacterDraft({
    name: coerceString(record.name, defaults.name),
    concept: coerceString(record.concept, defaults.concept),
    faction: coerceString(record.faction, defaults.faction),
    age: coerceNullableNumber(record.age, defaults.age),
    gameDateTime: coerceString(record.gameDateTime, defaults.gameDateTime),
    biographyPrimary: coerceString(record.biographyPrimary, defaults.biographyPrimary),
    biographySecondary: coerceString(record.biographySecondary, defaults.biographySecondary),
    xpEarned: Math.max(0, Math.trunc(coerceNumber(record.xpEarned, defaults.xpEarned))),
    xpUsed: Math.max(0, Math.trunc(coerceNumber(record.xpUsed, defaults.xpUsed))),
    money: Math.max(0, Math.trunc(coerceNumber(record.money, defaults.money))),
    inspiration: Math.max(0, Math.trunc(coerceNumber(record.inspiration, defaults.inspiration))),
    temporaryInspiration: Math.max(
      0,
      Math.trunc(coerceNumber(record.temporaryInspiration, defaults.temporaryInspiration))
    ),
    awarenessInsightGranted: record.awarenessInsightGranted === true,
    positiveKarma: Math.max(0, Math.trunc(coerceNumber(record.positiveKarma, defaults.positiveKarma))),
    negativeKarma: Math.max(0, Math.trunc(coerceNumber(record.negativeKarma, defaults.negativeKarma))),
    currentHp: Math.trunc(coerceNumber(record.currentHp, defaultHp)),
    temporaryHp: Math.max(0, Math.trunc(coerceNumber(record.temporaryHp, defaults.temporaryHp))),
    currentMana: Math.max(0, Math.trunc(coerceNumber(record.currentMana, defaults.currentMana))),
    manaInitialized: record.manaInitialized === true,
    resistances,
    statState,
    skills: hydrateSkills(record.skills),
    powers: hydratePowers(record.powers),
    activePowerEffects: hydrateActivePowerEffects(record.activePowerEffects),
    powerUsageState: normalizePowerUsageState(record.powerUsageState),
    ownedItemIds: hydrateItemIdList(record.ownedItemIds),
    inventoryItemIds: hydrateItemIdList(record.inventoryItemIds),
    activeItemIds: hydrateItemIdList(record.activeItemIds),
    equipment: hydrateEquipment(record.equipment),
    gameHistory: hydrateGameHistory(record.gameHistory),
    statusTags: hydrateStatusTags(record.statusTags),
    effects: hydrateEffects(record.effects),
    dmAuditLog: hydrateDmAuditLog(record.dmAuditLog),
  });
}

