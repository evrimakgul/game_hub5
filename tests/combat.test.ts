import assert from "node:assert/strict";

import {
  applyElementalResistance,
  evaluateDie,
  resolveDicePool,
  resolveHit,
  resolveMagicalDamage,
  resolvePhysicalDamage,
} from "../src/config/combat.ts";
import { runTestSuite } from "./harness.ts";

export async function runCombatTests(): Promise<void> {
  await runTestSuite("combat", [
    {
      name: "evaluateDie follows the d10 success table",
      run: () => {
        assert.equal(evaluateDie(1, 5), -1);
        assert.equal(evaluateDie(5, 5), 0);
        assert.equal(evaluateDie(6, 5), 1);
        assert.equal(evaluateDie(10, 5), 1);
        assert.equal(evaluateDie(10, 10), 2);
      },
    },
    {
      name: "resolveDicePool totals successes and detects botches",
      run: () => {
        assert.deepEqual(resolveDicePool([1, 1, 7], 3), { successes: -1, isBotch: true });
        assert.deepEqual(resolveDicePool([6, 8, 10], 10), { successes: 4, isBotch: false });
      },
    },
    {
      name: "resolveHit applies tie-break rules for player versus non-player",
      run: () => {
        assert.deepEqual(resolveHit(5, 4, true, false), { hit: true, margin: 1 });
        assert.deepEqual(resolveHit(3, 4, true, false), { hit: false, margin: 0 });
        assert.deepEqual(resolveHit(4, 4, true, false), { hit: true, margin: 0 });
        assert.deepEqual(resolveHit(4, 4, false, true), { hit: false, margin: 0 });
        assert.deepEqual(resolveHit(4, 4, true, true), { hit: false, margin: 0 });
      },
    },
    {
      name: "damage resolution clamps at zero",
      run: () => {
        assert.equal(resolvePhysicalDamage(7, 2), 5);
        assert.equal(resolvePhysicalDamage(2, 7), 0);
        assert.equal(resolveMagicalDamage(9, 3), 6);
        assert.equal(resolveMagicalDamage(3, 9), 0);
        assert.equal(applyElementalResistance(10, 2), 3);
        assert.equal(applyElementalResistance(2, 5), 0);
      },
    },
    {
      name: "combat helpers reject invalid values",
      run: () => {
        assert.throws(() => evaluateDie(0, 1), /integer from 1 to 10/);
        assert.throws(() => resolveDicePool([1, 2], -1), /non-negative integer/);
        assert.throws(() => resolveMagicalDamage(Number.NaN, 2), /finite number/);
      },
    },
  ]);
}
