import assert from "node:assert/strict";

import { resolveCombatWorkflow } from "../src/config/combatWorkflow.ts";
import { runTestSuite } from "./harness.ts";

export async function runCombatWorkflowTests(): Promise<void> {
  await runTestSuite("combatWorkflow", [
    {
      name: "combat workflow logs misses cleanly",
      run: () => {
        const result = resolveCombatWorkflow({
          attackerName: "Mira",
          defenderName: "Shade",
          attackSuccesses: 3,
          targetArmorClass: 4,
          attackerIsPlayer: true,
          defenderIsPlayer: false,
          damageInput: 5,
          mitigation: 1,
          damageMode: "physical",
        });

        assert.equal(result.hit, false);
        assert.equal(result.damage, 0);
        assert.equal(result.message, "Mira misses Shade.");
      },
    },
    {
      name: "combat workflow logs physical hits with reduced damage",
      run: () => {
        const result = resolveCombatWorkflow({
          attackerName: "Mira",
          defenderName: "Shade",
          attackSuccesses: 6,
          targetArmorClass: 4,
          attackerIsPlayer: true,
          defenderIsPlayer: false,
          damageInput: 5,
          mitigation: 2,
          damageMode: "physical",
        });

        assert.equal(result.hit, true);
        assert.equal(result.margin, 2);
        assert.equal(result.damage, 3);
        assert.equal(result.message, "Mira hits Shade for 3 physical damage.");
      },
    },
  ]);
}
