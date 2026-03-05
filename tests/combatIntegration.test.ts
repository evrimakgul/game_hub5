import assert from "node:assert/strict";

import {
  advanceTurn,
  dispatchAction,
  finalizeCombat,
  startCombat,
} from "../src/config/combatRuntime.ts";
import type { CombatantProfile } from "../src/types/combat.ts";
import { runTestSuite } from "./harness.ts";

function createPc(): CombatantProfile {
  return {
    participantId: "pc_1",
    displayName: "PC One",
    kind: "character",
    ownerRole: "player",
    characterId: "pc_1",
    coreStats: {
      STR: 3,
      DEX: 4,
      STAM: 3,
      CHA: 2,
      APP: 2,
      MAN: 2,
      INT: 3,
      WITS: 3,
      PER: 3,
    },
    skillLevels: {
      melee: 2,
      ranged: 2,
      athletics: 1,
    },
    knownPowers: {
      healing: 2,
    },
    currentHp: 10,
    currentMana: 3,
  };
}

function createNpc(): CombatantProfile {
  return {
    participantId: "npc_1",
    displayName: "NPC One",
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
      INT: 2,
      WITS: 2,
      PER: 2,
    },
    skillLevels: {
      melee: 1,
      ranged: 1,
      athletics: 1,
    },
    knownPowers: {},
    currentHp: 9,
    currentMana: 0,
  };
}

export async function runCombatIntegrationTests(): Promise<void> {
  await runTestSuite("combatIntegration", [
    {
      name: "pc and npc encounter runs from start to finalize",
      run: () => {
        let state = startCombat({
          encounterId: "integration-1",
          label: "integration-1",
          authorizationMode: "sandbox",
          combatants: [createPc(), createNpc()],
        });

        const active = state.turn.initiativeOrder[state.turn.activeIndex];
        if (active === "pc_1") {
          state = dispatchAction(
            state,
            {
              kind: "attack",
              actorParticipantId: "pc_1",
              targetParticipantId: "npc_1",
              requestedAction: "standard",
              attackSuccesses: 8,
              damageAmount: 4,
              damageKind: "physical",
            },
            "player"
          );
        } else {
          state = dispatchAction(
            state,
            {
              kind: "attack",
              actorParticipantId: "npc_1",
              targetParticipantId: "pc_1",
              requestedAction: "standard",
              attackSuccesses: 8,
              damageAmount: 4,
              damageKind: "physical",
            },
            "dm"
          );
        }

        state = advanceTurn(state, "dm");
        state = finalizeCombat(state, "dm");
        assert.equal(state.status, "completed");
      },
    },
    {
      name: "role-enforced mode rejects non-dm turn advancement",
      run: () => {
        const state = startCombat({
          encounterId: "integration-2",
          label: "integration-2",
          authorizationMode: "role_enforced",
          combatants: [createPc(), createNpc()],
        });

        assert.throws(() => advanceTurn(state, "player"), /Only DM can advance turns/);
      },
    },
  ]);
}
