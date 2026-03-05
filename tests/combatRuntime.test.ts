import assert from "node:assert/strict";

import {
  advanceTurn,
  dispatchAction,
  startCombat,
  type StartCombatInput,
} from "../src/config/combatRuntime.ts";
import type { CombatantProfile } from "../src/types/combat.ts";
import { runTestSuite } from "./harness.ts";

function createCombatant(
  participantId: string,
  displayName: string,
  ownerRole: "player" | "dm",
  dex: number,
  wits: number
): CombatantProfile {
  return {
    participantId,
    displayName,
    kind: "character",
    ownerRole,
    characterId: participantId,
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
      melee: 2,
      ranged: 1,
      athletics: 1,
    },
    knownPowers: {},
    currentHp: 10,
    currentMana: 3,
  };
}

function createStartInput(
  authorizationMode: "sandbox" | "role_enforced" = "sandbox"
): StartCombatInput {
  return {
    encounterId: "encounter-test",
    label: "Test Encounter",
    authorizationMode,
    combatants: [
      createCombatant("p1", "Alpha", "player", 4, 3),
      createCombatant("p2", "Beta", "dm", 3, 2),
    ],
  };
}

export async function runCombatRuntimeTests(): Promise<void> {
  await runTestSuite("combatRuntime", [
    {
      name: "startCombat sorts initiative and exposes first active participant",
      run: () => {
        const state = startCombat(createStartInput());
        assert.equal(state.turn.initiativeOrder[0], "p1");
        assert.equal(state.turn.roundNumber, 1);
      },
    },
    {
      name: "dispatchAction consumes action economy and rejects illegal repeats",
      run: () => {
        const started = startCombat(createStartInput());
        const first = dispatchAction(
          started,
          {
            kind: "consume_action",
            actorParticipantId: "p1",
            requestedAction: "standard",
          },
          "dm"
        );

        assert.equal(first.participants.p1.actionState.available.standard, 0);
        assert.throws(
          () =>
            dispatchAction(
              first,
              {
                kind: "consume_action",
                actorParticipantId: "p1",
                requestedAction: "standard",
              },
              "dm"
            ),
          /No Standard Action available/
        );
      },
    },
    {
      name: "advanceTurn rotates active participant and increments round on wrap",
      run: () => {
        const started = startCombat(createStartInput());
        const secondTurn = advanceTurn(started, "dm");
        assert.equal(secondTurn.turn.initiativeOrder[secondTurn.turn.activeIndex], "p2");
        const thirdTurn = advanceTurn(secondTurn, "dm");
        assert.equal(thirdTurn.turn.initiativeOrder[thirdTurn.turn.activeIndex], "p1");
        assert.equal(thirdTurn.turn.roundNumber, 2);
      },
    },
  ]);
}
