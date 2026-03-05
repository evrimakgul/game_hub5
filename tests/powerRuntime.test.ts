import assert from "node:assert/strict";

import { advanceTurn, castPower, startCombat } from "../src/config/combatRuntime.ts";
import type { CombatantProfile } from "../src/types/combat.ts";
import { runTestSuite } from "./harness.ts";

function createCaster(powerId: "body_reinforcement" | "crowd_control"): CombatantProfile {
  return {
    participantId: "caster",
    displayName: "Caster",
    kind: "character",
    ownerRole: "player",
    characterId: "caster",
    coreStats: {
      STR: 2,
      DEX: 4,
      STAM: 4,
      CHA: 3,
      APP: 2,
      MAN: 2,
      INT: 3,
      WITS: 3,
      PER: 3,
    },
    skillLevels: {
      melee: 2,
      athletics: 1,
      ranged: 1,
    },
    knownPowers:
      powerId === "body_reinforcement"
        ? { body_reinforcement: 3 }
        : { crowd_control: 1 },
    currentHp: 10,
    currentMana: 3,
  };
}

function createTarget(): CombatantProfile {
  return {
    participantId: "target",
    displayName: "Target",
    kind: "npc",
    ownerRole: "dm",
    characterId: null,
    coreStats: {
      STR: 2,
      DEX: 2,
      STAM: 3,
      CHA: 1,
      APP: 1,
      MAN: 1,
      INT: 1,
      WITS: 2,
      PER: 2,
    },
    skillLevels: {
      melee: 1,
      athletics: 1,
      ranged: 1,
    },
    knownPowers: {},
    currentHp: 10,
    currentMana: 0,
  };
}

export async function runPowerRuntimeTests(): Promise<void> {
  await runTestSuite("powerRuntime", [
    {
      name: "body reinforcement applies buff and expires after duration",
      run: () => {
        let state = startCombat({
          encounterId: "power-br",
          label: "power-br",
          authorizationMode: "sandbox",
          combatants: [createCaster("body_reinforcement"), createTarget()],
        });

        state = castPower(
          state,
          {
            actorParticipantId: "caster",
            powerId: "body_reinforcement",
            requestedAction: "standard",
            targetParticipantId: "caster",
            selectedStat: "STR",
          },
          "player"
        );

        assert.equal(state.participants.caster.profile.currentMana, 0);
        assert.equal(state.participants.caster.effects.length, 1);
        assert.equal(state.participants.caster.derived.meleeDamage, 4);

        state = advanceTurn(state, "dm");
        state = advanceTurn(state, "dm");
        state = advanceTurn(state, "dm");

        assert.equal(state.participants.caster.effects.length, 0);
      },
    },
    {
      name: "crowd control consumes maintenance mana then expires when unpaid",
      run: () => {
        let state = startCombat({
          encounterId: "power-cc",
          label: "power-cc",
          authorizationMode: "sandbox",
          combatants: [createCaster("crowd_control"), createTarget()],
        });

        state = castPower(
          state,
          {
            actorParticipantId: "caster",
            powerId: "crowd_control",
            requestedAction: "standard",
            targetParticipantId: "target",
          },
          "player"
        );

        assert.equal(state.participants.target.effects.length, 1);
        state = advanceTurn(state, "dm");
        state = advanceTurn(state, "dm");
        assert.equal(state.participants.caster.profile.currentMana, 2);
        assert.equal(state.participants.target.effects.length, 1);

        state = advanceTurn(state, "dm");
        state = advanceTurn(state, "dm");
        state = advanceTurn(state, "dm");
        state = advanceTurn(state, "dm");
        state = advanceTurn(state, "dm");
        state = advanceTurn(state, "dm");

        assert.equal(state.participants.caster.profile.currentMana, 0);
        assert.equal(state.participants.target.effects.length, 0);
      },
    },
  ]);
}
