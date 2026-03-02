import assert from "node:assert/strict";

import {
  getCrAndRankFromXpUsed,
  SPECIAL_POWER_XP_BY_LEVEL,
  STAT_XP_BY_LEVEL,
  T1_POWER_XP_BY_LEVEL,
  T1_SKILL_XP_BY_LEVEL,
  T2_POWER_XP_BY_LEVEL,
  T2_SKILL_XP_BY_LEVEL,
} from "../src/config/xpTables.ts";
import { runTestSuite } from "./harness.ts";

export async function runXpTablesTests(): Promise<void> {
  await runTestSuite("xpTables", [
    {
      name: "xp tables expose expected milestone values",
      run: () => {
        assert.equal(STAT_XP_BY_LEVEL[3], 6);
        assert.equal(T1_SKILL_XP_BY_LEVEL[5], 23);
        assert.equal(T1_POWER_XP_BY_LEVEL[5], 70);
        assert.equal(T2_SKILL_XP_BY_LEVEL[4], 24);
        assert.equal(T2_POWER_XP_BY_LEVEL[6], 90);
        assert.equal(SPECIAL_POWER_XP_BY_LEVEL[10], 460);
      },
    },
    {
      name: "getCrAndRankFromXpUsed resolves boundary ranges correctly",
      run: () => {
        assert.deepEqual(getCrAndRankFromXpUsed(0), { cr: 0, rank: "F" });
        assert.deepEqual(getCrAndRankFromXpUsed(32), { cr: 0, rank: "F" });
        assert.deepEqual(getCrAndRankFromXpUsed(33), { cr: 1, rank: "E" });
        assert.deepEqual(getCrAndRankFromXpUsed(99), { cr: 3, rank: "D" });
        assert.deepEqual(getCrAndRankFromXpUsed(396), { cr: 12, rank: "A" });
        assert.deepEqual(getCrAndRankFromXpUsed(990), { cr: 30, rank: "A" });
        assert.deepEqual(getCrAndRankFromXpUsed(1500), { cr: 30, rank: "A" });
      },
    },
    {
      name: "getCrAndRankFromXpUsed rejects non-finite input",
      run: () => {
        assert.throws(() => getCrAndRankFromXpUsed(Number.NaN), /finite number/);
        assert.throws(() => getCrAndRankFromXpUsed(Number.POSITIVE_INFINITY), /finite number/);
      },
    },
  ]);
}
