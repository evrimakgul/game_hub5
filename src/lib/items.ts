import type { CharacterDraft } from "../config/characterTemplate.ts";
import { powerLibrary } from "../config/characterTemplate.ts";
import { getCastPowerVariantOptions } from "../rules/powerEffects.ts";
import type { DamageTypeId } from "../rules/resistances.ts";
import type { StatId } from "../types/character.ts";
import type {
  BonusProfile,
  CharacterEquipmentReference,
  ItemBaseOverrideProfile,
  ItemBlueprintId,
  ItemBlueprintRecord,
  ItemCategory,
  ItemCombatSpec,
  ItemCustomPropertyRecord,
  ItemCustomPropertyTarget,
  ItemDerivedModifierId,
  ItemModifierSource,
  SharedItemRecord,
  WeaponHandSlotId,
} from "../types/items.ts";
import {
  WEAPON_HAND_SLOT_IDS,
  WEAPON_HAND_SLOT_LABELS,
  isItemCategory,
  isItemSubtype,
  isWeaponHandSlotId,
} from "../types/items.ts";
import { createTimestampedId } from "./ids.ts";

type ItemOption = {
  id: string;
  label: string;
};

type StarterItemDefinition = {
  id: string;
  blueprintId: ItemBlueprintId;
  name: string;
};

const COMMON_ITEM_TIER = "Common";
const UNCOMMON_ITEM_TIER = "Uncommon / Masterwork";
const RARE_ITEM_TIER = "Rare";
const EPIC_ITEM_TIER = "Epic";
const LEGENDARY_ITEM_TIER = "Legendary";
const MYTHIC_ITEM_TIER = "Mythical / Celestial / Demonic";
const ARTIFACT_ITEM_CLASS = "Artifact";

const ITEM_TIER_BANDS = [
  { label: COMMON_ITEM_TIER, min: 0, max: 0 },
  { label: UNCOMMON_ITEM_TIER, min: 1, max: 4 },
  { label: RARE_ITEM_TIER, min: 5, max: 10 },
  { label: EPIC_ITEM_TIER, min: 11, max: 18 },
  { label: LEGENDARY_ITEM_TIER, min: 19, max: 30 },
  { label: MYTHIC_ITEM_TIER, min: 31, max: Number.POSITIVE_INFINITY },
] as const;

const TIER_ONE_DERIVED_IDS = new Set<ItemDerivedModifierId>([
  "max_hp",
  "max_mana",
  "initiative",
  "inspiration",
]);

const TIER_TWO_DERIVED_IDS = new Set<ItemDerivedModifierId>([
  "attack_dice_bonus",
  "melee_attack",
  "ranged_attack",
  "armor_class",
  "damage_reduction",
  "soak",
  "melee_damage",
  "ranged_damage",
]);

const LEGACY_BLUEPRINT_ALIASES: Record<string, ItemBlueprintId> = {
  "weapon:bow": "weapon:ranged_light",
  "armor:shield": "armor:shield_light",
  "mystic:mystic": "mystic:focus",
};

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    ),
  ];
}

function normalizeInteger(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.trunc(value);
}

function normalizeCustomPropertyTarget(value: unknown): ItemCustomPropertyTarget | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    record.type !== "stat" &&
    record.type !== "skill" &&
    record.type !== "derived" &&
    record.type !== "resistance" &&
    record.type !== "power" &&
    record.type !== "spell"
  ) {
    return null;
  }
  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    return null;
  }

  return {
    type: record.type,
    id: record.id.trim(),
  };
}

export function createItemCustomPropertyRecord(
  overrides: Partial<ItemCustomPropertyRecord> = {}
): ItemCustomPropertyRecord {
  return {
    id:
      typeof overrides.id === "string" && overrides.id.trim().length > 0
        ? overrides.id
        : createTimestampedId("item-prop"),
    label:
      typeof overrides.label === "string" && overrides.label.trim().length > 0
        ? overrides.label.trim()
        : "Custom Property",
    notes: typeof overrides.notes === "string" ? overrides.notes.trim() : "",
    ppCost: normalizeInteger(overrides.ppCost, 0),
    value: normalizeInteger(overrides.value, 0),
    targets: Array.isArray(overrides.targets)
      ? overrides.targets
          .map((target) => normalizeCustomPropertyTarget(target))
          .filter((target): target is ItemCustomPropertyTarget => target !== null)
      : [],
  };
}

export function cloneItemCustomPropertyRecord(
  property: ItemCustomPropertyRecord
): ItemCustomPropertyRecord {
  return {
    ...property,
    targets: property.targets.map((target) => ({ ...target })),
  };
}

export function normalizeItemCustomPropertyRecords(value: unknown): ItemCustomPropertyRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set<string>();
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return [];
    }

    const property = createItemCustomPropertyRecord(entry as Partial<ItemCustomPropertyRecord>);
    if (seenIds.has(property.id)) {
      return [];
    }
    seenIds.add(property.id);
    return [property];
  });
}

function inferLegacyTierMinimumPropertyPoints(
  qualityTier: string | null,
  itemLevel: number | null
): number {
  const normalized = qualityTier?.trim().toLowerCase() ?? "";

  if (normalized.includes("common")) return 0;
  if (normalized.includes("uncommon") || normalized.includes("masterwork")) return 1;
  if (normalized.includes("rare")) return 5;
  if (normalized.includes("epic")) return 11;
  if (normalized.includes("legendary")) return 19;
  if (normalized.includes("myth") || normalized.includes("celestial") || normalized.includes("demonic")) return 31;
  if (normalized.includes("artifact")) return 1;
  if (itemLevel === null) return 0;
  if (itemLevel >= 5) return 31;
  if (itemLevel === 4) return 19;
  if (itemLevel === 3) return 11;
  if (itemLevel === 2) return 5;
  if (itemLevel === 1) return 1;
  return 0;
}

function inferLegacyArtifactFlag(qualityTier: string | null): boolean {
  return (qualityTier?.trim().toLowerCase() ?? "").includes("artifact");
}

function cloneCombatSpec(spec: ItemCombatSpec | null | undefined): ItemCombatSpec | null {
  return spec ? { ...spec } : null;
}

function normalizeItemCombatSpec(value: unknown): ItemCombatSpec | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const handsRequired =
    record.handsRequired === 1 || record.handsRequired === 2 ? record.handsRequired : undefined;
  const attacksPerAction =
    typeof record.attacksPerAction === "number" && Number.isFinite(record.attacksPerAction)
      ? Math.max(1, Math.trunc(record.attacksPerAction))
      : undefined;

  return {
    attackKind:
      record.attackKind === "melee" || record.attackKind === "ranged"
        ? record.attackKind
        : undefined,
    physicalProfileKind:
      record.physicalProfileKind === "unarmed" ||
      record.physicalProfileKind === "brawl" ||
      record.physicalProfileKind === "one_handed" ||
      record.physicalProfileKind === "two_handed" ||
      record.physicalProfileKind === "oversized" ||
      record.physicalProfileKind === "ranged"
        ? record.physicalProfileKind
        : undefined,
    handsRequired,
    attacksPerAction,
    meleeDamageBonus:
      typeof record.meleeDamageBonus === "number" && Number.isFinite(record.meleeDamageBonus)
        ? Math.trunc(record.meleeDamageBonus)
        : undefined,
    rangedDamageBase:
      typeof record.rangedDamageBase === "number" && Number.isFinite(record.rangedDamageBase)
        ? Math.trunc(record.rangedDamageBase)
        : undefined,
    rangeMeters:
      typeof record.rangeMeters === "number" && Number.isFinite(record.rangeMeters)
        ? Math.max(0, Math.trunc(record.rangeMeters))
        : undefined,
    minimumStrength:
      typeof record.minimumStrength === "number" && Number.isFinite(record.minimumStrength)
        ? Math.max(0, Math.trunc(record.minimumStrength))
        : undefined,
    isAreaOfEffect: record.isAreaOfEffect === true,
    slotKey: typeof record.slotKey === "string" ? record.slotKey : undefined,
  };
}

function normalizeNumericMapValue(
  value: unknown,
  options: { preserveZero: boolean }
): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, entry]) => {
      if (typeof entry !== "number" || !Number.isFinite(entry)) {
        return [];
      }

      const nextValue = Math.trunc(entry);
      if (!options.preserveZero && nextValue === 0) {
        return [];
      }

      return [[key, nextValue]];
    })
  );
}

function mergeNumericMaps(
  left: Record<string, number>,
  right: Record<string, number>
): Record<string, number> {
  const next = { ...left };

  Object.entries(right).forEach(([key, value]) => {
    const total = (next[key] ?? 0) + value;
    if (total === 0) {
      delete next[key];
      return;
    }

    next[key] = total;
  });

  return next;
}

function applyAbsoluteOverrideMap(
  base: Record<string, number>,
  override: Record<string, number> | undefined
): Record<string, number> {
  if (!override) {
    return { ...base };
  }

  const next = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    if (!Number.isFinite(value)) {
      return;
    }

    if (value === 0) {
      delete next[key];
      return;
    }

    next[key] = Math.trunc(value);
  });

  return next;
}

function mapsAreEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return keys.every((key) => (left[key] ?? 0) === (right[key] ?? 0));
}

function arraysAreEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function normalizeBlueprintId(value: string): ItemBlueprintId {
  return LEGACY_BLUEPRINT_ALIASES[value] ?? value;
}

function inferBlueprintIdFromCategorySubtype(
  category: unknown,
  subtype: unknown
): ItemBlueprintId | null {
  if (typeof category !== "string" || typeof subtype !== "string") {
    return null;
  }

  const legacyKey = `${category}:${subtype}`;
  if (LEGACY_BLUEPRINT_ALIASES[legacyKey]) {
    return LEGACY_BLUEPRINT_ALIASES[legacyKey];
  }

  if (!isItemCategory(category)) {
    return null;
  }

  if (category === "weapon" && subtype === "bow") {
    return "weapon:ranged_light";
  }

  if (category === "armor" && subtype === "shield") {
    return "armor:shield_light";
  }

  if (category === "mystic" && subtype === "mystic") {
    return "mystic:focus";
  }

  return legacyKey;
}

function createBlueprintRecord(
  definition: Omit<ItemBlueprintRecord, "overrideItemIds"> & { overrideItemIds?: string[] }
): ItemBlueprintRecord {
  return {
    ...definition,
    id: normalizeBlueprintId(definition.id),
    baseProfile: normalizeBonusProfile(definition.baseProfile),
    combatSpec: cloneCombatSpec(definition.combatSpec),
    visibleNotes: sanitizeStringArray(definition.visibleNotes),
    requirements: sanitizeStringArray(definition.requirements),
    overrideItemIds: sanitizeStringArray(definition.overrideItemIds),
  };
}

function buildDefaultItemBlueprints(): ItemBlueprintRecord[] {
  return [
    createBlueprintRecord({
      id: "weapon:unarmed",
      category: "weapon",
      subtype: "unarmed",
      label: "Weapon / Unarmed",
      defaultName: "Unarmed",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "melee",
        physicalProfileKind: "unarmed",
        handsRequired: 1,
        attacksPerAction: 2,
        meleeDamageBonus: 0,
      },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "weapon:brawl",
      category: "weapon",
      subtype: "brawl",
      label: "Weapon / Brawl Weapon",
      defaultName: "Brawl Weapon",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "melee",
        physicalProfileKind: "brawl",
        handsRequired: 1,
        attacksPerAction: 2,
        meleeDamageBonus: 1,
      },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "weapon:one_handed",
      category: "weapon",
      subtype: "one_handed",
      label: "Weapon / One-Handed",
      defaultName: "One-Handed Weapon",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "melee",
        physicalProfileKind: "one_handed",
        handsRequired: 1,
        attacksPerAction: 1,
        meleeDamageBonus: 3,
      },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "weapon:two_handed",
      category: "weapon",
      subtype: "two_handed",
      label: "Weapon / Two-Handed",
      defaultName: "Two-Handed Weapon",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "melee",
        physicalProfileKind: "two_handed",
        handsRequired: 2,
        attacksPerAction: 1,
        meleeDamageBonus: 6,
        minimumStrength: 4,
      },
      visibleNotes: [],
      requirements: ["Minimum STR 4 to wield."],
    }),
    createBlueprintRecord({
      id: "weapon:oversized",
      category: "weapon",
      subtype: "oversized",
      label: "Weapon / 3-Handed (Oversized)",
      defaultName: "Oversized Weapon",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "melee",
        physicalProfileKind: "oversized",
        handsRequired: 2,
        attacksPerAction: 1,
        meleeDamageBonus: 9,
        minimumStrength: 6,
      },
      visibleNotes: [],
      requirements: ["Minimum STR 6 to wield."],
    }),
    createBlueprintRecord({
      id: "weapon:ranged_light",
      category: "weapon",
      subtype: "ranged_light",
      label: "Weapon / Short Bow Or Light Crossbow",
      defaultName: "Short Bow / Light Crossbow",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "ranged",
        physicalProfileKind: "ranged",
        handsRequired: 2,
        attacksPerAction: 1,
        rangedDamageBase: 5,
        rangeMeters: 25,
      },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "weapon:pistol",
      category: "weapon",
      subtype: "pistol",
      label: "Weapon / Pistol",
      defaultName: "Pistol",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "ranged",
        physicalProfileKind: "ranged",
        handsRequired: 1,
        attacksPerAction: 1,
        rangedDamageBase: 6,
        rangeMeters: 25,
      },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "weapon:bow_long",
      category: "weapon",
      subtype: "bow_long",
      label: "Weapon / Long Bow",
      defaultName: "Long Bow",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "ranged",
        physicalProfileKind: "ranged",
        handsRequired: 2,
        attacksPerAction: 1,
        rangedDamageBase: 6,
        rangeMeters: 50,
      },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "weapon:rifle",
      category: "weapon",
      subtype: "rifle",
      label: "Weapon / Rifle",
      defaultName: "Rifle",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "ranged",
        physicalProfileKind: "ranged",
        handsRequired: 2,
        attacksPerAction: 1,
        rangedDamageBase: 7,
        rangeMeters: 50,
      },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "weapon:crossbow_heavy",
      category: "weapon",
      subtype: "crossbow_heavy",
      label: "Weapon / Heavy Crossbow",
      defaultName: "Heavy Crossbow",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "ranged",
        physicalProfileKind: "ranged",
        handsRequired: 2,
        attacksPerAction: 1,
        rangedDamageBase: 8,
        rangeMeters: 50,
      },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "weapon:shotgun",
      category: "weapon",
      subtype: "shotgun",
      label: "Weapon / Shotgun",
      defaultName: "Shotgun",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "ranged",
        physicalProfileKind: "ranged",
        handsRequired: 2,
        attacksPerAction: 1,
        rangedDamageBase: 10,
        rangeMeters: 10,
      },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "weapon:chaingun",
      category: "weapon",
      subtype: "chaingun",
      label: "Weapon / Chaingun",
      defaultName: "Chaingun",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "ranged",
        physicalProfileKind: "ranged",
        handsRequired: 2,
        attacksPerAction: 1,
        rangedDamageBase: 12,
        rangeMeters: 50,
        minimumStrength: 8,
      },
      visibleNotes: [],
      requirements: ["Minimum STR 8 to wield."],
    }),
    createBlueprintRecord({
      id: "weapon:rocket_launcher",
      category: "weapon",
      subtype: "rocket_launcher",
      label: "Weapon / Rocket Launcher",
      defaultName: "Rocket Launcher",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: {
        attackKind: "ranged",
        physicalProfileKind: "ranged",
        handsRequired: 2,
        attacksPerAction: 1,
        rangedDamageBase: 20,
        rangeMeters: 100,
        isAreaOfEffect: true,
      },
      visibleNotes: ["Deals Area of Effect damage."],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "armor:clothing",
      category: "armor",
      subtype: "clothing",
      label: "Armor / Clothing Or Robes",
      defaultName: "Clothing / Robes",
      baseProfile: {
        ...createEmptyBonusProfile(),
        derivedBonuses: { initiative: 2 },
      },
      combatSpec: { slotKey: "Chest" },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "armor:light",
      category: "armor",
      subtype: "light",
      label: "Armor / Light",
      defaultName: "Light Armor",
      baseProfile: {
        ...createEmptyBonusProfile(),
        derivedBonuses: {
          initiative: 1,
          damage_reduction: 1,
        },
      },
      combatSpec: { slotKey: "Chest" },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "armor:medium",
      category: "armor",
      subtype: "medium",
      label: "Armor / Medium",
      defaultName: "Medium Armor",
      baseProfile: {
        ...createEmptyBonusProfile(),
        skillBonuses: { stealth: -1 },
        derivedBonuses: { damage_reduction: 2 },
      },
      combatSpec: { slotKey: "Chest" },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "armor:heavy",
      category: "armor",
      subtype: "heavy",
      label: "Armor / Heavy",
      defaultName: "Heavy Armor",
      baseProfile: {
        ...createEmptyBonusProfile(),
        skillBonuses: { stealth: -2 },
        derivedBonuses: {
          initiative: -1,
          damage_reduction: 3,
        },
      },
      combatSpec: { slotKey: "Chest" },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "armor:shield_light",
      category: "armor",
      subtype: "shield_light",
      label: "Shield / Light",
      defaultName: "Light Shield",
      baseProfile: {
        ...createEmptyBonusProfile(),
        derivedBonuses: { damage_reduction: 1 },
      },
      combatSpec: { slotKey: "Hand" },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "armor:shield_heavy",
      category: "armor",
      subtype: "shield_heavy",
      label: "Shield / Heavy",
      defaultName: "Heavy Shield",
      baseProfile: {
        ...createEmptyBonusProfile(),
        derivedBonuses: { damage_reduction: 2 },
      },
      combatSpec: { slotKey: "Hand" },
      visibleNotes: [],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "mystic:focus",
      category: "mystic",
      subtype: "focus",
      label: "Mystic / Occult Focus",
      defaultName: "Occult Focus",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: { slotKey: "Hand", handsRequired: 1 },
      visibleNotes: ["Allows the user to cast spells while holding this item."],
      requirements: [],
    }),
    createBlueprintRecord({
      id: "jewel:jewel",
      category: "jewel",
      subtype: "jewel",
      label: "Legacy / Jewel",
      defaultName: "Jewel",
      baseProfile: createEmptyBonusProfile(),
      combatSpec: null,
      visibleNotes: [],
      requirements: [],
      isLegacy: true,
    }),
  ];
}

