import assert from "node:assert/strict";

import {
  createCombatEngineState,
  dispatchCombatCommand,
} from "../src/config/combatReducer.ts";
import {
  selectActionBar,
  selectCombatantInspector,
  selectCombatantSummaries,
  selectEventLog,
  selectInitiativeView,
  selectReactionPrompt,
  selectWorkflowPanel,
} from "../src/selectors/combatUi.ts";
import type { CreateCombatEngineStateInput } from "../src/types/combatEngine.ts";
import { runTestSuite } from "./harness.ts";

function createEncounter(): CreateCombatEngineStateInput {
  return {
    encounterId: "encounter-ui",
    label: "Selector Encounter",
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
        knownPowers: { body_reinforcement: 3 },
        currentHp: 10,
        currentMana: 5,
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

export async function runCombatUiSelectorsTests(): Promise<void> {
  await runTestSuite("combatUiSelectors", [
    {
      name: "combatant and initiative selectors expose encounter summaries",
      run: () => {
        const started = beginEncounter();
        const summaries = selectCombatantSummaries(started);
        const initiativeView = selectInitiativeView(started);

        assert.equal(summaries.length, 2);
        assert.equal(summaries[0].displayName, "Alpha");
        assert.equal(initiativeView.orderedEntries[0].participantId, "p1");
      },
    },
    {
      name: "action bar shows active actions for active participant and free action off turn",
      run: () => {
        const started = beginEncounter();
        const activeBar = selectActionBar(started, "p1");
        const offTurnBar = selectActionBar(started, "p2");

        assert.equal(activeBar.some((entry) => entry.actionFamilyId === "attack"), true);
        assert.deepEqual(offTurnBar.map((entry) => entry.actionFamilyId), ["free_action"]);
      },
    },
    {
      name: "workflow panel exposes subtype and target data for current selection",
      run: () => {
        const started = beginEncounter();
        const selectedAction = dispatchCombatCommand(started, {
          kind: "select_action_family",
          actorParticipantId: "p1",
          actionFamilyId: "cast_power",
          controllerRole: "player",
          controllerParticipantId: "p1",
        });

        const panel = selectWorkflowPanel(selectedAction);

        assert.equal(panel?.selectedActionFamilyId, "cast_power");
        assert.equal(panel?.selectedSubtypeId, "power:body_reinforcement");
        assert.equal(panel?.parameterDefinitions[0]?.key, "selectedPhysicalStat");
      },
    },
    {
      name: "reaction prompt and event log selectors expose reaction state",
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
        const confirmed = dispatchCombatCommand(targeted, {
          kind: "confirm_workflow",
          controllerRole: "player",
          controllerParticipantId: "p1",
        });

        const reactionPrompt = selectReactionPrompt(confirmed);
        const inspector = selectCombatantInspector(confirmed, "p2");
        const eventLog = selectEventLog(confirmed, 2);

        assert.equal(reactionPrompt?.participantId, "p2");
        assert.equal(inspector?.displayName, "Bravo");
        assert.equal(eventLog.at(-1)?.name, "reaction_window_opened");
      },
    },
  ]);
}
