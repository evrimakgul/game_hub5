import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  getBruteDefianceState,
  getBruteDefianceReviveHp,
} from "../src/lib/combatEncounterSpecialActions.ts";
import { POWER_USAGE_KEYS, incrementPowerUsageCount } from "../src/lib/powerUsage.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import { runTestSuite } from "./harness.ts";

function createCharacterRecord(
  id: string,
  name: string,
  options?: {
    bodyReinforcementLevel?: number;
    currentHp?: number;
    reviveAlreadyUsed?: boolean;
  }
): CharacterRecord {
  const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
  sheet.name = name;
  sheet.currentHp = options?.currentHp ?? sheet.currentHp;

  const power = sheet.powers.find((entry) => entry.id === "body_reinforcement");
  if (power) {
    power.level = options?.bodyReinforcementLevel ?? power.level;
  } else if (options?.bodyReinforcementLevel !== undefined) {
    sheet.powers.push({
      id: "body_reinforcement",
      name: "Body Reinforcement",
      level: options.bodyReinforcementLevel,
      governingStat: "STAM",
    });
  }

  if (options?.reviveAlreadyUsed) {
    sheet.powerUsageState = incrementPowerUsageCount(
      sheet.powerUsageState,
      "daily",
      POWER_USAGE_KEYS.bodyReinforcementRevive,
      1
    );
  }

  return {
    id,
    ownerRole: "player",
    sheet,
  };
}

export async function runCombatEncounterSpecialActionTests(): Promise<void> {
  await runTestSuite("combatEncounterSpecialActions", [
    {
      name: "brute defiance is unavailable below level two",
      run: () => {
        const character = createCharacterRecord("hero", "Hero", {
          bodyReinforcementLevel: 0,
          currentHp: 0,
        });

        const state = getBruteDefianceState(character);

        assert.equal(state.isAvailable, false);
        assert.equal(state.isEligible, false);
      },
    },
    {
      name: "brute defiance is visible but not eligible outside the hp window",
      run: () => {
        const character = createCharacterRecord("hero", "Hero", {
          bodyReinforcementLevel: 1,
          currentHp: -6,
        });

        const state = getBruteDefianceState(character);

        assert.equal(state.isAvailable, true);
        assert.equal(state.isEligible, false);
        assert.match(state.statusText, /between 0 and -5/i);
      },
    },
    {
      name: "brute defiance shows spent state after the daily use is consumed",
      run: () => {
        const character = createCharacterRecord("hero", "Hero", {
          bodyReinforcementLevel: 5,
          currentHp: -2,
          reviveAlreadyUsed: true,
        });

        const state = getBruteDefianceState(character);

        assert.equal(state.isAvailable, true);
        assert.equal(state.isEligible, false);
        assert.equal(state.usageSpent, true);
      },
    },
    {
      name: "brute defiance scaling follows 1 2 4 8 16 by power level",
      run: () => {
        assert.equal(getBruteDefianceReviveHp(1), 1);
        assert.equal(getBruteDefianceReviveHp(2), 2);
        assert.equal(getBruteDefianceReviveHp(3), 4);
        assert.equal(getBruteDefianceReviveHp(4), 8);
        assert.equal(getBruteDefianceReviveHp(5), 16);
      },
    },
    {
      name: "brute defiance becomes eligible in the passive hp window",
      run: () => {
        const character = createCharacterRecord("hero", "Hero", {
          bodyReinforcementLevel: 5,
          currentHp: -2,
        });
        const state = getBruteDefianceState(character);

        assert.equal(state.isAvailable, true);
        assert.equal(state.isEligible, true);
        assert.equal(state.reviveHp, 16);
      },
    },
  ]);
}
