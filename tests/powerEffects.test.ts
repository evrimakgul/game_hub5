import assert from "node:assert/strict";

import { buildCharacterEncounterSnapshot } from "../src/rules/combatEncounter.ts";
import { buildCharacterDerivedValues } from "../src/config/characterRuntime.ts";
import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  applyActivePowerEffect,
  buildActivePowerEffect,
  spendPowerMana,
} from "../src/rules/powerEffects.ts";
import { runTestSuite } from "./harness.ts";

export async function runPowerEffectsTests(): Promise<void> {
  await runTestSuite("powerEffects", [
    {
      name: "derived mana uses T1 power formula plus passive mana bonuses",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.statState.STAM.base = 4;
        sheet.statState.APP.base = 3;
        sheet.powers = [
          {
            id: "body_reinforcement",
            name: "Body Reinforcement",
            level: 3,
            governingStat: "STAM",
          },
          {
            id: "light_support",
            name: "Light Support",
            level: 3,
            governingStat: "APP",
          },
        ];

        const derived = buildCharacterDerivedValues(sheet);

        assert.equal(derived.baseMana, 13);
        assert.equal(derived.passiveManaBonus, 2);
        assert.equal(derived.maxMana, 15);
        assert.equal(derived.currentMana, 15);
      },
    },
    {
      name: "body reinforcement applies stat and DR bonuses and spends mana",
      run: () => {
        const caster = PLAYER_CHARACTER_TEMPLATE.createInstance();
        caster.name = "Caster";
        caster.statState.STAM.base = 4;
        caster.powers = [
          {
            id: "body_reinforcement",
            name: "Body Reinforcement",
            level: 4,
            governingStat: "STAM",
          },
        ];

        const target = PLAYER_CHARACTER_TEMPLATE.createInstance();
        target.name = "Target";

        const built = buildActivePowerEffect({
          casterCharacterId: "caster",
          casterName: "Caster",
          targetCharacterId: "target",
          targetName: "Target",
          power: caster.powers[0],
          selectedStatId: "STR",
        });

        assert.ok(!("error" in built));
        if ("error" in built) {
          return;
        }

        const spent = spendPowerMana(caster, built.manaCost);
        assert.ok(!("error" in spent));
        if ("error" in spent) {
          return;
        }

        assert.equal(spent.sheet.currentMana, 5);
        assert.equal(spent.sheet.manaInitialized, true);

        const buffedTarget = applyActivePowerEffect(target, built.effect);
        const derived = buildCharacterDerivedValues(buffedTarget);

        assert.equal(derived.currentStats.STR, 4);
        assert.equal(derived.damageReduction, 1);
      },
    },
    {
      name: "light support updates encounter combat summary through active effects",
      run: () => {
        const caster = PLAYER_CHARACTER_TEMPLATE.createInstance();
        caster.name = "Beacon";
        caster.statState.APP.base = 3;
        caster.powers = [
          {
            id: "light_support",
            name: "Light Support",
            level: 3,
            governingStat: "APP",
          },
        ];

        const target = PLAYER_CHARACTER_TEMPLATE.createInstance();
        target.name = "Ally";

        const built = buildActivePowerEffect({
          casterCharacterId: "caster",
          casterName: "Beacon",
          targetCharacterId: "target",
          targetName: "Ally",
          power: caster.powers[0],
        });

        assert.ok(!("error" in built));
        if ("error" in built) {
          return;
        }

        const buffedTarget = applyActivePowerEffect(target, built.effect);
        const snapshot = buildCharacterEncounterSnapshot(buffedTarget);

        assert.equal(snapshot.combatSummary.find((field) => field.id === "dr")?.value, 1);
        assert.equal(snapshot.combatSummary.find((field) => field.id === "soak")?.value, 3);
        assert.equal(
          snapshot.combatSummary.find((field) => field.id === "melee_attack")?.value,
          5
        );
        assert.equal(snapshot.activePowerEffects.length, 1);
      },
    },
    {
      name: "shadow control cloak supports allied target bonuses",
      run: () => {
        const caster = PLAYER_CHARACTER_TEMPLATE.createInstance();
        caster.name = "Shade";
        caster.statState.MAN.base = 4;
        caster.powers = [
          {
            id: "shadow_control",
            name: "Shadow Control",
            level: 4,
            governingStat: "MAN",
          },
        ];

        const target = PLAYER_CHARACTER_TEMPLATE.createInstance();
        target.name = "Scout";

        const built = buildActivePowerEffect({
          casterCharacterId: "caster",
          casterName: "Shade",
          targetCharacterId: "target",
          targetName: "Scout",
          power: caster.powers[0],
        });

        assert.ok(!("error" in built));
        if ("error" in built) {
          return;
        }

        assert.equal(built.manaCost, 4);

        const buffedTarget = applyActivePowerEffect(target, built.effect);
        const derived = buildCharacterDerivedValues(buffedTarget);
        const snapshot = buildCharacterEncounterSnapshot(buffedTarget);

        assert.equal(derived.armorClass, 4);
        assert.equal(snapshot.highlightedSkills.find((field) => field.id === "stealth")?.value, 4);
        assert.equal(
          snapshot.highlightedSkills.find((field) => field.id === "intimidation")?.value,
          4
        );
        assert.equal(derived.activePowerEffects.length, 1);
      },
    },
  ]);
}


