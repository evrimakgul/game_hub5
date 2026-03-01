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