export function createEmptyBonusProfile(): BonusProfile {
  return {
    statBonuses: {},
    skillBonuses: {},
    derivedBonuses: {},
    resistanceBonuses: {},
    utilityTraits: [],
    notes: [],
    powerBonuses: {},
    spellBonuses: {},
  };
}

export function cloneBonusProfile(profile: BonusProfile): BonusProfile {
  return {
    statBonuses: { ...profile.statBonuses },
    skillBonuses: { ...profile.skillBonuses },
    derivedBonuses: { ...profile.derivedBonuses },
    resistanceBonuses: { ...profile.resistanceBonuses },
    utilityTraits: [...profile.utilityTraits],
    notes: [...profile.notes],
    powerBonuses: { ...profile.powerBonuses },
    spellBonuses: { ...profile.spellBonuses },
  };
}

export function createEmptyItemBaseOverrideProfile(): ItemBaseOverrideProfile {
  return {};
}

export function cloneItemBaseOverrideProfile(profile: ItemBaseOverrideProfile): ItemBaseOverrideProfile {
  return {
    statBonuses: profile.statBonuses ? { ...profile.statBonuses } : undefined,
    skillBonuses: profile.skillBonuses ? { ...profile.skillBonuses } : undefined,
    derivedBonuses: profile.derivedBonuses ? { ...profile.derivedBonuses } : undefined,
    resistanceBonuses: profile.resistanceBonuses ? { ...profile.resistanceBonuses } : undefined,
    utilityTraits: profile.utilityTraits ? [...profile.utilityTraits] : undefined,
    notes: profile.notes ? [...profile.notes] : undefined,
    powerBonuses: profile.powerBonuses ? { ...profile.powerBonuses } : undefined,
    spellBonuses: profile.spellBonuses ? { ...profile.spellBonuses } : undefined,
  };
}

export function normalizeBonusProfile(value: Partial<BonusProfile> | null | undefined): BonusProfile {
  return {
    statBonuses: normalizeNumericMapValue(value?.statBonuses, { preserveZero: false }) as Partial<Record<StatId, number>>,
    skillBonuses: normalizeNumericMapValue(value?.skillBonuses, { preserveZero: false }),
    derivedBonuses: normalizeNumericMapValue(value?.derivedBonuses, { preserveZero: false }) as Partial<Record<ItemDerivedModifierId, number>>,
    resistanceBonuses: normalizeNumericMapValue(value?.resistanceBonuses, { preserveZero: false }) as Partial<Record<DamageTypeId, number>>,
    utilityTraits: sanitizeStringArray(value?.utilityTraits),
    notes: sanitizeStringArray(value?.notes),
    powerBonuses: normalizeNumericMapValue(value?.powerBonuses, { preserveZero: false }),
    spellBonuses: normalizeNumericMapValue(value?.spellBonuses, { preserveZero: false }),
  };
}

export function normalizeItemBaseOverrideProfile(
  value: Partial<ItemBaseOverrideProfile> | null | undefined
): ItemBaseOverrideProfile {
  const next: ItemBaseOverrideProfile = {};

  if (value?.statBonuses !== undefined) {
    next.statBonuses = normalizeNumericMapValue(value.statBonuses, { preserveZero: true }) as Partial<Record<StatId, number>>;
  }
  if (value?.skillBonuses !== undefined) {
    next.skillBonuses = normalizeNumericMapValue(value.skillBonuses, { preserveZero: true });
  }
  if (value?.derivedBonuses !== undefined) {
    next.derivedBonuses = normalizeNumericMapValue(value.derivedBonuses, { preserveZero: true }) as Partial<Record<ItemDerivedModifierId, number>>;
  }
  if (value?.resistanceBonuses !== undefined) {
    next.resistanceBonuses = normalizeNumericMapValue(value.resistanceBonuses, { preserveZero: true }) as Partial<Record<DamageTypeId, number>>;
  }
  if (value?.utilityTraits !== undefined) {
    next.utilityTraits = sanitizeStringArray(value.utilityTraits);
  }
  if (value?.notes !== undefined) {
    next.notes = sanitizeStringArray(value.notes);
  }
  if (value?.powerBonuses !== undefined) {
    next.powerBonuses = normalizeNumericMapValue(value.powerBonuses, { preserveZero: true });
  }
  if (value?.spellBonuses !== undefined) {
    next.spellBonuses = normalizeNumericMapValue(value.spellBonuses, { preserveZero: true });
  }

  return next;
}

export function isEmptyItemBaseOverrideProfile(profile: ItemBaseOverrideProfile | null | undefined): boolean {
  if (!profile) {
    return true;
  }

  return (
    Object.keys(profile.statBonuses ?? {}).length === 0 &&
    Object.keys(profile.skillBonuses ?? {}).length === 0 &&
    Object.keys(profile.derivedBonuses ?? {}).length === 0 &&
    Object.keys(profile.resistanceBonuses ?? {}).length === 0 &&
    (profile.utilityTraits?.length ?? 0) === 0 &&
    (profile.notes?.length ?? 0) === 0 &&
    Object.keys(profile.powerBonuses ?? {}).length === 0 &&
    Object.keys(profile.spellBonuses ?? {}).length === 0
  );
}

export function combineBonusProfiles(...profiles: Array<BonusProfile | null | undefined>): BonusProfile {
  return profiles.reduce<BonusProfile>((current, profile) => {
    if (!profile) {
      return current;
    }

    const normalized = normalizeBonusProfile(profile);
    return {
      statBonuses: mergeNumericMaps(current.statBonuses as Record<string, number>, normalized.statBonuses as Record<string, number>) as Partial<Record<StatId, number>>,
      skillBonuses: mergeNumericMaps(current.skillBonuses, normalized.skillBonuses),
      derivedBonuses: mergeNumericMaps(current.derivedBonuses as Record<string, number>, normalized.derivedBonuses as Record<string, number>) as Partial<Record<ItemDerivedModifierId, number>>,
      resistanceBonuses: mergeNumericMaps(current.resistanceBonuses as Record<string, number>, normalized.resistanceBonuses as Record<string, number>) as Partial<Record<DamageTypeId, number>>,
      utilityTraits: [...new Set([...current.utilityTraits, ...normalized.utilityTraits])],
      notes: [...new Set([...current.notes, ...normalized.notes])],
      powerBonuses: mergeNumericMaps(current.powerBonuses, normalized.powerBonuses),
      spellBonuses: mergeNumericMaps(current.spellBonuses, normalized.spellBonuses),
    };
  }, createEmptyBonusProfile());
}

function addCustomPropertyTargetToProfile(
  profile: BonusProfile,
  target: ItemCustomPropertyTarget,
  value: number
): BonusProfile {
  if (value === 0) {
    return profile;
  }

  switch (target.type) {
    case "stat":
      return setProfileStatValue(profile, target.id as StatId, (profile.statBonuses[target.id as StatId] ?? 0) + value);
    case "skill":
      return setProfileSkillValue(profile, target.id, (profile.skillBonuses[target.id] ?? 0) + value);
    case "derived":
      return setProfileDerivedValue(
        profile,
        target.id as ItemDerivedModifierId,
        ((profile.derivedBonuses[target.id as ItemDerivedModifierId] ?? 0) + value) as number
      );
    case "resistance":
      return setProfileResistanceValue(
        profile,
        target.id as DamageTypeId,
        ((profile.resistanceBonuses[target.id as DamageTypeId] ?? 0) + value) as number
      );
    case "power":
      return setProfilePowerValue(profile, target.id, (profile.powerBonuses[target.id] ?? 0) + value);
    case "spell":
      return setProfileSpellValue(profile, target.id, (profile.spellBonuses[target.id] ?? 0) + value);
    default:
      return profile;
  }
}

export function buildCustomPropertyBonusProfile(
  customProperties: ItemCustomPropertyRecord[]
): BonusProfile {
  return customProperties.reduce((current, property) => {
    if (property.value === 0 || property.targets.length === 0) {
      return current;
    }

    return property.targets.reduce(
      (profile, target) => addCustomPropertyTargetToProfile(profile, target, property.value),
      current
    );
  }, createEmptyBonusProfile());
}

