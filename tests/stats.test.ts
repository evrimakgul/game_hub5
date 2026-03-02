import assert from "node:assert/strict";

import {
  calculateArmorClass,
  calculateInitiative,
  calculateMaxHP,
  calculateOccultManaBonus,
  calculateRangedBonusDice,
  getStatCap,
  getStatCapForStat,
  getStatCategory,
  getStatsForCategory,
  isPhysicalStat,
  isStatInCategory,
} from "../src/config/stats.ts";
import { runTestSuite } from "./harness.ts";

export async function runStatsTests(): Promise<void> {
  await runTestSuite("stats", [
    {
      name: "stat category helpers resolve parent-child relationships",
      run: () => {
        assert.equal(getStatCategory("STR"), "Physical");
        assert.equal(getStatCategory("APP"), "Social");
        assert.equal(getStatCategory("WITS"), "Mental");
        assert.deepEqual(getStatsForCategory("Physical"), ["STR", "DEX", "STAM"]);
        assert.equal(isStatInCategory("MAN", "Social"), true);
        assert.equal(isPhysicalStat("DEX"), true);
        assert.equal(isPhysicalStat("INT"), false);
      },
    },
    {
      name: "stat cap rules respect gifted and weak-and-meek constraints",
      run: () => {
        assert.equal(getStatCap(true, false, false), 5);
        assert.equal(getStatCap(false, true, false), 6);
        assert.equal(getStatCapForStat("STR", false, true), 4);
        assert.equal(getStatCapForStat("INT", false, true), 5);
        assert.throws(() => getStatCap(true, true, true), /cannot both be active/);
      },
    },
    {
      name: "derived stat formulas follow current engine rules",
      run: () => {
        assert.equal(calculateMaxHP(3), 8);
        assert.equal(calculateMaxHP(3, 2, 1), 9);
        assert.equal(calculateInitiative(4, 3), 7);
        assert.equal(calculateRangedBonusDice(1), 0);
        assert.equal(calculateRangedBonusDice(4), 1);
        assert.equal(calculateArmorClass(3, 2), 3);
        assert.equal(calculateArmorClass(3, 5, 2), 8);
      },
    },
    {
      name: "occult mana bonus scales by occult level thresholds",
      run: () => {
        assert.equal(calculateOccultManaBonus(0, 200), 0);
        assert.equal(calculateOccultManaBonus(1, 200), 2);
        assert.equal(calculateOccultManaBonus(3, 200), 4);
        assert.equal(calculateOccultManaBonus(5, 200), 8);
      },
    },
    {
      name: "stat formulas reject invalid numeric inputs",
      run: () => {
        assert.throws(() => calculateMaxHP(-1), /non-negative integer/);
        assert.throws(() => calculateArmorClass(3, -1), /non-negative integer/);
        assert.throws(() => calculateInitiative(Number.NaN, 2), /finite number/);
      },
    },
  ]);
}
