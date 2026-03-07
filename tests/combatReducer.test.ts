import assert from "node:assert/strict";

import {
  createCombatEngineState,
  dispatchCombatCommand,
} from "../src/config/combatReducer.ts";
import type { CreateCombatEngineStateInput } from "../src/types/combatEngine.ts";
import { runTestSuite } from "./harness.ts";

function createEncounter(): CreateCombatEngineStateInput {
  return {
    encounterId: "encounter-rce",
    label: "Real Combat Foundations",
    authorizationMode: "role_enforced",
    participants: [
      {
        participantId: "p1",
        displayName: "Alpha",
        kind: "character",
        ownerRole: "player",
        teamId: "players",
        characterId: "p1",
        coreStats: {
          STR: 3,
          DEX: 3,
          STAM: 3,
          CHA: 2,
          APP: 2,
          MAN: 2,
          INT: 2,
          WITS: 2,
          PER: 2,
        },
        skillLevels: { melee: 2 },
        knownPowers: {},
        currentHp: 10,
        currentMana: 4,
      },
      {
        participantId: "p2",
        displayName: "Bravo",
        kind: "npc",
        ownerRole: "dm",
        teamId: "enemies",
        characterId: null,
        coreStats: {
          STR: 2,
          DEX: 2,
          STAM: 2,
          CHA: 2,
          APP: 2,
          MAN: 2,
          INT: 2,
          WITS: 2,
          PER: 2,
        },
        skillLevels: { melee: 1 },
        knownPowers: {},
        currentHp: 9,
        currentMana: 2,
      },
    ],
  };
}

function beginEncounter() {
  const created = createCombatEngineState(createEncounter());
  const initiativeStarted = dispatchCombatCommand(created, {
    kind: "begin_initiative",
    controllerRole: "dm",
    controllerParticipantId: null,
  });
  const alphaRolled = dispatchCombatCommand(initiativeStarted, {
    kind: "submit_initiative_roll",
    actorParticipantId: "p1",
    dice: [8, 7, 6, 5, 4],
    controllerRole: "player",
    controllerParticipantId: "p1",
  });
  const bravoRolled = dispatchCombatCommand(alphaRolled, {
    kind: "submit_initiative_roll",
    actorParticipantId: "p2",
    dice: [6, 5, 4, 3],
    controllerRole: "dm",
    controllerParticipantId: null,
  });

  return dispatchCombatCommand(bravoRolled, {
    kind: "finalize_initiative",
    controllerRole: "dm",
    controllerParticipantId: null,
  });
}

