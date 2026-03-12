export function getIncrementCost(table: number[], currentLevel: number): number {
  if (currentLevel >= table.length - 1) {
    return 0;
  }

  return table[currentLevel + 1] - table[currentLevel];
}

export function getDecrementRefund(table: number[], currentLevel: number): number {
  if (currentLevel <= 0) {
    return 0;
  }

  return table[currentLevel] - table[currentLevel - 1];
}
