import assert from "node:assert/strict";

import { buildCharacterEncounterSnapshot } from "../src/rules/combatEncounter.ts";
import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import { buildDefaultHealingAllocations } from "../src/lib/combatEncounterCasting.ts";
import { getDecrementRefund, getIncrementCost } from "../src/lib/progressionCosts.ts";
import {
  buildEncounterRollTargets,
  getEncounterPartyMembers,
} from "../src/selectors/encounterViewModel.ts";
import { buildPlayerCharacterViewModel } from "../src/selectors/playerCharacterViewModel.ts";
import { runTestSuite } from "./harness.ts";

export async function runViewModelSelectorTests(): Promise<void> {
  await runTestSuite("viewModelSelectors", [
    {
      name: "player character view model exposes roll targets and filters known powers",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.powers = [
          {
            id: "awareness",
            name: "Awareness",
            level: 1,
            governingStat: "PER",
          },
        ];
        sheet.skills = sheet.skills.map((skill) =>
          skill.id === "alertness"
            ? {
                ...skill,
                base: 2,
              }
            : skill
        );

        const viewModel = buildPlayerCharacterViewModel(sheet);

        assert.ok(viewModel.rollTargets.some((target) => target.id === "stat:PER"));
        assert.ok(viewModel.rollTargets.some((target) => target.id === "skill:alertness"));
        assert.ok(
          !viewModel.availablePowerOptions.some((power) => power.id === "awareness")
        );
        assert.equal(viewModel.xpLeftOver, sheet.xpEarned - sheet.xpUsed);
      },
    },
    {
      name: "encounter selectors build roll targets and party member summaries",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.name = "Scout";
        sheet.currentHp = 8;
        sheet.statState.STAM.base = 4;
        sheet.resistances.fire = 1;

        const snapshot = buildCharacterEncounterSnapshot(sheet);
        const rollTargets = buildEncounterRollTargets(snapshot);
        const encounterParticipants = [
          {
            participant: {
              characterId: "scout-1",
              ownerRole: "player" as const,
              displayName: "Scout",
              initiativePool: 6,
              initiativeFaces: [6, 2, 2, 2, 2, 2],
            initiativeSuccesses: 1,
            dex: 3,
            wits: 3,
            partyId: "party-1",
            controllerCharacterId: null,
            summonTemplateId: null,
            sourcePowerId: null,
          },
          character: {
            id: "scout-1",
            ownerRole: "player" as const,
            sheet,
          },
          transientCombatant: null,
          snapshot,
        },
      ];

        const members = getEncounterPartyMembers(encounterParticipants, "party-1");

        assert.ok(rollTargets.some((target) => target.id === "summary:initiative"));
        assert.ok(rollTargets.some((target) => target.id === "stat:STR"));
        assert.equal(members.length, 1);
        assert.equal(members[0].currentHp, 8);
        assert.ok(members[0].maxHp >= 8);
        assert.equal(members[0].statusSummary, null);
      },
    },
    {
      name: "healing allocation and progression cost helpers stay deterministic",
      run: () => {
        assert.deepEqual(buildDefaultHealingAllocations(7, ["a", "b", "c"]), {
          a: "3",
          b: "2",
          c: "2",
        });
        assert.equal(getIncrementCost([0, 4, 9], 1), 5);
        assert.equal(getDecrementRefund([0, 4, 9], 1), 4);
      },
    },
  ]);
}