export function getAutomaticPropertyPointsForBonusProfile(profile: BonusProfile): number {
  const normalized = normalizeBonusProfile(profile);

  const tierOneTotal = Object.entries(normalized.derivedBonuses).reduce((total, [targetId, value]) => {
    if (!TIER_ONE_DERIVED_IDS.has(targetId as ItemDerivedModifierId)) {
      return total;
    }
    return total + value;
  }, 0);

  const tierTwoTotal = Object.entries(normalized.derivedBonuses).reduce((total, [targetId, value]) => {
    if (!TIER_TWO_DERIVED_IDS.has(targetId as ItemDerivedModifierId)) {
      return total;
    }
    return total + value * 2;
  }, 0);

  const statTotal = Object.values(normalized.statBonuses).reduce(
    (total, value) => total + (value ?? 0) * 3,
    0
  );
  const skillTotal = Object.values(normalized.skillBonuses).reduce((total, value) => total + value * 2, 0);
  const resistanceTotal = Object.values(normalized.resistanceBonuses).reduce((total, value) => total + value * 4, 0);
  const powerTotal = Object.values(normalized.powerBonuses).reduce((total, value) => total + value * 6, 0);
  const spellTotal = Object.values(normalized.spellBonuses).reduce((total, value) => total + value * 4, 0);

  return tierOneTotal + tierTwoTotal + statTotal + skillTotal + resistanceTotal + powerTotal + spellTotal;
}

export function getCustomPropertyPoints(customProperties: ItemCustomPropertyRecord[]): number {
  return customProperties.reduce((total, property) => total + normalizeInteger(property.ppCost, 0), 0);
}

export function getItemPropertyPoints(item: SharedItemRecord): number {
  return (
    getAutomaticPropertyPointsForBonusProfile(normalizeBonusProfile(item.bonusProfile)) +
    getCustomPropertyPoints(item.customProperties)
  );
}

export function getItemTierLabelFromPropertyPoints(propertyPoints: number): string {
  const effectivePoints = Math.max(0, propertyPoints);
  return (
    ITEM_TIER_BANDS.find((tier) => effectivePoints >= tier.min && effectivePoints <= tier.max)?.label ??
    MYTHIC_ITEM_TIER
  );
}

export function getItemTierLabel(item: SharedItemRecord): string {
  return item.isArtifact ? ARTIFACT_ITEM_CLASS : getItemTierLabelFromPropertyPoints(getItemPropertyPoints(item));
}

export function createLegacyTierImportProperty(
  qualityTier: string | null,
  itemLevel: number | null,
  bonusProfile: BonusProfile
): ItemCustomPropertyRecord | null {
  const minimumPoints = inferLegacyTierMinimumPropertyPoints(qualityTier, itemLevel);
  const automaticPoints = getAutomaticPropertyPointsForBonusProfile(bonusProfile);
  const remainingPoints = Math.max(0, minimumPoints - automaticPoints);
  const normalizedTier = qualityTier?.trim() ?? "";
  const normalizedTierLower = normalizedTier.toLowerCase();

  if (
    remainingPoints <= 0 &&
    (normalizedTier.length === 0 || normalizedTierLower.includes("common"))
  ) {
    return null;
  }

  return createItemCustomPropertyRecord({
    id: createTimestampedId("legacy-tier"),
    label: "Legacy Tier Import",
    notes:
      normalizedTier.length > 0
        ? `Migrated legacy item tier: ${normalizedTier}`
        : `Migrated legacy item level: ${itemLevel ?? 0}`,
    ppCost: remainingPoints,
    value: 0,
    targets: [],
  });
}

export function applyBaseOverridesToProfile(
  baseProfile: BonusProfile,
  overrides: ItemBaseOverrideProfile | null | undefined
): BonusProfile {
  const normalizedBase = normalizeBonusProfile(baseProfile);
  const normalizedOverrides = normalizeItemBaseOverrideProfile(overrides);

  return {
    statBonuses: applyAbsoluteOverrideMap(
      normalizedBase.statBonuses as Record<string, number>,
      normalizedOverrides.statBonuses as Record<string, number> | undefined
    ) as Partial<Record<StatId, number>>,
    skillBonuses: applyAbsoluteOverrideMap(normalizedBase.skillBonuses, normalizedOverrides.skillBonuses),
    derivedBonuses: applyAbsoluteOverrideMap(
      normalizedBase.derivedBonuses as Record<string, number>,
      normalizedOverrides.derivedBonuses as Record<string, number> | undefined
    ) as Partial<Record<ItemDerivedModifierId, number>>,
    resistanceBonuses: applyAbsoluteOverrideMap(
      normalizedBase.resistanceBonuses as Record<string, number>,
      normalizedOverrides.resistanceBonuses as Record<string, number> | undefined
    ) as Partial<Record<DamageTypeId, number>>,
    utilityTraits:
      normalizedOverrides.utilityTraits !== undefined
        ? [...normalizedOverrides.utilityTraits]
        : [...normalizedBase.utilityTraits],
    notes:
      normalizedOverrides.notes !== undefined
        ? [...normalizedOverrides.notes]
        : [...normalizedBase.notes],
    powerBonuses: applyAbsoluteOverrideMap(normalizedBase.powerBonuses, normalizedOverrides.powerBonuses),
    spellBonuses: applyAbsoluteOverrideMap(normalizedBase.spellBonuses, normalizedOverrides.spellBonuses),
  };
}

const DEFAULT_ITEM_BLUEPRINTS = buildDefaultItemBlueprints();
const DEFAULT_ITEM_BLUEPRINT_INDEX = buildItemBlueprintIndex(DEFAULT_ITEM_BLUEPRINTS);

export function createEmptyItemKnowledgeState() {
  return {
    learnedCharacterIds: [],
    visibleCharacterIds: [],
  };
}

export function normalizeItemKnowledgeState(
  value: Partial<SharedItemRecord["knowledge"]> | null | undefined
): SharedItemRecord["knowledge"] {
  const learnedCharacterIds = sanitizeStringArray(value?.learnedCharacterIds);
  const visibleCharacterIds = sanitizeStringArray(value?.visibleCharacterIds).filter((entry) =>
    learnedCharacterIds.includes(entry)
  );

  return {
    learnedCharacterIds,
    visibleCharacterIds,
  };
}

export function buildItemBlueprintIndex(
  blueprints: ItemBlueprintRecord[]
): Record<string, ItemBlueprintRecord> {
  return Object.fromEntries(blueprints.map((blueprint) => [blueprint.id, blueprint]));
}

export function createDefaultItemBlueprints(): ItemBlueprintRecord[] {
  return DEFAULT_ITEM_BLUEPRINTS.map((blueprint) => ({
    ...blueprint,
    baseProfile: cloneBonusProfile(blueprint.baseProfile),
    combatSpec: cloneCombatSpec(blueprint.combatSpec),
    visibleNotes: [...blueprint.visibleNotes],
    requirements: [...blueprint.requirements],
    overrideItemIds: [...blueprint.overrideItemIds],
  }));
}

export function hydrateItemBlueprintRecord(value: unknown): ItemBlueprintRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawId = typeof record.id === "string" ? record.id : null;
  if (!rawId) {
    return null;
  }

  const blueprintId = normalizeBlueprintId(rawId);
  const fallback = DEFAULT_ITEM_BLUEPRINT_INDEX[blueprintId] ?? null;
  const category = isItemCategory(record.category) ? record.category : fallback?.category ?? "mystic";
  const subtype = isItemSubtype(record.subtype) ? record.subtype : fallback?.subtype ?? "focus";

  return createBlueprintRecord({
    id: blueprintId,
    category,
    subtype,
    label: typeof record.label === "string" ? record.label : fallback?.label ?? blueprintId,
    defaultName:
      typeof record.defaultName === "string"
        ? record.defaultName
        : fallback?.defaultName ?? "Item Blueprint",
    baseProfile: normalizeBonusProfile(record.baseProfile as Partial<BonusProfile> | undefined),
    combatSpec: normalizeItemCombatSpec(record.combatSpec) ?? fallback?.combatSpec ?? null,
    visibleNotes:
      record.visibleNotes !== undefined
        ? sanitizeStringArray(record.visibleNotes)
        : fallback?.visibleNotes ?? [],
    requirements:
      record.requirements !== undefined
        ? sanitizeStringArray(record.requirements)
        : fallback?.requirements ?? [],
    overrideItemIds: sanitizeStringArray(record.overrideItemIds),
    isLegacy: typeof record.isLegacy === "boolean" ? record.isLegacy : fallback?.isLegacy ?? false,
  });
}

function resolveBlueprintRecord(
  blueprintId: ItemBlueprintId,
  itemBlueprints?: ItemBlueprintRecord[]
): ItemBlueprintRecord | null {
  const normalizedId = normalizeBlueprintId(blueprintId);
  const blueprintIndex = itemBlueprints ? buildItemBlueprintIndex(itemBlueprints) : DEFAULT_ITEM_BLUEPRINT_INDEX;
  return blueprintIndex[normalizedId] ?? DEFAULT_ITEM_BLUEPRINT_INDEX[normalizedId] ?? null;
}

