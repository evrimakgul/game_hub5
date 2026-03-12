export const STAT_IDS = ["STR", "DEX", "STAM", "CHA", "APP", "MAN", "INT", "WITS", "PER"] as const;
export type StatId = (typeof STAT_IDS)[number];

export const CHARACTER_OWNER_ROLES = ["player", "dm"] as const;
export type CharacterOwnerRole = (typeof CHARACTER_OWNER_ROLES)[number];

export type CharacterRecord = {
  id: string;
  ownerRole: CharacterOwnerRole;
  sheet: import("../config/characterTemplate").CharacterDraft;
};

export function isStatId(value: unknown): value is StatId {
  return typeof value === "string" && STAT_IDS.includes(value as StatId);
}

export function isCharacterOwnerRole(value: unknown): value is CharacterOwnerRole {
  return typeof value === "string" && CHARACTER_OWNER_ROLES.includes(value as CharacterOwnerRole);
}
