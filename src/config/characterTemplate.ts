import {
  createDefaultResistances,
  type DamageTypeId,
  type ResistanceLevel,
} from "./resistances.ts";
import { calculateMaxHP } from "./stats.ts";
import type {
  ActivePowerEffect,
  ActivePowerEffectModifier,
} from "../types/activePowerEffects";

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

export type StatId =
  | "STR"
  | "DEX"
  | "STAM"
  | "CHA"
  | "APP"
  | "MAN"
  | "INT"
  | "WITS"
  | "PER";

export type PowerEntry = {
  id: string;
  name: string;
  level: number;
  governingStat: string;
};

export type DmAuditEntry = {
  id: string;
  timestamp: string;
  characterId: string;
  targetOwnerRole: "player" | "dm";
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
  positiveKarma: number;
  negativeKarma: number;
  currentHp: number;
  currentMana: number;
  manaInitialized: boolean;
  resistances: Record<DamageTypeId, ResistanceLevel>;
  statState: Record<StatId, StatEntry>;
  skills: SkillEntry[];
  powers: PowerEntry[];
  activePowerEffects: ActivePowerEffect[];
  equipment: Array<{ slot: string; item: string; effect: string }>;
  inventory: Array<{ name: string; category: string; note: string }>;
  effects: string[];
  dmAuditLog: DmAuditEntry[];
};

export type PowerTemplate = {
  id: string;
  name: string;
  governingStat: string;
  levelBenefits: Record<number, string[]>;
};

export const CHARACTER_DRAFT_SCHEMA_VERSION = 2;

const STAT_IDS: StatId[] = ["STR", "DEX", "STAM", "CHA", "APP", "MAN", "INT", "WITS", "PER"];

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
      1: ["Alertness bonus: +1", "Identify simple NPC stats and common to masterwork items"],
      2: ["Alertness bonus: +2", "Identify stronger targets, special skills, loot, and epic or lesser items"],
      3: [
        "Alertness bonus: +3",
        "Ignore techno-infused invisibility devices",
        "Cantrip: +1 Inspiration per session",
      ],
      4: ["Alertness bonus: +4", "Identify legendary or lesser items"],
      5: ["Alertness bonus: +5", "Identify nearly all targets except supreme beings"],
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
      3: ["Necrotic Touch unlocked", "Summons retained"],
      4: ["Zombie option unlocked", "Summons gain +2 attack and damage"],
      5: ["Summons gain +5 attack and damage", "Resurrection unlocked"],
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
      positiveKarma: 0,
      negativeKarma: 0,
      currentHp: calculateMaxHP(2),
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
      equipment: [],
      inventory: [],
      effects: [],
      dmAuditLog: [],
    };
  }
}

export const PLAYER_CHARACTER_TEMPLATE = new CharacterSheetTemplate();

export function getPowerTemplate(powerId: string): PowerTemplate | undefined {
  return powerLibrary.find((power) => power.id === powerId);
}

export function getPowerBenefits(powerId: string, level: number): string[] {
  const template = getPowerTemplate(powerId);
  return template?.levelBenefits[level] ?? [`Level ${level} details pending in draft.`];
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
        governingStat: template?.governingStat ?? coerceString(entry.governingStat, ""),
      },
    ];
  });
}

function hydrateEquipment(
  value: unknown
): Array<{ slot: string; item: string; effect: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    return [
      {
        slot: coerceString(entry.slot, "Unknown Slot"),
        item: coerceString(entry.item, ""),
        effect: coerceString(entry.effect, ""),
      },
    ];
  });
}

function hydrateInventory(
  value: unknown
): Array<{ name: string; category: string; note: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    return [
      {
        name: coerceString(entry.name, "Unnamed Item"),
        category: coerceString(entry.category, ""),
        note: coerceString(entry.note, ""),
      },
    ];
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
    value.targetType !== "derived"
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

function hydrateActivePowerEffects(value: unknown): ActivePowerEffect[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const modifiers = Array.isArray(entry.modifiers)
      ? entry.modifiers
          .map((modifier) => hydrateActivePowerEffectModifier(modifier))
          .filter((modifier): modifier is ActivePowerEffectModifier => modifier !== null)
      : [];

    const effectId = coerceString(entry.id, "");
    const stackKey = coerceString(entry.stackKey, "");
    const powerId = coerceString(entry.powerId, "");
    const targetCharacterId = coerceString(entry.targetCharacterId, "");

    if (!effectId || !stackKey || !powerId || !targetCharacterId) {
      return [];
    }

    return [
      {
        id: effectId,
        stackKey,
        effectKind:
          entry.effectKind === "aura_source" || entry.effectKind === "aura_shared"
            ? entry.effectKind
            : "direct",
        powerId,
        powerName: coerceString(entry.powerName, powerId),
        sourceLevel: Math.max(0, Math.trunc(coerceNumber(entry.sourceLevel, 0))),
        casterCharacterId: coerceString(entry.casterCharacterId, ""),
        casterName: coerceString(entry.casterName, "Unknown Caster"),
        targetCharacterId,
        sourceEffectId:
          typeof entry.sourceEffectId === "string" ? entry.sourceEffectId : null,
        shareMode:
          entry.shareMode === "self" || entry.shareMode === "aura" ? entry.shareMode : null,
        sharedTargetCharacterIds: Array.isArray(entry.sharedTargetCharacterIds)
          ? entry.sharedTargetCharacterIds
              .filter((targetId): targetId is string => typeof targetId === "string")
          : null,
        label: coerceString(entry.label, powerId),
        summary: coerceString(entry.summary, ""),
        actionType: typeof entry.actionType === "string" ? entry.actionType : null,
        manaCost:
          entry.manaCost === null
            ? null
            : Math.max(0, Math.trunc(coerceNumber(entry.manaCost, 0))),
        selectedStatId:
          typeof entry.selectedStatId === "string" ? entry.selectedStatId : null,
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

  return {
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
    positiveKarma: Math.max(0, Math.trunc(coerceNumber(record.positiveKarma, defaults.positiveKarma))),
    negativeKarma: Math.max(0, Math.trunc(coerceNumber(record.negativeKarma, defaults.negativeKarma))),
    currentHp: Math.max(0, Math.trunc(coerceNumber(record.currentHp, defaultHp))),
    currentMana: Math.max(0, Math.trunc(coerceNumber(record.currentMana, defaults.currentMana))),
    manaInitialized: record.manaInitialized === true,
    resistances,
    statState,
    skills: hydrateSkills(record.skills),
    powers: hydratePowers(record.powers),
    activePowerEffects: hydrateActivePowerEffects(record.activePowerEffects),
    equipment: hydrateEquipment(record.equipment),
    inventory: hydrateInventory(record.inventory),
    effects: hydrateEffects(record.effects),
    dmAuditLog: hydrateDmAuditLog(record.dmAuditLog),
  };
}
