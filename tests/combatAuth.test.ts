import assert from "node:assert/strict";

import { dispatchAction, startCombat } from "../src/config/combatRuntime.ts";
import type { CombatantProfile } from "../src/types/combat.ts";
import { runTestSuite } from "./harness.ts";

function createCombatant(
  participantId: string,
  ownerRole: "player" | "dm",
  dex: number,
  wits: number
): CombatantProfile {
  return {
    participantId,
    displayName: participantId,
    kind: ownerRole === "dm" ? "npc" : "character",
    ownerRole,
    characterId: ownerRole === "player" ? participantId : null,
    coreStats: {
      STR: 2,
      DEX: dex,
      STAM: 3,
      CHA: 2,
      APP: 2,
      MAN: 2,
      INT: 2,
      WITS: wits,
      PER: 2,
    },
    skillLevels: {
      melee: 1,
      athletics: 1,
    },
    knownPowers: {},
    currentHp: 10,
    currentMana: 2,
  };
}

export async function runCombatAuthTests(): Promise<void> {
  await runTestSuite("combatAuth", [
    {
      name: "sandbox allows single operator control for all participants",
      run: () => {
        const state = startCombat({
          encounterId: "auth-sandbox",
          label: "sandbox",
          authorizationMode: "sandbox",
          combatants: [
            createCombatant("npc_1", "dm", 5, 4),
            createCombatant("pc_1", "player", 2, 2),
          ],
        });

        const activeId = state.turn.initiativeOrder[state.turn.activeIndex];
        assert.equal(activeId, "npc_1");

        const nextState = dispatchAction(
          state,
          {
            kind: "consume_action",
            actorParticipantId: "npc_1",
            requestedAction: "standard",
          },
          "player"
        );

        assert.equal(nextState.participants.npc_1.actionState.available.standard, 0);
      },
    },
    {
      name: "role_enforced rejects player control over dm-owned participant",
      run: () => {
        const state = startCombat({
          encounterId: "auth-role",
          label: "role",
          authorizationMode: "role_enforced",
          combatants: [
            createCombatant("npc_1", "dm", 5, 4),
            createCombatant("pc_1", "player", 2, 2),
          ],
        });

        assert.throws(
          () =>
            dispatchAction(
              state,
              {
                kind: "consume_action",
                actorParticipantId: "npc_1",
                requestedAction: "standard",
              },
              "player"
            ),
          /not authorized/
        );
      },
    },
    {
      name: "role_enforced still allows dm override control",
      run: () => {
        const state = startCombat({
          encounterId: "auth-role-dm",
          label: "role-dm",
          authorizationMode: "role_enforced",
          combatants: [
            createCombatant("npc_1", "dm", 5, 4),
            createCombatant("pc_1", "player", 2, 2),
          ],
        });

        const nextState = dispatchAction(
          state,
          {
            kind: "consume_action",
            actorParticipantId: "npc_1",
            requestedAction: "standard",
          },
          "dm"
        );
        assert.equal(nextState.participants.npc_1.actionState.available.standard, 0);
      },
    },
  ]);
}
