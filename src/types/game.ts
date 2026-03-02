export const CORE_STAT_IDS = ["STR", "DEX", "STAM", "CHA", "APP", "MAN", "INT", "WITS", "PER"] as const;

export type CoreStatId = (typeof CORE_STAT_IDS)[number];

export const STAT_CATEGORY_IDS = ["physical", "social", "mental"] as const;

export type StatCategoryId = (typeof STAT_CATEGORY_IDS)[number];

export const STAT_CATEGORY_CHILDREN: Record<StatCategoryId, readonly CoreStatId[]> = {
  physical: ["STR", "DEX", "STAM"],
  social: ["CHA", "APP", "MAN"],
  mental: ["INT", "WITS", "PER"],
};

export const SKILL_IDS = [
  "melee",
  "ranged",
  "athletics",
  "stealth",
  "alertness",
  "intimidation",
  "social",
  "medicine",
  "technology",
  "academics",
  "mechanics",
  "occultism",
  "archery_or_guns",
  "energy_weapons",
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export const POWER_IDS = [
  "awareness",
  "body_reinforcement",
  "crowd_control",
  "elementalist",
  "healing",
  "light_support",
  "necromancy",
  "shadow_control",
] as const;

export type PowerId = (typeof POWER_IDS)[number];

export const EQUIPMENT_SLOTS = [
  "head",
  "neck",
  "body",
  "right_hand",
  "left_hand",
  "ring_right",
  "ring_left",
] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export const ITEM_BODY_PARTS = [
  "hands",
  "head",
  "neck",
  "fingers",
  "upper_body",
  "orbital",
  "none",
] as const;

export type ItemBodyPart = (typeof ITEM_BODY_PARTS)[number];

export const ITEM_SPECS = ["none", "single_use", "permanent"] as const;

export type ItemSpec = (typeof ITEM_SPECS)[number];

export const ITEM_TYPES = [
  "none",
  "one_handed_weapon",
  "two_handed_weapon",
  "shield",
  "brawl_item",
  "amulet",
  "ring",
  "occult",
  "armor",
  "bow",
  "crossbow",
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_QUALITIES = [
  "common",
  "uncommon",
  "masterwork",
  "rare",
  "epic",
  "legendary",
  "mythical",
  "celestial",
  "demonic",
  "artifact",
] as const;

export type ItemQuality = (typeof ITEM_QUALITIES)[number];

export const ACTION_TYPES = ["standard", "bonus", "move", "reaction", "free"] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export type CharacterId = string;
export type ProfileId = string;
export type EncounterId = string;
export type ParticipantId = string;
export type ItemTemplateId = string;
export type ItemInstanceId = string;
export type StatusEffectId = string;
export type CombatLogEntryId = string;
export type ISODateString = string;
export type NumericFormula = string;
