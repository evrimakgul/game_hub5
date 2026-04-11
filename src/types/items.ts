import type { DamageTypeId } from "../rules/resistances.ts";
import type { StatId } from "./character.ts";

export const ITEM_CATEGORIES = [
  "melee",
  "body_armor",
  "consumable",
  "shield",
  "neck",
  "rings",
  "occult",
  "range",
  "head",
  "orbital",
  "charm",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const MELEE_SUBTYPES = [
  "unarmed",
  "brawl",
  "one_handed",
  "two_handed",
  "oversized",
] as const;
export type MeleeSubtype = (typeof MELEE_SUBTYPES)[number];

export const BODY_ARMOR_SUBTYPES = [
  "clothing",
  "light",
  "medium",
  "heavy",
] as const;
export type BodyArmorSubtype = (typeof BODY_ARMOR_SUBTYPES)[number];

export const CONSUMABLE_SUBTYPES = ["drinkable", "usable"] as const;
export type ConsumableSubtype = (typeof CONSUMABLE_SUBTYPES)[number];

export const SHIELD_SUBTYPES = ["light", "heavy"] as const;
export type ShieldSubtype = (typeof SHIELD_SUBTYPES)[number];

export const NECK_SUBTYPES = ["wearable", "amulet"] as const;
export type NeckSubtype = (typeof NECK_SUBTYPES)[number];

export const RINGS_SUBTYPES = ["ring", "earring"] as const;
export type RingsSubtype = (typeof RINGS_SUBTYPES)[number];

export const OCCULT_SUBTYPES = ["one_handed", "two_handed"] as const;
export type OccultSubtype = (typeof OCCULT_SUBTYPES)[number];

export const RANGE_SUBTYPES = ["bow", "crossbow", "gun", "launcher"] as const;
export type RangeSubtype = (typeof RANGE_SUBTYPES)[number];

export const HEAD_SUBTYPES = ["head"] as const;
export type HeadSubtype = (typeof HEAD_SUBTYPES)[number];

export const ORBITAL_SUBTYPES = ["orbital"] as const;
export type OrbitalSubtype = (typeof ORBITAL_SUBTYPES)[number];

export const CHARM_SUBTYPES = ["talisman"] as const;
export type CharmSubtype = (typeof CHARM_SUBTYPES)[number];

export const ITEM_DERIVED_MODIFIER_IDS = [
  "max_hp",
  "max_mana",
  "initiative",
  "inspiration",
  "attack_dice_bonus",
  "melee_attack",
  "ranged_attack",
  "armor_class",
  "damage_reduction",
  "soak",
  "melee_damage",
  "ranged_damage",
] as const;
export type ItemDerivedModifierId = (typeof ITEM_DERIVED_MODIFIER_IDS)[number];

export type ItemSubtype =
  | MeleeSubtype
  | BodyArmorSubtype
  | ConsumableSubtype
  | ShieldSubtype
  | NeckSubtype
  | RingsSubtype
  | OccultSubtype
  | RangeSubtype
  | HeadSubtype
  | OrbitalSubtype
  | CharmSubtype;

export const ITEM_CUSTOM_PROPERTY_TARGET_TYPES = [
  "stat",
  "skill",
  "derived",
  "resistance",
  "power",
  "spell",
] as const;
export type ItemCustomPropertyTargetType = (typeof ITEM_CUSTOM_PROPERTY_TARGET_TYPES)[number];

export type ItemCustomPropertyTarget = {
  type: ItemCustomPropertyTargetType;
  id: string;
};

export type ItemCustomPropertyRecord = {
  id: string;
  label: string;
  notes: string;
  ppCost: number;
  value: number;
  targets: ItemCustomPropertyTarget[];
};

export type BonusProfile = {
  statBonuses: Partial<Record<StatId, number>>;
  skillBonuses: Record<string, number>;
  derivedBonuses: Partial<Record<ItemDerivedModifierId, number>>;
  resistanceBonuses: Partial<Record<DamageTypeId, number>>;
  utilityTraits: string[];
  notes: string[];
  powerBonuses: Record<string, number>;
  spellBonuses: Record<string, number>;
};

export type ItemBaseOverrideProfile = {
  statBonuses?: Partial<Record<StatId, number>>;
  skillBonuses?: Record<string, number>;
  derivedBonuses?: Partial<Record<ItemDerivedModifierId, number>>;
  resistanceBonuses?: Partial<Record<DamageTypeId, number>>;
  utilityTraits?: string[];
  notes?: string[];
  powerBonuses?: Record<string, number>;
  spellBonuses?: Record<string, number>;
};

export type ItemKnowledgeState = {
  learnedCharacterIds: string[];
  visibleCharacterIds: string[];
};

export type ItemAttackKind = "melee" | "ranged";
export type ItemPhysicalProfileKind =
  | "unarmed"
  | "brawl"
  | "one_handed"
  | "two_handed"
  | "oversized"
  | "ranged";

export type ItemCombatSpec = {
  attackKind?: ItemAttackKind;
  physicalProfileKind?: ItemPhysicalProfileKind;
  handsRequired?: 1 | 2;
  attacksPerAction?: number;
  meleeDamageBonus?: number;
  rangedDamageBase?: number;
  rangeMeters?: number;
  minimumStrength?: number;
  isAreaOfEffect?: boolean;
  slotKey?: string;
};

export type ItemBlueprintId = string;

export type ItemBlueprintRecord = {
  id: ItemBlueprintId;
  category: ItemCategory;
  subtype: ItemSubtype;
  label: string;
  defaultName: string;
  baseProfile: BonusProfile;
  combatSpec: ItemCombatSpec | null;
  visibleNotes: string[];
  requirements: string[];
  overrideItemIds: string[];
  isLegacy?: boolean;
};

export type SharedItemRecord = {
  id: string;
  blueprintId: ItemBlueprintId;
  name: string;
  isArtifact: boolean;
  category: ItemCategory;
  subtype: ItemSubtype;
  baseDescription: string;
  combatSpec: ItemCombatSpec | null;
  visibleNotes: string[];
  requirements: string[];
  baseProfile: BonusProfile;
  baseOverrides: ItemBaseOverrideProfile;
  bonusProfile: BonusProfile;
  customProperties: ItemCustomPropertyRecord[];
  knowledge: ItemKnowledgeState;
  assignedCharacterId: string | null;
};

export type ItemInstanceRecord = SharedItemRecord;

export type CharacterEquipmentReference = {
  slot: string;
  itemId: string | null;
};

export const MAIN_EQUIPMENT_SLOT_IDS = [
  "weapon_primary",
  "weapon_secondary",
  "ring_left",
  "ring_right",
  "body",
  "neck",
  "head",
] as const;
export type MainEquipmentSlotId = (typeof MAIN_EQUIPMENT_SLOT_IDS)[number];

export const MAIN_EQUIPMENT_SLOT_LABELS: Record<MainEquipmentSlotId, string> = {
  weapon_primary: "Primary Hand",
  weapon_secondary: "Secondary Hand",
  ring_left: "Left Ring",
  ring_right: "Right Ring",
  body: "Chest / Body",
  neck: "Neck",
  head: "Head",
};

export function isMainEquipmentSlotId(value: unknown): value is MainEquipmentSlotId {
  return typeof value === "string" && MAIN_EQUIPMENT_SLOT_IDS.includes(value as MainEquipmentSlotId);
}

export const SUPPLEMENTARY_EQUIPMENT_SLOT_IDS = ["orbital", "earring", "charm"] as const;
export type SupplementaryEquipmentSlotId = (typeof SUPPLEMENTARY_EQUIPMENT_SLOT_IDS)[number];

export const SUPPLEMENTARY_EQUIPMENT_SLOT_LABELS: Record<SupplementaryEquipmentSlotId, string> = {
  orbital: "Orbital",
  earring: "Earring",
  charm: "Charm / Talisman",
};

export const CANONICAL_EQUIPMENT_SLOT_IDS = [
  ...MAIN_EQUIPMENT_SLOT_IDS,
  ...SUPPLEMENTARY_EQUIPMENT_SLOT_IDS,
] as const;
export type CanonicalEquipmentSlotId = (typeof CANONICAL_EQUIPMENT_SLOT_IDS)[number];

export function isSupplementaryEquipmentSlotId(value: unknown): value is SupplementaryEquipmentSlotId {
  return typeof value === "string" && SUPPLEMENTARY_EQUIPMENT_SLOT_IDS.includes(value as SupplementaryEquipmentSlotId);
}

export function isCanonicalEquipmentSlotId(value: unknown): value is CanonicalEquipmentSlotId {
  return typeof value === "string" && CANONICAL_EQUIPMENT_SLOT_IDS.includes(value as CanonicalEquipmentSlotId);
}

export const WEAPON_HAND_SLOT_IDS = ["weapon_primary", "weapon_secondary"] as const;
export type WeaponHandSlotId = (typeof WEAPON_HAND_SLOT_IDS)[number];

export const WEAPON_HAND_SLOT_LABELS: Record<WeaponHandSlotId, string> = {
  weapon_primary: "Primary Hand",
  weapon_secondary: "Secondary Hand",
};

export function isWeaponHandSlotId(value: unknown): value is WeaponHandSlotId {
  return typeof value === "string" && WEAPON_HAND_SLOT_IDS.includes(value as WeaponHandSlotId);
}

export type ItemModifierSource = {
  targetType: "stat" | "skill" | "derived" | "resistance";
  targetId: string;
  value: number;
  sourceLabel: string;
};

export function isItemCategory(value: unknown): value is ItemCategory {
  return typeof value === "string" && ITEM_CATEGORIES.includes(value as ItemCategory);
}

export function isMeleeSubtype(value: unknown): value is MeleeSubtype {
  return typeof value === "string" && MELEE_SUBTYPES.includes(value as MeleeSubtype);
}

export function isBodyArmorSubtype(value: unknown): value is BodyArmorSubtype {
  return typeof value === "string" && BODY_ARMOR_SUBTYPES.includes(value as BodyArmorSubtype);
}

export function isItemSubtype(value: unknown): value is ItemSubtype {
  return (
    isMeleeSubtype(value) ||
    isBodyArmorSubtype(value) ||
    (typeof value === "string" && CONSUMABLE_SUBTYPES.includes(value as ConsumableSubtype)) ||
    (typeof value === "string" && SHIELD_SUBTYPES.includes(value as ShieldSubtype)) ||
    (typeof value === "string" && NECK_SUBTYPES.includes(value as NeckSubtype)) ||
    (typeof value === "string" && RINGS_SUBTYPES.includes(value as RingsSubtype)) ||
    (typeof value === "string" && OCCULT_SUBTYPES.includes(value as OccultSubtype)) ||
    (typeof value === "string" && RANGE_SUBTYPES.includes(value as RangeSubtype)) ||
    (typeof value === "string" && HEAD_SUBTYPES.includes(value as HeadSubtype)) ||
    (typeof value === "string" && ORBITAL_SUBTYPES.includes(value as OrbitalSubtype)) ||
    (typeof value === "string" && CHARM_SUBTYPES.includes(value as CharmSubtype))
  );
}