export function getItemBlueprintOptions(
  blueprints: ItemBlueprintRecord[]
): Array<{ id: ItemBlueprintId; category: ItemCategory; subtype: ItemBlueprintRecord["subtype"]; label: string; isLegacy?: boolean }> {
  return [...blueprints]
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((blueprint) => ({
      id: blueprint.id,
      category: blueprint.category,
      subtype: blueprint.subtype,
      label: blueprint.label,
      isLegacy: blueprint.isLegacy,
    }));
}

export const ITEM_BLUEPRINT_OPTIONS = getItemBlueprintOptions(createDefaultItemBlueprints()).filter(
  (option) => option.isLegacy !== true
);

export function createItemBlueprintRecord(
  overrides: Partial<ItemBlueprintRecord> = {}
): ItemBlueprintRecord {
  const id =
    typeof overrides.id === "string" && overrides.id.trim().length > 0
      ? normalizeBlueprintId(overrides.id)
      : createTimestampedId("blueprint");
  const category = isItemCategory(overrides.category) ? overrides.category : "mystic";
  const subtype = isItemSubtype(overrides.subtype) ? overrides.subtype : "focus";

  return createBlueprintRecord({
    id,
    category,
    subtype,
    label:
      typeof overrides.label === "string" && overrides.label.trim().length > 0
        ? overrides.label
        : "Custom Blueprint",
    defaultName:
      typeof overrides.defaultName === "string" && overrides.defaultName.trim().length > 0
        ? overrides.defaultName
        : "Custom Item",
    baseProfile: normalizeBonusProfile(overrides.baseProfile),
    combatSpec: cloneCombatSpec(overrides.combatSpec),
    visibleNotes: overrides.visibleNotes ?? [],
    requirements: overrides.requirements ?? [],
    overrideItemIds: overrides.overrideItemIds ?? [],
    isLegacy: overrides.isLegacy ?? false,
  });
}

export function syncSharedItemRecordWithBlueprint(
  item: SharedItemRecord,
  blueprint: ItemBlueprintRecord
): SharedItemRecord {
  const normalizedOverrides = normalizeItemBaseOverrideProfile(item.baseOverrides);
  const normalizedBonusProfile = normalizeBonusProfile(item.bonusProfile);
  const normalizedCustomProperties = normalizeItemCustomPropertyRecords(item.customProperties);
  const baseProfile = applyBaseOverridesToProfile(blueprint.baseProfile, normalizedOverrides);
  const reconciledOverrides = diffItemBaseProfileAgainstBlueprint(baseProfile, blueprint.baseProfile);

  return {
    id: item.id,
    blueprintId: blueprint.id,
    name: item.name.trim().length > 0 ? item.name : blueprint.defaultName,
    isArtifact: item.isArtifact === true,
    category: blueprint.category,
    subtype: blueprint.subtype,
    baseDescription: item.baseDescription?.trim() ?? "",
    combatSpec: cloneCombatSpec(blueprint.combatSpec),
    visibleNotes: [...blueprint.visibleNotes],
    requirements: [...blueprint.requirements],
    baseProfile,
    baseOverrides: reconciledOverrides,
    bonusProfile: normalizedBonusProfile,
    customProperties: normalizedCustomProperties,
    knowledge: normalizeItemKnowledgeState(item.knowledge),
    assignedCharacterId:
      typeof item.assignedCharacterId === "string" && item.assignedCharacterId.trim().length > 0
        ? item.assignedCharacterId
        : null,
  };
}

export function createSharedItemRecord(
  blueprintId: ItemBlueprintId,
  overrides: Partial<
    Pick<
      SharedItemRecord,
      | "id"
      | "name"
      | "isArtifact"
      | "baseDescription"
      | "baseOverrides"
      | "bonusProfile"
      | "customProperties"
      | "knowledge"
      | "assignedCharacterId"
    >
  > = {},
  itemBlueprints?: ItemBlueprintRecord[]
): SharedItemRecord {
  const blueprint =
    resolveBlueprintRecord(blueprintId, itemBlueprints) ??
    createItemBlueprintRecord({
      id: normalizeBlueprintId(blueprintId),
      label: normalizeBlueprintId(blueprintId),
      defaultName: normalizeBlueprintId(blueprintId),
    });

  return syncSharedItemRecordWithBlueprint(
    {
      id: overrides.id ?? createTimestampedId("item"),
      blueprintId: blueprint.id,
      name:
        typeof overrides.name === "string" && overrides.name.trim().length > 0
          ? overrides.name
          : blueprint.defaultName,
      isArtifact: overrides.isArtifact === true,
      category: blueprint.category,
      subtype: blueprint.subtype,
      baseDescription: overrides.baseDescription?.trim() ?? "",
      combatSpec: cloneCombatSpec(blueprint.combatSpec),
      visibleNotes: [...blueprint.visibleNotes],
      requirements: [...blueprint.requirements],
      baseProfile: cloneBonusProfile(blueprint.baseProfile),
      baseOverrides: normalizeItemBaseOverrideProfile(overrides.baseOverrides),
      bonusProfile: normalizeBonusProfile(overrides.bonusProfile),
      customProperties: normalizeItemCustomPropertyRecords(overrides.customProperties),
      knowledge: normalizeItemKnowledgeState(overrides.knowledge),
      assignedCharacterId: overrides.assignedCharacterId ?? null,
    },
    blueprint
  );
}

export function hydrateSharedItemRecord(
  value: unknown,
  itemBlueprints?: ItemBlueprintRecord[]
): SharedItemRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const legacyBlueprintId = inferBlueprintIdFromCategorySubtype(record.category, record.subtype);
  const rawBlueprintId =
    typeof record.blueprintId === "string"
      ? normalizeBlueprintId(record.blueprintId)
      : legacyBlueprintId;
  const blueprint = rawBlueprintId ? resolveBlueprintRecord(rawBlueprintId, itemBlueprints) : null;
  const effectiveBlueprintId = rawBlueprintId ?? blueprint?.id ?? "mystic:focus";
  const legacyQualityTier = typeof record.qualityTier === "string" ? record.qualityTier : null;
  const legacyItemLevel =
    typeof record.itemLevel === "number" && Number.isFinite(record.itemLevel)
      ? Math.max(1, Math.trunc(record.itemLevel))
      : null;
  const hydratedBonusProfile = normalizeBonusProfile(record.bonusProfile as Partial<BonusProfile> | undefined);
  const legacyCustomProperty = record.customProperties === undefined
    ? createLegacyTierImportProperty(legacyQualityTier, legacyItemLevel, hydratedBonusProfile)
    : null;

  const hydrated: SharedItemRecord = {
    id: typeof record.id === "string" ? record.id : createTimestampedId("item"),
    blueprintId: effectiveBlueprintId,
    name: typeof record.name === "string" ? record.name : blueprint?.defaultName ?? "Item",
    isArtifact:
      typeof record.isArtifact === "boolean"
        ? record.isArtifact
        : inferLegacyArtifactFlag(legacyQualityTier),
    category: blueprint?.category ?? (isItemCategory(record.category) ? record.category : "mystic"),
    subtype: blueprint?.subtype ?? (isItemSubtype(record.subtype) ? record.subtype : "focus"),
    baseDescription: typeof record.baseDescription === "string" ? record.baseDescription : "",
    combatSpec: cloneCombatSpec(blueprint?.combatSpec) ?? normalizeItemCombatSpec(record.combatSpec),
    visibleNotes: blueprint?.visibleNotes ? [...blueprint.visibleNotes] : sanitizeStringArray(record.visibleNotes),
    requirements: blueprint?.requirements ? [...blueprint.requirements] : sanitizeStringArray(record.requirements),
    baseProfile:
      record.baseProfile !== undefined
        ? normalizeBonusProfile(record.baseProfile as Partial<BonusProfile>)
        : blueprint
          ? cloneBonusProfile(blueprint.baseProfile)
          : createEmptyBonusProfile(),
    baseOverrides: normalizeItemBaseOverrideProfile(record.baseOverrides as Partial<ItemBaseOverrideProfile> | undefined),
    bonusProfile: hydratedBonusProfile,
    customProperties: legacyCustomProperty
      ? [...normalizeItemCustomPropertyRecords(record.customProperties), legacyCustomProperty]
      : normalizeItemCustomPropertyRecords(record.customProperties),
    knowledge: normalizeItemKnowledgeState(record.knowledge as Partial<SharedItemRecord["knowledge"]> | undefined),
    assignedCharacterId:
      typeof record.assignedCharacterId === "string" && record.assignedCharacterId.trim().length > 0
        ? record.assignedCharacterId
        : null,
  };

  return blueprint ? syncSharedItemRecordWithBlueprint(hydrated, blueprint) : hydrated;
}

