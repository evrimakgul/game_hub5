function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number.`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer.`);
  }
}

export const CORE_STATS = ["STR", "DEX", "STAM", "CHA", "APP", "MAN", "INT", "WITS", "PER"] as const;

export type CoreStat = (typeof CORE_STATS)[number];

export const STAT_CATEGORY_CHILDREN = {
  Physical: ["STR", "DEX", "STAM"],
  Social: ["CHA", "APP", "MAN"],
  Mental: ["INT", "WITS", "PER"],
} as const satisfies Record<string, readonly CoreStat[]>;

export type StatCategory = keyof typeof STAT_CATEGORY_CHILDREN;

const STAT_TO_CATEGORY: Record<CoreStat, StatCategory> = {
  STR: "Physical",
  DEX: "Physical",
  STAM: "Physical",
  CHA: "Social",
  APP: "Social",
  MAN: "Social",
  INT: "Mental",
  WITS: "Mental",
  PER: "Mental",
};

export function isCoreStat(value: string): value is CoreStat {
  return CORE_STATS.includes(value as CoreStat);
}

export function getStatCategory(stat: CoreStat): StatCategory {
  return STAT_TO_CATEGORY[stat];
}

export function getStatsForCategory(category: StatCategory): CoreStat[] {
  return [...STAT_CATEGORY_CHILDREN[category]];
}

export function isStatInCategory(stat: CoreStat, category: StatCategory): boolean {
  return getStatCategory(stat) === category;
}

export function isPhysicalStat(stat: CoreStat): boolean {
  return isStatInCategory(stat, "Physical");
}

export function getStatCapForStat(
  stat: CoreStat,
  hasGifted: boolean,
  hasWeakAndMeek: boolean
): number {
  return getStatCap(isPhysicalStat(stat), hasGifted, hasWeakAndMeek);
}

export function getStatCap(
  isPhysical: boolean,
  hasGifted: boolean,
  hasWeakAndMeek: boolean
): number {
  if (hasGifted && hasWeakAndMeek) {
    throw new RangeError("Gifted and Weak and Meek cannot both be active.");
  }

  if (hasWeakAndMeek && isPhysical) {
    return 4;
  }

  if (hasGifted) {
    return 6;
  }

  return 5;
}

export function calculateMaxHP(
  stamina: number,
  extraHpMerits: number = 0,
  permanentlyWoundedFlaws: number = 0
): number {
  assertNonNegativeInteger(stamina, "stamina");
  assertNonNegativeInteger(extraHpMerits, "extraHpMerits");
  assertNonNegativeInteger(permanentlyWoundedFlaws, "permanentlyWoundedFlaws");

  return 2 + stamina * 2 + extraHpMerits - permanentlyWoundedFlaws;
}

export function calculateInitiative(dex: number, wits: number): number {
  assertFiniteNumber(dex, "dex");
  assertFiniteNumber(wits, "wits");

  return dex + wits;
}

export function calculateRangedBonusDice(perception: number): number {
  assertFiniteNumber(perception, "perception");

  return Math.floor((perception - 1) / 2);
}

export function calculateArmorClass(
  dex: number,
  athleticsLevel: number,
  miscBonus: number = 0
): number {
  assertFiniteNumber(dex, "dex");
  assertNonNegativeInteger(athleticsLevel, "athleticsLevel");
  assertFiniteNumber(miscBonus, "miscBonus");

  const athleticsBonus = athleticsLevel >= 3 ? athleticsLevel - 2 : 0;

  return dex + athleticsBonus + miscBonus;
}

export function calculateOccultManaBonus(occultLevel: number, xpUsed: number): number {
  assertNonNegativeInteger(occultLevel, "occultLevel");
  assertFiniteNumber(xpUsed, "xpUsed");

  if (occultLevel >= 5) {
    return Math.ceil(xpUsed / 25);
  }

  if (occultLevel >= 3) {
    return Math.ceil(xpUsed / 50);
  }

  if (occultLevel >= 1) {
    return Math.ceil(xpUsed / 100);
  }

  return 0;
}
