import assert from "node:assert/strict";

import {
  buildCharacterEncounterSnapshot,
  buildEncounterParticipantInput,
  createCombatEncounter,
} from "../src/rules/combatEncounter.ts";
import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import { runTestSuite } from "./harness.ts";

export async function runCombatEncounterTests(): Promise<void> {
  await runTestSuite("combatEncounter", [
    {
      name: "initiative scheduler orders combatants by rolled successes",
      run: () => {
        const encounter = createCombatEncounter("Test Encounter", [
          {
            characterId: "alpha",
            ownerRole: "player",
            displayName: "Alpha",
            dex: 4,
            wits: 3,
            initiativeFaces: [6, 6, 6, 2, 2, 2, 2],
          },
          {
            characterId: "beta",
            ownerRole: "dm",
            displayName: "Beta",
            dex: 3,
            wits: 3,
            initiativeFaces: [6, 2, 2, 2, 2, 2],
          },
        ]);

        assert.deepEqual(
          encounter.participants.map((participant) => participant.characterId),
          ["alpha", "beta"]
        );
        assert.equal(encounter.participants[0].initiativeSuccesses, 3);
      },
    },
    {
      name: "character encounter snapshot hides normal resistances and exposes highlighted skills",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.name = "Scout";
        sheet.inspiration = 2;
        sheet.statState.DEX.base = 4;
        sheet.statState.WITS.base = 3;
        sheet.skills = sheet.skills.map((skill) =>
          skill.id === "alertness"
            ? {
                ...skill,
                base: 2,
              }
            : skill
        );
        sheet.resistances.fire = 1;

        const input = buildEncounterParticipantInput("scout", "player", sheet);
        assert.equal(input.displayName, "Scout");
        assert.equal(input.dex, 4);

        const snapshot = buildCharacterEncounterSnapshot(sheet);
        assert.equal(snapshot.inspiration, 2);
        assert.equal(snapshot.visibleResistances.length, 1);
        assert.equal(snapshot.visibleResistances[0].label, "Fire");
        assert.equal(snapshot.highlightedSkills.length, 3);
        assert.equal(
          snapshot.combatSummary.find((field) => field.id === "movement")?.value,
          "20 + 5"
        );
        assert.equal(
          snapshot.combatSummary.find((field) => field.id === "movement")?.selectableValue,
          25
        );
      },
    },
    {
      name: "character encounter snapshot suppresses paralyzed when crowd control tag is present",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.statusTags = [
          { id: "paralyzed", label: "Paralyzed" },
          { id: "crowd_control:caster-1", label: "Controlled by t2" },
        ];

        const snapshot = buildCharacterEncounterSnapshot(sheet);

        assert.deepEqual(snapshot.statusTags, ["Controlled by t2"]);
      },
    },
  ]);
}


