import type { DamageTypeId } from "../rules/resistances.ts";
import type { StatId } from "./character.ts";

export const ITEM_CATEGORIES = ["weapon", "armor", "jewel", "mystic"] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const WEAPON_SUBTYPES = [
  "brawl",
  "one_handed",
  "two_handed",
  "oversized",
  "bow",
] as const;
export type WeaponSubtype = (typeof WEAPON_SUBTYPES)[number];

export const ARMOR_SUBTYPES = ["light", "heavy"] as const;
export type ArmorSubtype = (typeof ARMOR_SUBTYPES)[number];

export const ITEM_DERIVED_MODIFIER_IDS = [
  "max_hp",
  "max_mana",
  "initiative",
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

export type ItemSubtype = WeaponSubtype | ArmorSubtype | "jewel" | "mystic";

export type BonusProfile = {
  statBonuses: Partial<Record<StatId, number>>;
  skillBonuses: Record<string, number>;
  derivedBonuses: Partial<Record<ItemDerivedModifierId, number>>;
  resistanceBonuses: Partial<Record<DamageTypeId, number>>;
  utilityTraits: string[];
  notes: string[];
  powerBonuses: Record<string, number>;
};

export type ItemKnowledgeState = {
  learnedCharacterIds: string[];
  visibleCharacterIds: string[];
};

export type SharedItemRecord = {
  id: string;
  name: string;
  itemLevel: number;
  qualityTier: string | null;
  category: ItemCategory;
  subtype: ItemSubtype;
  baseDescription: string;
  bonusProfile: BonusProfile;
  knowledge: ItemKnowledgeState;
};

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

export type ItemBlueprintId =
  | "weapon:brawl"
  | "weapon:one_handed"
  | "weapon:two_handed"
  | "weapon:oversized"
  | "weapon:bow"
  | "armor:light"
  | "armor:heavy"
  | "jewel:jewel"
  | "mystic:mystic";

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
  return (
    value === "jewel" ||
    value === "mystic" ||
    isWeaponSubtype(value) ||
    isArmorSubtype(value)
  );
}
