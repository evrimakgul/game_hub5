export type DicePoolResolution = {
  successes: number;
  isBotch: boolean;
};

export type HitResolution = {
  hit: boolean;
  margin: number;
};

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

function assertDieFace(face: number): void {
  if (!Number.isInteger(face) || face < 1 || face > 10) {
    throw new RangeError("face must be an integer from 1 to 10.");
  }
}

export function evaluateDie(face: number, poolSize: number): number {
  assertDieFace(face);
  assertNonNegativeInteger(poolSize, "poolSize");

  if (face === 1) {
    return -1;
  }

  if (face >= 2 && face <= 5) {
    return 0;
  }

  if (face >= 6 && face <= 9) {
    return 1;
  }

  return poolSize < 10 ? 1 : 2;
}

export function resolveDicePool(faces: number[], poolSize: number): DicePoolResolution {
  if (!Array.isArray(faces)) {
    throw new TypeError("faces must be an array.");
  }

  assertNonNegativeInteger(poolSize, "poolSize");

  const successes = faces.reduce((total, face) => total + evaluateDie(face, poolSize), 0);

  return {
    successes,
    isBotch: successes < 0,
  };
}

export function resolveHit(
  attackSuccesses: number,
  targetAC: number,
  attackerIsPlayer: boolean,
  defenderIsPlayer: boolean
): HitResolution {
  assertFiniteNumber(attackSuccesses, "attackSuccesses");
  assertFiniteNumber(targetAC, "targetAC");

  if (attackSuccesses > targetAC) {
    return {
      hit: true,
      margin: attackSuccesses - targetAC,
    };
  }

  if (attackSuccesses < targetAC) {
    return {
      hit: false,
      margin: 0,
    };
  }

  if (attackerIsPlayer && !defenderIsPlayer) {
    return {
      hit: true,
      margin: 0,
    };
  }

  return {
    hit: false,
    margin: 0,
  };
}

export function resolvePhysicalDamage(damageSuccesses: number, targetDR: number): number {
  assertFiniteNumber(damageSuccesses, "damageSuccesses");
  assertFiniteNumber(targetDR, "targetDR");

  return Math.max(0, damageSuccesses - targetDR);
}

export function resolveMagicalDamage(rawDamage: number, targetSoak: number): number {
  assertFiniteNumber(rawDamage, "rawDamage");
  assertFiniteNumber(targetSoak, "targetSoak");

  return Math.max(0, rawDamage - targetSoak);
}

export function applyElementalResistance(totalDamage: number, stamina: number): number {
  assertFiniteNumber(totalDamage, "totalDamage");
  assertFiniteNumber(stamina, "stamina");

  return Math.max(0, Math.ceil(totalDamage / 2 - stamina));
}