export function buildItemIndex(items: SharedItemRecord[]): Record<string, SharedItemRecord> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export function getItemBlueprintId(item: SharedItemRecord): ItemBlueprintId {
  return normalizeBlueprintId(item.blueprintId);
}

export function getItemBlueprintLabel(
  item: SharedItemRecord,
  itemBlueprints?: ItemBlueprintRecord[]
): string {
  return resolveBlueprintRecord(item.blueprintId, itemBlueprints)?.label ?? item.blueprintId;
}

export function getItemBlueprintRecord(
  item: SharedItemRecord,
  itemBlueprints?: ItemBlueprintRecord[]
): ItemBlueprintRecord | null {
  return resolveBlueprintRecord(item.blueprintId, itemBlueprints);
}

export function retypeSharedItemRecord(
  item: SharedItemRecord,
  blueprintId: ItemBlueprintId,
  itemBlueprints?: ItemBlueprintRecord[]
): SharedItemRecord {
  const blueprint = resolveBlueprintRecord(blueprintId, itemBlueprints) ?? createItemBlueprintRecord({ id: blueprintId });

  return syncSharedItemRecordWithBlueprint(
    {
      ...item,
      blueprintId: blueprint.id,
      category: blueprint.category,
      subtype: blueprint.subtype,
      combatSpec: cloneCombatSpec(blueprint.combatSpec),
      visibleNotes: [...blueprint.visibleNotes],
      requirements: [...blueprint.requirements],
      baseProfile: cloneBonusProfile(blueprint.baseProfile),
      baseOverrides: {},
    },
    blueprint
  );
}

