import {
  createDefaultResistances,
  type DamageTypeId,
  type ResistanceLevel,
} from "../rules/resistances.ts";
import {
  createEmptyPowerUsageState,
  normalizePowerUsageState,
} from "../lib/powerUsage.ts";
import { getRuntimePowerLevelDefinition } from "../rules/powerData.ts";
import { calculateMaxHP } from "../rules/stats.ts";
import type {
  ActivePowerEffect,
  ActivePowerEffectModifier,
} from "../types/activePowerEffects";
import { STAT_IDS, isStatId, type CharacterOwnerRole, type StatId } from "../types/character.ts";
import type { PowerUsageState } from "../types/powerUsage.ts";

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

export type InventoryEntry = {
  name: string;
  category: string;
  note: string;
  qualityTier: string | null;
  hiddenSpec: string | null;
  revealedSpec: string | null;
  identified: boolean;
  identifiedAtAwarenessLevel: number | null;
};

export type EquipmentEntry = {
  slot: string;
  item: string;
  effect: string;
  qualityTier: string | null;
  hiddenSpec: string | null;
  revealedSpec: string | null;
  identified: boolean;
  identifiedAtAwarenessLevel: number | null;
};

export type GameHistoryNoteEntry = {
  id: string;
  type: "note";
  actualDateTime: string;
  gameDateTime: string;
  note: string;
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
  equipment: EquipmentEntry[];
  inventory: InventoryEntry[];
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

export const CHARACTER_DRAFT_SCHEMA_VERSION = 5;

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
      equipment: [],
      inventory: [],
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
  const hasAwareness = sheet.powers.some((power) => power.id === "awareness" && power.level > 0);

  if (hasAwareness && !sheet.awarenessInsightGranted) {
    return {
      ...sheet,
      powerUsageState: normalizedUsageState,
      temporaryInspiration: sheet.temporaryInspiration + 1,
      awarenessInsightGranted: true,
    };
  }

  if (!hasAwareness && sheet.awarenessInsightGranted) {
    return {
      ...sheet,
      powerUsageState: normalizedUsageState,
      temporaryInspiration: Math.max(0, sheet.temporaryInspiration - 1),
      awarenessInsightGranted: false,
    };
  }

  return {
    ...sheet,
    powerUsageState: normalizedUsageState,
  };
}

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
        governingStat:
          template?.governingStat ??
          (isStatId(entry.governingStat) ? entry.governingStat : "PER"),
      },
    ];
  });
}

function hydrateEquipment(value: unknown): EquipmentEntry[] {
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
        qualityTier: typeof entry.qualityTier === "string" ? entry.qualityTier : null,
        hiddenSpec: typeof entry.hiddenSpec === "string" ? entry.hiddenSpec : null,
        revealedSpec: typeof entry.revealedSpec === "string" ? entry.revealedSpec : null,
        identified: entry.identified === true,
        identifiedAtAwarenessLevel:
          typeof entry.identifiedAtAwarenessLevel === "number" &&
          Number.isFinite(entry.identifiedAtAwarenessLevel)
            ? Math.max(0, Math.trunc(entry.identifiedAtAwarenessLevel))
            : null,
      },
    ];
  });
}

function hydrateInventory(value: unknown): InventoryEntry[] {
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
        qualityTier: typeof entry.qualityTier === "string" ? entry.qualityTier : null,
        hiddenSpec: typeof entry.hiddenSpec === "string" ? entry.hiddenSpec : null,
        revealedSpec: typeof entry.revealedSpec === "string" ? entry.revealedSpec : null,
        identified: entry.identified === true,
        identifiedAtAwarenessLevel:
          typeof entry.identifiedAtAwarenessLevel === "number" &&
          Number.isFinite(entry.identifiedAtAwarenessLevel)
            ? Math.max(0, Math.trunc(entry.identifiedAtAwarenessLevel))
            : null,
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

    if (!id || !actualDateTime || !gameDateTime) {
      return entries;
    }

    if (type === "intel_snapshot") {
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
        label: coerceString(entry.label, powerId),
        summary: coerceString(entry.summary, ""),
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
    equipment: hydrateEquipment(record.equipment),
    inventory: hydrateInventory(record.inventory),
    gameHistory: hydrateGameHistory(record.gameHistory),
    statusTags: hydrateStatusTags(record.statusTags),
    effects: hydrateEffects(record.effects),
    dmAuditLog: hydrateDmAuditLog(record.dmAuditLog),
  });
}