export async function runCombatReducerTests(): Promise<void> {
  await runTestSuite("combatReducer", [
    {
      name: "initiative roll moves draft into review and finalizes into turn flow",
      run: () => {
        const created = createCombatEngineState(createEncounter());
        const initiativeStarted = dispatchCombatCommand(created, {
          kind: "begin_initiative",
          controllerRole: "dm",
          controllerParticipantId: null,
        });

        assert.equal(initiativeStarted.stage, "initiative_roll");

        const alphaRolled = dispatchCombatCommand(initiativeStarted, {
          kind: "submit_initiative_roll",
          actorParticipantId: "p1",
          dice: [8, 7, 6, 5, 4],
          controllerRole: "player",
          controllerParticipantId: "p1",
        });
        const bravoRolled = dispatchCombatCommand(alphaRolled, {
          kind: "submit_initiative_roll",
          actorParticipantId: "p2",
          dice: [7, 6, 5, 4],
          controllerRole: "dm",
          controllerParticipantId: null,
        });

        assert.equal(bravoRolled.stage, "initiative_review");

        const finalized = dispatchCombatCommand(bravoRolled, {
          kind: "finalize_initiative",
          controllerRole: "dm",
          controllerParticipantId: null,
        });

        assert.equal(finalized.stage, "turn_active");
        assert.deepEqual(finalized.turn.turnOrder, ["p1", "p2"]);
        assert.equal(finalized.turn.activeParticipantId, "p1");
        assert.equal(finalized.workflow?.step, "choose_action");
      },
    },
    {
      name: "workflow supports action selection, targeting, back, and cancel",
      run: () => {
        const started = beginEncounter();
        const selectedAction = dispatchCombatCommand(started, {
          kind: "select_action_family",
          actorParticipantId: "p1",
          actionFamilyId: "attack",
          controllerRole: "player",
          controllerParticipantId: "p1",
        });

        assert.equal(selectedAction.workflow?.selectedActionFamilyId, "attack");
        assert.equal(selectedAction.workflow?.step, "choose_targets");

        const backed = dispatchCombatCommand(selectedAction, {
          kind: "workflow_back",
          controllerRole: "player",
          controllerParticipantId: "p1",
        });

        assert.equal(backed.workflow?.step, "choose_subtype");

        const cancelled = dispatchCombatCommand(backed, {
          kind: "workflow_cancel",
          controllerRole: "player",
          controllerParticipantId: "p1",
        });

        assert.equal(cancelled.workflow?.step, "choose_action");
        assert.equal(cancelled.workflow?.selectedActionFamilyId, null);
      },
    },
    {
      name: "single enemy targeting rejects allies and accepts enemies only",
      run: () => {
        const encounter = createCombatEngineState({
          ...createEncounter(),
          participants: [
            createEncounter().participants[0],
            {
              ...createEncounter().participants[1],
              participantId: "ally1",
              displayName: "Ally",
              ownerRole: "player",
              teamId: "players",
            },
          ],
        });
        const initiativeStarted = dispatchCombatCommand(encounter, {
          kind: "begin_initiative",
          controllerRole: "dm",
          controllerParticipantId: null,
        });
        const alphaRolled = dispatchCombatCommand(initiativeStarted, {
          kind: "submit_initiative_roll",
          actorParticipantId: "p1",
          dice: [8, 7, 6, 5, 4],
          controllerRole: "player",
          controllerParticipantId: "p1",
        });
        const allyRolled = dispatchCombatCommand(alphaRolled, {
          kind: "submit_initiative_roll",
          actorParticipantId: "ally1",
          dice: [7, 6, 5, 4],
          controllerRole: "player",
          controllerParticipantId: "ally1",
        });
        const finalized = dispatchCombatCommand(allyRolled, {
          kind: "finalize_initiative",
          controllerRole: "dm",
          controllerParticipantId: null,
        });
        const selectedAction = dispatchCombatCommand(finalized, {
          kind: "select_action_family",
          actorParticipantId: "p1",
          actionFamilyId: "attack",
          controllerRole: "player",
          controllerParticipantId: "p1",
        });

        assert.throws(
          () =>
            dispatchCombatCommand(selectedAction, {
              kind: "select_targets",
              actorParticipantId: "p1",
              targetIds: ["ally1"],
              controllerRole: "player",
              controllerParticipantId: "p1",
            }),
          /relation rules/
        );
      },
    },
    {
      name: "confirmed targeted action opens reaction window and resolves after skip",
      run: () => {
        const started = beginEncounter();
        const selectedAction = dispatchCombatCommand(started, {
          kind: "select_action_family",
          actorParticipantId: "p1",
          actionFamilyId: "attack",
          controllerRole: "player",
          controllerParticipantId: "p1",
        });
        const targeted = dispatchCombatCommand(selectedAction, {
          kind: "select_targets",
          actorParticipantId: "p1",
          targetIds: ["p2"],
          controllerRole: "player",
          controllerParticipantId: "p1",
        });

        assert.equal(targeted.workflow?.step, "confirm");

        const confirmed = dispatchCombatCommand(targeted, {
          kind: "confirm_workflow",
          controllerRole: "player",
          controllerParticipantId: "p1",
        });

        assert.equal(confirmed.stage, "reaction_window");
        assert.equal(confirmed.pendingResolution?.currentReactionParticipantId, "p2");

        const resolved = dispatchCombatCommand(confirmed, {
          kind: "skip_reaction",
          actorParticipantId: "p2",
          controllerRole: "dm",
          controllerParticipantId: null,
        });

        assert.equal(resolved.stage, "turn_active");
        assert.equal(resolved.pendingResolution, null);
        assert.equal(resolved.workflow?.step, "choose_action");
        assert.equal(resolved.events.at(-1)?.name, "action_resolved");
      },
    },
  ]);
}
