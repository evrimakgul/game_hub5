import assert from "node:assert/strict";

import { applyDamageToSheet, applyHealingToSheet } from "../src/rules/combatResolution.ts";
import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import { runTestSuite } from "./harness.ts";

export async function runCombatResolutionTests(): Promise<void> {
  await runTestSuite("combatResolution", [
    {
      name: "damage can drive HP below zero and temporary HP is absorbed first",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.currentHp = 4;
        sheet.temporaryHp = 3;

        const result = applyDamageToSheet(sheet, {
          rawAmount: 12,
          damageType: "shadow",
          mitigationChannel: "soak",
        });

        assert.equal(result.sheet.temporaryHp, 0);
        assert.equal(result.sheet.currentHp, -3);
        assert.equal(result.appliedDamage, 7);
      },
    },
    {
      name: "healing from negative HP does not clamp to zero before applying the heal amount",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.currentHp = -5;

        const result = applyHealingToSheet(sheet, 3);

        assert.equal(result.sheet.currentHp, -2);
        assert.equal(result.appliedAmount, 3);
      },
    },
  ]);
}


