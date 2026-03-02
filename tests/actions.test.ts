import assert from "node:assert/strict";

import {
  BASE_ACTION_AVAILABILITY,
  MOVE_ACTION_DISTANCE_METERS,
  STANDARD_AS_MOVE_DISTANCE_METERS,
  canSpendAction,
  createActionState,
  getActionAvailability,
  grantActionUses,
  lockActionUses,
  resetActionStateForTurn,
  restoreActionUses,
  spendAction,
} from "../src/config/actions.ts";
import { runTestSuite } from "./harness.ts";

export async function runActionsTests(): Promise<void> {
  await runTestSuite("actions", [
    {
      name: "createActionState starts with baseline turn resources",
      run: () => {
        const state = createActionState();
        assert.deepEqual(state.available, BASE_ACTION_AVAILABILITY);
        assert.deepEqual(state.spent, {
          standard: 0,
          bonus: 0,
          move: 0,
          reaction: 0,
          free: 0,
        });
      },
    },
    {
      name: "bonus actions prefer native bonus availability before spending standard",
      run: () => {
        const state = createActionState();
        const result = spendAction(state, "bonus");
        assert.equal(result.consumedFrom, "bonus");
        assert.equal(result.nextState.available.bonus, 0);
        assert.equal(result.nextState.available.standard, 1);
      },
    },
    {
      name: "bonus actions can consume standard when bonus is already spent",
      run: () => {
        const state = spendAction(createActionState(), "bonus").nextState;
        const result = spendAction(state, "bonus");
        assert.equal(result.consumedFrom, "standard");
        assert.equal(result.nextState.available.standard, 0);
        assert.equal(result.nextState.spent.standard, 1);
      },
    },
    {
      name: "move actions use native move first and standard fallback grants longer movement",
      run: () => {
        const firstMove = spendAction(createActionState(), "move");
        assert.equal(firstMove.consumedFrom, "move");
        assert.equal(firstMove.movementMeters, MOVE_ACTION_DISTANCE_METERS);

        const secondMove = spendAction(firstMove.nextState, "move");
        assert.equal(secondMove.consumedFrom, "standard");
        assert.equal(secondMove.movementMeters, STANDARD_AS_MOVE_DISTANCE_METERS);
      },
    },
    {
      name: "prepare_reaction spends a standard action",
      run: () => {
        const result = spendAction(createActionState(), "prepare_reaction");
        assert.equal(result.consumedFrom, "standard");
        assert.equal(result.preparedReaction, true);
        assert.equal(result.nextState.available.standard, 0);
      },
    },
    {
      name: "reactions use their own pool and free actions are always available",
      run: () => {
        const reaction = spendAction(createActionState(), "reaction");
        assert.equal(reaction.consumedFrom, "reaction");
        assert.equal(canSpendAction(reaction.nextState, "reaction"), false);

        const free = spendAction(reaction.nextState, "free");
        assert.equal(free.consumedFrom, "free");
        assert.equal(free.nextState.available.free, null);
      },
    },
    {
      name: "availability reports invalid requests when no legal conversion exists",
      run: () => {
        const depleted = spendAction(
          spendAction(createActionState(), "bonus").nextState,
          "standard"
        ).nextState;
        const availability = getActionAvailability(depleted, "bonus");
        assert.equal(availability.allowed, false);
        assert.match(availability.reason ?? "", /No Bonus Action or substitutable Standard Action/);
      },
    },
    {
      name: "grant, restore, lock, and reset helpers update action pools predictably",
      run: () => {
        const base = createActionState();
        const granted = grantActionUses(base, "standard", 1);
        assert.equal(granted.available.standard, 2);

        const spent = spendAction(granted, "standard").nextState;
        const restored = restoreActionUses(spent, "standard", 1);
        assert.equal(restored.available.standard, 2);
        assert.equal(restored.spent.standard, 0);

        const locked = lockActionUses(restored, "move", 1);
        assert.equal(locked.available.move, 0);

        const reset = resetActionStateForTurn(locked, { reaction: 2 });
        assert.equal(reset.available.standard, 1);
        assert.equal(reset.available.reaction, 2);
        assert.equal(reset.spent.standard, 0);
      },
    },
  ]);
}
