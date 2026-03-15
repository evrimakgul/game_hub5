import assert from "node:assert/strict";

import {
  applyDamageToSheet,
  applyHealingToSheet,
  isUndeadSheet,
} from "../src/rules/combatResolution.ts";
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
    {
      name: "healing overflow grants temporary HP up to the provided cap",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.statState.STAM.base = 3;
        sheet.currentHp = 7;

        const result = applyHealingToSheet(sheet, 5, {
          temporaryHpCap: 2,
        });

        assert.equal(result.sheet.currentHp, 8);
        assert.equal(result.sheet.temporaryHp, 2);
        assert.equal(result.appliedAmount, 3);
      },
    },
    {
      name: "undead sheet detection only matches undead-tagged sheets",
      run: () => {
        const undeadSheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        undeadSheet.statusTags = [{ id: "undead", label: "Undead" }];

        const shadowSheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        shadowSheet.statusTags = [{ id: "shadow", label: "Shadow" }];

        assert.equal(isUndeadSheet(undeadSheet), true);
        assert.equal(isUndeadSheet(shadowSheet), false);
      },
    },
  ]);
}


