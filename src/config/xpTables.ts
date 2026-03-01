// Index = level (0 unused)
export const STAT_XP_BY_LEVEL: number[] = [0, 0, 0, 6, 15, 27, 42, 60, 81, 105, 132];

export const T1_SKILL_XP_BY_LEVEL: number[] = [0, 3, 5, 9, 15, 23, 33, 45, 59, 75, 93];

export const T1_POWER_XP_BY_LEVEL: number[] = [0, 10, 16, 28, 46, 70, 100, 136, 178, 226, 280];

export const T2_SKILL_XP_BY_LEVEL: number[] = [0, 0, 4, 12, 24, 40, 60, 84, 112, 144, 180];

export const T2_POWER_XP_BY_LEVEL: number[] = [0, 0, 6, 18, 36, 60, 90, 126, 168, 216, 270];

export const SPECIAL_POWER_XP_BY_LEVEL: number[] = [0, 10, 20, 40, 70, 110, 160, 220, 290, 370, 460];

export type XpUsedRange = {
  min: number;
  max: number | null;
  cr: number;
  rank: string;
};

// MUST be sorted by min ascending
export const XP_USED_RANGES: XpUsedRange[] = [
  { min: 0, max: 32, cr: 0, rank: "F" },
  { min: 33, max: 65, cr: 1, rank: "E" },
  { min: 66, max: 98, cr: 2, rank: "E" },
  { min: 99, max: 131, cr: 3, rank: "D" },
  { min: 132, max: 164, cr: 4, rank: "D" },
  { min: 165, max: 197, cr: 5, rank: "C" },
  { min: 198, max: 230, cr: 6, rank: "C" },
  { min: 231, max: 263, cr: 7, rank: "C" },
  { min: 264, max: 296, cr: 8, rank: "B" },
  { min: 297, max: 329, cr: 9, rank: "B" },
  { min: 330, max: 362, cr: 10, rank: "B" },
  { min: 363, max: 395, cr: 11, rank: "B" },
  { min: 396, max: 428, cr: 12, rank: "A" },
  { min: 429, max: 461, cr: 13, rank: "A" },
  { min: 462, max: 494, cr: 14, rank: "A" },
  { min: 495, max: 527, cr: 15, rank: "A" },
  { min: 528, max: 560, cr: 16, rank: "A" },
  { min: 561, max: 593, cr: 17, rank: "A" },
  { min: 594, max: 626, cr: 18, rank: "A" },
  { min: 627, max: 659, cr: 19, rank: "A" },
  { min: 660, max: 692, cr: 20, rank: "A" },
  { min: 693, max: 725, cr: 21, rank: "A" },
  { min: 726, max: 758, cr: 22, rank: "A" },
  { min: 759, max: 791, cr: 23, rank: "A" },
  { min: 792, max: 824, cr: 24, rank: "A" },
  { min: 825, max: 857, cr: 25, rank: "A" },
  { min: 858, max: 890, cr: 26, rank: "A" },
  { min: 891, max: 923, cr: 27, rank: "A" },
  { min: 924, max: 956, cr: 28, rank: "A" },
  { min: 957, max: 989, cr: 29, rank: "A" },
  { min: 990, max: null, cr: 30, rank: "A" },
];

export function getCrAndRankFromXpUsed(xpUsed: number): { cr: number; rank: string } {
  if (!Number.isFinite(xpUsed)) {
    throw new RangeError("xpUsed must be a finite number.");
  }

  for (const range of XP_USED_RANGES) {
    if (xpUsed < range.min) {
      continue;
    }

    if (range.max === null || xpUsed <= range.max) {
      return { cr: range.cr, rank: range.rank };
    }
  }

  throw new RangeError(`No CR/rank mapping found for xpUsed=${xpUsed}.`);
}