function formatSignedNumber(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function getBaseDamageLine(item: SharedItemRecord): string | null {
  const combatSpec = item.combatSpec;
  if (!combatSpec) {
    return null;
  }

  if (combatSpec.attackKind === "melee") {
    const bonus = combatSpec.meleeDamageBonus ?? 0;
    return bonus === 0 ? "Damage: STR" : `Damage: STR ${bonus > 0 ? `+ ${bonus}` : `- ${Math.abs(bonus)}`}`;
  }

  if (combatSpec.attackKind === "ranged" && typeof combatSpec.rangedDamageBase === "number") {
    return combatSpec.isAreaOfEffect === true
      ? `Damage: ${combatSpec.rangedDamageBase}d10 (AoE)`
      : `Damage: ${combatSpec.rangedDamageBase}d10`;
  }

  return null;
}

export function getItemBaseVisibleStats(item: SharedItemRecord): string[] {
  const lines: string[] = [];
  const damageLine = getBaseDamageLine(item);

  if (damageLine) {
    lines.push(damageLine);
  }
  if (item.combatSpec?.attackKind === "ranged" && typeof item.combatSpec.rangeMeters === "number") {
    lines.push(`Range: ${item.combatSpec.rangeMeters}m`);
  }
  if (typeof item.combatSpec?.handsRequired === "number") {
    lines.push(`Hands: ${item.combatSpec.handsRequired}`);
  }
  if (typeof item.combatSpec?.attacksPerAction === "number") {
    lines.push(`Attacks: ${item.combatSpec.attacksPerAction}`);
  }
  if (typeof item.combatSpec?.slotKey === "string" && item.combatSpec.slotKey.trim().length > 0) {
    lines.push(`Slot: ${item.combatSpec.slotKey}`);
  }

  if (item.category === "armor") {
    const initiative = item.baseProfile.derivedBonuses.initiative ?? 0;
    const stealth = item.baseProfile.skillBonuses.stealth ?? 0;
    const dr = item.baseProfile.derivedBonuses.damage_reduction ?? 0;

    if (item.subtype === "clothing" || initiative !== 0) {
      lines.push(`Initiative ${formatSignedNumber(initiative)}`);
    }
    if (item.subtype === "medium" || item.subtype === "heavy" || stealth !== 0) {
      lines.push(`Stealth ${formatSignedNumber(stealth)}`);
    }
    lines.push(`DR ${formatSignedNumber(dr)}`);
  }

  if (item.category === "mystic") {
    lines.push(`Base Mana Bonus: ${formatSignedNumber(item.baseProfile.derivedBonuses.max_mana ?? 0)}`);
  }

  item.visibleNotes.forEach((entry) => lines.push(entry));
  item.requirements.forEach((entry) => lines.push(entry));
  if (item.baseDescription.trim()) {
    lines.push(item.baseDescription.trim());
  }

  return [...new Set(lines)];
}

export function getItemResolvedProfile(item: SharedItemRecord): BonusProfile {
  return combineBonusProfiles(
    item.baseProfile,
    item.bonusProfile,
    buildCustomPropertyBonusProfile(item.customProperties)
  );
}

export function getEquippedItemIds(sheet: CharacterDraft): string[] {
  return (sheet.equipment ?? [])
    .map((entry: CharacterEquipmentReference) => entry.itemId)
    .filter((itemId): itemId is string => typeof itemId === "string" && itemId.length > 0);
}

export function getEquipmentEntryBySlot(sheet: CharacterDraft, slotId: string): CharacterEquipmentReference | null {
  return sheet.equipment.find((entry) => entry.slot === slotId) ?? null;
}

export function getEquipmentItemBySlot(
  sheet: CharacterDraft,
  slotId: string,
  itemsById: Record<string, SharedItemRecord>
): SharedItemRecord | null {
  const itemId = getEquipmentEntryBySlot(sheet, slotId)?.itemId ?? null;
  return itemId ? itemsById[itemId] ?? null : null;
}

export function getWeaponHandSlotLabel(slotId: WeaponHandSlotId): string {
  return WEAPON_HAND_SLOT_LABELS[slotId];
}

export function getOtherEquipmentEntries(sheet: CharacterDraft): CharacterEquipmentReference[] {
  return (sheet.equipment ?? []).filter((entry) => !isWeaponHandSlotId(entry.slot));
}

export function itemOccupiesBothWeaponHands(item: SharedItemRecord | null): boolean {
  return !!item && item.category === "weapon" && item.combatSpec?.handsRequired === 2;
}

export function getEquippedWeaponHandItems(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord>
): Record<WeaponHandSlotId, SharedItemRecord | null> {
  return {
    weapon_primary: getEquipmentItemBySlot(sheet, "weapon_primary", itemsById),
    weapon_secondary: getEquipmentItemBySlot(sheet, "weapon_secondary", itemsById),
  };
}

export function getLegacyEquippedWeaponItems(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord>
): SharedItemRecord[] {
  return (sheet.equipment ?? [])
    .filter((entry) => !WEAPON_HAND_SLOT_IDS.includes(entry.slot as WeaponHandSlotId))
    .map((entry) => (entry.itemId ? itemsById[entry.itemId] ?? null : null))
    .filter((item): item is SharedItemRecord => item !== null && item.category === "weapon");
}

export function getApplicableItemIds(sheet: CharacterDraft): string[] {
  return [...new Set([...getEquippedItemIds(sheet), ...(sheet.activeItemIds ?? [])])];
}

export function buildCharacterItemModifierSources(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord>
): ItemModifierSource[] {
  const itemIds = getApplicableItemIds(sheet);
  const sources: ItemModifierSource[] = [];

  itemIds.forEach((itemId) => {
    const item = itemsById[itemId];
    if (!item) {
      return;
    }

    const profile = getItemResolvedProfile(item);
    const sourceLabel = item.name.trim().length > 0 ? item.name : getItemBlueprintLabel(item);

    Object.entries(profile.statBonuses).forEach(([targetId, value]) => {
      if (typeof value === "number" && value !== 0) {
        sources.push({ targetType: "stat", targetId, value, sourceLabel });
      }
    });
    Object.entries(profile.skillBonuses).forEach(([targetId, value]) => {
      if (typeof value === "number" && value !== 0) {
        sources.push({ targetType: "skill", targetId, value, sourceLabel });
      }
    });
    Object.entries(profile.derivedBonuses).forEach(([targetId, value]) => {
      if (typeof value === "number" && value !== 0) {
        sources.push({ targetType: "derived", targetId, value, sourceLabel });
      }
    });
    Object.entries(profile.resistanceBonuses).forEach(([targetId, value]) => {
      if (typeof value === "number" && value !== 0) {
        sources.push({ targetType: "resistance", targetId, value, sourceLabel });
      }
    });
  });

  return sources;
}

export function getCharacterItemUtilityTraits(
  sheet: CharacterDraft,
  itemsById: Record<string, SharedItemRecord>
): string[] {
  const traits = new Set<string>();

  getApplicableItemIds(sheet).forEach((itemId) => {
    const item = itemsById[itemId];
    if (!item) {
      return;
    }

    getItemResolvedProfile(item).utilityTraits.forEach((trait) => traits.add(trait));
  });

  return [...traits];
}

export function getCharacterArtifactAppraisalLevel(sheet: CharacterDraft): number {
  return sheet.powers.find((power) => power.id === "awareness")?.level ?? 0;
}

export function canCharacterIdentifyItem(item: SharedItemRecord, artifactAppraisalLevel: number): boolean {
  if (item.isArtifact || artifactAppraisalLevel < 1) {
    return false;
  }

  const propertyPoints = Math.max(0, getItemPropertyPoints(item));
  if (propertyPoints <= 4) {
    return artifactAppraisalLevel >= 1;
  }
  if (propertyPoints <= 10) {
    return artifactAppraisalLevel >= 2;
  }
  if (propertyPoints <= 18) {
    return artifactAppraisalLevel >= 3;
  }
  if (propertyPoints <= 30) {
    return artifactAppraisalLevel >= 4;
  }

  return artifactAppraisalLevel >= 5;
}

export function hasCharacterLearnedItem(item: SharedItemRecord, characterId: string): boolean {
  return item.knowledge.learnedCharacterIds.includes(characterId);
}

export function isItemBonusVisibleToCharacter(item: SharedItemRecord, characterId: string): boolean {
  return item.knowledge.visibleCharacterIds.includes(characterId);
}

export function identifyItemForCharacter(item: SharedItemRecord, characterId: string): SharedItemRecord {
  return {
    ...item,
    knowledge: {
      learnedCharacterIds: [...new Set([...item.knowledge.learnedCharacterIds, characterId])],
      visibleCharacterIds: [...new Set([...item.knowledge.visibleCharacterIds, characterId])],
    },
  };
}

export function maskItemForCharacter(item: SharedItemRecord, characterId: string): SharedItemRecord {
  if (!hasCharacterLearnedItem(item, characterId)) {
    return item;
  }

  return {
    ...item,
    knowledge: {
      ...item.knowledge,
      visibleCharacterIds: item.knowledge.visibleCharacterIds.filter((entry) => entry !== characterId),
    },
  };
}

export function shareItemKnowledge(
  item: SharedItemRecord,
  sourceCharacterId: string,
  targetCharacterId: string
): SharedItemRecord {
  if (!hasCharacterLearnedItem(item, sourceCharacterId)) {
    return item;
  }

  return identifyItemForCharacter(item, targetCharacterId);
}

export function getVisibleItemBonusNotes(item: SharedItemRecord, characterId: string): string[] {
  return isItemBonusVisibleToCharacter(item, characterId) ? [...item.bonusProfile.notes] : [];
}

export function inferItemBlueprintId(itemName: string, categoryText: string, slotText = ""): ItemBlueprintId {
  const combined = `${itemName} ${categoryText} ${slotText}`.trim().toLowerCase();

  if (combined.includes("rocket")) return "weapon:rocket_launcher";
  if (combined.includes("chaingun")) return "weapon:chaingun";
  if (combined.includes("shotgun")) return "weapon:shotgun";
  if (combined.includes("heavy crossbow")) return "weapon:crossbow_heavy";
  if (combined.includes("rifle")) return "weapon:rifle";
  if (combined.includes("long bow") || combined.includes("longbow")) return "weapon:bow_long";
  if (combined.includes("pistol")) return "weapon:pistol";
  if (combined.includes("crossbow") || combined.includes("short bow") || combined.includes("bow")) return "weapon:ranged_light";
  if (combined.includes("3-handed") || combined.includes("oversized")) return "weapon:oversized";
  if (combined.includes("two") && combined.includes("hand")) return "weapon:two_handed";
  if (combined.includes("heavy shield")) return "armor:shield_heavy";
  if (combined.includes("shield")) return "armor:shield_light";
  if (combined.includes("medium armor")) return "armor:medium";
  if (combined.includes("light armor")) return "armor:light";
  if (combined.includes("heavy armor")) return "armor:heavy";
  if (combined.includes("clothing") || combined.includes("robe")) return "armor:clothing";
  if (combined.includes("focus") || combined.includes("orb") || combined.includes("wand") || combined.includes("staff") || combined.includes("mystic")) return "mystic:focus";
  if (combined.includes("jewel") || combined.includes("ring") || combined.includes("necklace")) return "jewel:jewel";
  if (combined.includes("unarmed")) return "weapon:unarmed";
  if (combined.includes("brawl") || combined.includes("fist") || combined.includes("gauntlet") || combined.includes("knuckle")) return "weapon:brawl";
  if (combined.includes("weapon") || combined.includes("sword") || combined.includes("mace") || combined.includes("baton") || combined.includes("blade")) return "weapon:one_handed";
  if (combined.includes("armor")) return "armor:light";

  return "mystic:focus";
}

export const STARTER_ITEM_DEFINITIONS: StarterItemDefinition[] = [
  { id: "starter-item-bow", blueprintId: "weapon:ranged_light", name: "Bow" },
  { id: "starter-item-one-handed-sword", blueprintId: "weapon:one_handed", name: "One-Handed Sword" },
  { id: "starter-item-two-handed-sword", blueprintId: "weapon:two_handed", name: "Two-Handed Sword" },
  { id: "starter-item-shield", blueprintId: "armor:shield_light", name: "Shield" },
  { id: "starter-item-armor", blueprintId: "armor:light", name: "Armor" },
];

export function createStarterItemRecords(itemBlueprints?: ItemBlueprintRecord[]): SharedItemRecord[] {
  return STARTER_ITEM_DEFINITIONS.map((definition) =>
    createSharedItemRecord(
      definition.blueprintId,
      {
        id: definition.id,
        name: definition.name,
      },
      itemBlueprints
    )
  );
}

export function ensureStarterItems(items: SharedItemRecord[], itemBlueprints?: ItemBlueprintRecord[]): SharedItemRecord[] {
  const existingIds = new Set(items.map((item) => item.id));
  const missing = createStarterItemRecords(itemBlueprints).filter((item) => !existingIds.has(item.id));
  return missing.length > 0 ? [...items, ...missing] : items;
}

function updateNumericMapValue(current: Record<string, number>, key: string, value: number | null): Record<string, number> {
  const next = { ...current };
  if (value === null || !Number.isFinite(value) || Math.trunc(value) === 0) {
    delete next[key];
    return next;
  }

  next[key] = Math.trunc(value);
  return next;
}

function updateProfileNumericMap<K extends string>(
  profile: BonusProfile,
  field: keyof Pick<
    BonusProfile,
    "statBonuses" | "skillBonuses" | "derivedBonuses" | "resistanceBonuses" | "powerBonuses" | "spellBonuses"
  >,
  key: K,
  value: number | null
): BonusProfile {
  return {
    ...profile,
    [field]: updateNumericMapValue(profile[field] as Record<string, number>, key, value),
  } as BonusProfile;
}

export function setProfileStatValue(profile: BonusProfile, statId: StatId, value: number | null): BonusProfile {
  return updateProfileNumericMap(profile, "statBonuses", statId, value);
}

export function setProfileSkillValue(profile: BonusProfile, skillId: string, value: number | null): BonusProfile {
  return updateProfileNumericMap(profile, "skillBonuses", skillId, value);
}

export function setProfileDerivedValue(profile: BonusProfile, targetId: ItemDerivedModifierId, value: number | null): BonusProfile {
  return updateProfileNumericMap(profile, "derivedBonuses", targetId, value);
}

export function setProfileResistanceValue(profile: BonusProfile, damageTypeId: DamageTypeId, value: number | null): BonusProfile {
  return updateProfileNumericMap(profile, "resistanceBonuses", damageTypeId, value);
}

export function setProfilePowerValue(profile: BonusProfile, powerId: string, value: number | null): BonusProfile {
  return updateProfileNumericMap(profile, "powerBonuses", powerId, value);
}

export function setProfileSpellValue(profile: BonusProfile, spellKey: string, value: number | null): BonusProfile {
  return updateProfileNumericMap(profile, "spellBonuses", spellKey, value);
}

export function setProfileUtilityTraits(profile: BonusProfile, utilityTraits: string[]): BonusProfile {
  return { ...profile, utilityTraits: sanitizeStringArray(utilityTraits) };
}

export function setProfileNotes(profile: BonusProfile, notes: string[]): BonusProfile {
  return { ...profile, notes: sanitizeStringArray(notes) };
}

export function setSharedItemStatBonus(item: SharedItemRecord, statId: StatId, value: number | null): SharedItemRecord {
  return { ...item, bonusProfile: setProfileStatValue(item.bonusProfile, statId, value) };
}

export function setSharedItemSkillBonus(item: SharedItemRecord, skillId: string, value: number | null): SharedItemRecord {
  return { ...item, bonusProfile: setProfileSkillValue(item.bonusProfile, skillId, value) };
}

export function setSharedItemDerivedBonus(item: SharedItemRecord, targetId: ItemDerivedModifierId, value: number | null): SharedItemRecord {
  return { ...item, bonusProfile: setProfileDerivedValue(item.bonusProfile, targetId, value) };
}

export function setSharedItemResistanceBonus(item: SharedItemRecord, damageTypeId: DamageTypeId, value: number | null): SharedItemRecord {
  return { ...item, bonusProfile: setProfileResistanceValue(item.bonusProfile, damageTypeId, value) };
}

export function setSharedItemPowerBonus(item: SharedItemRecord, powerId: string, value: number | null): SharedItemRecord {
  return { ...item, bonusProfile: setProfilePowerValue(item.bonusProfile, powerId, value) };
}

export function setSharedItemSpellBonus(item: SharedItemRecord, spellKey: string, value: number | null): SharedItemRecord {
  return { ...item, bonusProfile: setProfileSpellValue(item.bonusProfile, spellKey, value) };
}

export function setSharedItemNotes(item: SharedItemRecord, notes: string[]): SharedItemRecord {
  return { ...item, bonusProfile: setProfileNotes(item.bonusProfile, notes) };
}

export function setSharedItemUtilityTraits(item: SharedItemRecord, utilityTraits: string[]): SharedItemRecord {
  return { ...item, bonusProfile: setProfileUtilityTraits(item.bonusProfile, utilityTraits) };
}

export function getItemPowerBonusOptions(): ItemOption[] {
  return powerLibrary.map((power) => ({ id: power.id, label: power.name }));
}

export function getItemSpellBonusOptions(): ItemOption[] {
  const spellOptions = new Map<string, ItemOption>();

  powerLibrary.forEach((power) => {
    for (let level = 1; level <= 5; level += 1) {
      getCastPowerVariantOptions({
        id: power.id,
        name: power.name,
        level,
        governingStat: power.governingStat,
      }).forEach((variant) => {
        const optionId = `${power.id}:${variant.id}`;
        if (!spellOptions.has(optionId)) {
          spellOptions.set(optionId, { id: optionId, label: `${power.name} / ${variant.label}` });
        }
      });
    }
  });

  return [...spellOptions.values()];
}

export function getItemPowerBonusLabel(powerId: string): string {
  return getItemPowerBonusOptions().find((option) => option.id === powerId)?.label ?? powerId;
}

export function getItemSpellBonusLabel(spellKey: string): string {
  return getItemSpellBonusOptions().find((option) => option.id === spellKey)?.label ?? spellKey;
}

function summarizeBonusMap(entries: Record<string, number>, getLabel: (id: string) => string): string[] {
  return Object.entries(entries)
    .filter(([, value]) => value !== 0)
    .map(([id, value]) => `${getLabel(id)} ${formatSignedNumber(value)}`);
}

function summarizeCharacterImpact(profile: BonusProfile): string[] {
  return [
    ...Object.entries(profile.statBonuses).map(([statId, value]) => `${statId} ${formatSignedNumber(value ?? 0)}`),
    ...Object.entries(profile.skillBonuses).map(([skillId, value]) => `${skillId} ${formatSignedNumber(value)}`),
    ...Object.entries(profile.derivedBonuses).map(([targetId, value]) => `${targetId} ${formatSignedNumber(value ?? 0)}`),
    ...Object.entries(profile.resistanceBonuses).map(([damageTypeId, value]) => `${damageTypeId} ${formatSignedNumber(value ?? 0)}`),
    ...profile.utilityTraits,
    ...profile.notes,
  ];
}

export function getItemCharacterImpactSummary(item: SharedItemRecord): string[] {
  return summarizeCharacterImpact(
    combineBonusProfiles(item.bonusProfile, buildCustomPropertyBonusProfile(item.customProperties))
  );
}

export function getItemBaseCharacterImpactSummary(item: SharedItemRecord): string[] {
  return summarizeCharacterImpact(normalizeBonusProfile(item.baseProfile));
}

export function getItemPowerBonusSummary(item: SharedItemRecord): string[] {
  return summarizeBonusMap(
    combineBonusProfiles(item.bonusProfile, buildCustomPropertyBonusProfile(item.customProperties)).powerBonuses,
    getItemPowerBonusLabel
  );
}

export function getItemSpellBonusSummary(item: SharedItemRecord): string[] {
  return summarizeBonusMap(
    combineBonusProfiles(item.bonusProfile, buildCustomPropertyBonusProfile(item.customProperties)).spellBonuses,
    getItemSpellBonusLabel
  );
}

function formatCustomPropertyTarget(target: ItemCustomPropertyTarget): string {
  switch (target.type) {
    case "stat":
      return target.id;
    case "skill":
      return `Skill: ${target.id}`;
    case "derived":
      return `Derived: ${target.id}`;
    case "resistance":
      return `Resistance: ${target.id}`;
    case "power":
      return `Power: ${getItemPowerBonusLabel(target.id)}`;
    case "spell":
      return `Spell: ${getItemSpellBonusLabel(target.id)}`;
    default:
      return target.id;
  }
}

export function getItemCustomPropertySummary(item: SharedItemRecord): string[] {
  return item.customProperties.map((property) => {
    const targetSummary =
      property.targets.length > 0
        ? property.targets.map((target) => formatCustomPropertyTarget(target)).join(", ")
        : "Notes only";
    const noteSuffix = property.notes.trim().length > 0 ? ` (${property.notes.trim()})` : "";
    return `${property.label}: ${targetSummary} | Value ${formatSignedNumber(property.value)} | PP ${formatSignedNumber(property.ppCost)}${noteSuffix}`;
  });
}

export function diffItemBaseProfileAgainstBlueprint(baseProfile: BonusProfile, blueprintProfile: BonusProfile): ItemBaseOverrideProfile {
  const next = normalizeBonusProfile(baseProfile);
  const base = normalizeBonusProfile(blueprintProfile);
  const overrides: ItemBaseOverrideProfile = {};

  const buildDiff = (baseMap: Record<string, number>, nextMap: Record<string, number>) =>
    Object.fromEntries(
      [...new Set([...Object.keys(baseMap), ...Object.keys(nextMap)])].flatMap((key) => {
        const nextValue = nextMap[key] ?? 0;
        const baseValue = baseMap[key] ?? 0;
        return nextValue === baseValue ? [] : [[key, nextValue]];
      })
    );

  const statDiff = buildDiff(base.statBonuses as Record<string, number>, next.statBonuses as Record<string, number>);
  if (Object.keys(statDiff).length > 0) overrides.statBonuses = statDiff as Partial<Record<StatId, number>>;
  const skillDiff = buildDiff(base.skillBonuses, next.skillBonuses);
  if (Object.keys(skillDiff).length > 0) overrides.skillBonuses = skillDiff;
  const derivedDiff = buildDiff(base.derivedBonuses as Record<string, number>, next.derivedBonuses as Record<string, number>);
  if (Object.keys(derivedDiff).length > 0) overrides.derivedBonuses = derivedDiff as Partial<Record<ItemDerivedModifierId, number>>;
  const resistanceDiff = buildDiff(base.resistanceBonuses as Record<string, number>, next.resistanceBonuses as Record<string, number>);
  if (Object.keys(resistanceDiff).length > 0) overrides.resistanceBonuses = resistanceDiff as Partial<Record<DamageTypeId, number>>;
  if (!arraysAreEqual(next.utilityTraits, base.utilityTraits)) overrides.utilityTraits = [...next.utilityTraits];
  if (!arraysAreEqual(next.notes, base.notes)) overrides.notes = [...next.notes];
  if (!mapsAreEqual(next.powerBonuses, base.powerBonuses)) overrides.powerBonuses = buildDiff(base.powerBonuses, next.powerBonuses);
  if (!mapsAreEqual(next.spellBonuses, base.spellBonuses)) overrides.spellBonuses = buildDiff(base.spellBonuses, next.spellBonuses);

  return overrides;
}

export function setItemBaseProfileFromBlueprintComparison(item: SharedItemRecord, blueprint: ItemBlueprintRecord, nextBaseProfile: BonusProfile): SharedItemRecord {
  const nextOverrides = diffItemBaseProfileAgainstBlueprint(nextBaseProfile, blueprint.baseProfile);
  return syncSharedItemRecordWithBlueprint({ ...item, baseOverrides: nextOverrides, baseProfile: normalizeBonusProfile(nextBaseProfile) }, blueprint);
}

export function setBlueprintBaseProfile(blueprint: ItemBlueprintRecord, nextBaseProfile: BonusProfile): ItemBlueprintRecord {
  return createBlueprintRecord({ ...blueprint, baseProfile: normalizeBonusProfile(nextBaseProfile) });
}

export function updateBlueprintOverrideList(blueprint: ItemBlueprintRecord, items: SharedItemRecord[]): ItemBlueprintRecord {
  const overrideItemIds = items
    .filter((item) => item.blueprintId === blueprint.id)
    .filter((item) => !isEmptyItemBaseOverrideProfile(item.baseOverrides))
    .map((item) => item.id);

  return { ...blueprint, overrideItemIds: [...new Set(overrideItemIds)] };
}

export function syncItemsWithBlueprint(items: SharedItemRecord[], blueprint: ItemBlueprintRecord): SharedItemRecord[] {
  return items.map((item) => (item.blueprintId === blueprint.id ? syncSharedItemRecordWithBlueprint(item, blueprint) : item));
}
