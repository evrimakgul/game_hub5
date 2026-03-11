export function rollD10(random: () => number = Math.random): number {
  return Math.floor(random() * 10) + 1;
}

export function rollD10Faces(poolSize: number, random: () => number = Math.random): number[] {
  return Array.from({ length: Math.max(0, poolSize) }, () => rollD10(random));
}
