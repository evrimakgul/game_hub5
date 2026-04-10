import type { DamageTypeId } from "../rules/resistances.ts";
import type { StatId } from "./character.ts";

export const ITEM_CATEGORIES = ["weapon", "armor", "jewel", "mystic"] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const WEAPON_SUBTYPES = [
  "unarmed",
  "brawl",
  "one_handed",
  "two_handed",
  "oversized",
  "ranged_light",
  "pistol",
  "bow_long",
  "rifle",
  "crossbow_heavy",
  "shotgun",
  "chaingun",
  "rocket_launcher",
] as const;
export type WeaponSubtype = (typeof WEAPON_SUBTYPES)[number];

export const ARMOR_SUBTYPES = [
  "clothing",
  "light",
  "medium",
  "heavy",
  "shield_light",
  "shield_heavy",
] as const;
export type ArmorSubtype = (typeof ARMOR_SUBTYPES)[number];

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

export type ItemSubtype = WeaponSubtype | ArmorSubtype | "jewel" | "focus";

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

export function isWeaponSubtype(value: unknown): value is WeaponSubtype {
  return typeof value === "string" && WEAPON_SUBTYPES.includes(value as WeaponSubtype);
}

export function isArmorSubtype(value: unknown): value is ArmorSubtype {
  return typeof value === "string" && ARMOR_SUBTYPES.includes(value as ArmorSubtype);
}

export function isItemSubtype(value: unknown): value is ItemSubtype {
  return value === "jewel" || value === "focus" || isWeaponSubtype(value) || isArmorSubtype(value);
}
