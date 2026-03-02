import type { ActionState } from "../types/combat";
import type { ActionType } from "../types/game";

export const BASE_ACTION_AVAILABILITY: Record<ActionType, number | null> = {
  standard: 1,
  bonus: 1,
  move: 1,
  reaction: 1,
  free: null,
};

export const BASE_ACTION_SPENT: Record<ActionType, number> = {
  standard: 0,
  bonus: 0,
  move: 0,
  reaction: 0,
  free: 0,
};

export const MOVE_ACTION_DISTANCE_METERS = 5;
export const STANDARD_AS_MOVE_DISTANCE_METERS = 25;

export type RequestedAction = ActionType | "prepare_reaction";

export type ActionSpendResolution = {
  requested: RequestedAction;
  consumedFrom: ActionType | null;
  movementMeters: number;
  preparedReaction: boolean;
  nextState: ActionState;
};

export type ActionAvailability = {
  allowed: boolean;
  consumedFrom: ActionType | null;
  movementMeters: number;
  preparedReaction: boolean;
  reason?: string;
};

function assertActionCount(value: number | null, name: string): void {
  if (value === null) {
    return;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer or null.`);
  }
}

function cloneActionState(state: ActionState): ActionState {
  return {
    available: { ...state.available },
    spent: { ...state.spent },
  };
}

function consumeFromSource(state: ActionState, source: ActionType): ActionState {
  const nextState = cloneActionState(state);
  const current = nextState.available[source];

  if (current === null) {
    nextState.spent[source] += 1;
    return nextState;
  }

  if (current <= 0) {
    throw new RangeError(`${source} action is not available.`);
  }

  nextState.available[source] = current - 1;
  nextState.spent[source] += 1;
  return nextState;
}

export function createActionState(
  overrides: Partial<Record<ActionType, number | null>> = {}
): ActionState {
  const available = { ...BASE_ACTION_AVAILABILITY, ...overrides };

  for (const [action, count] of Object.entries(available)) {
    assertActionCount(count, `${action} availability`);
  }

  return {
    available,
    spent: { ...BASE_ACTION_SPENT },
  };
}

export function resetActionStateForTurn(
  state: ActionState | null = null,
  overrides: Partial<Record<ActionType, number | null>> = {}
): ActionState {
  void state;
  return createActionState(overrides);
}

export function getActionAvailability(
  state: ActionState,
  requested: RequestedAction
): ActionAvailability {
  if (requested === "free") {
    return {
      allowed: true,
      consumedFrom: "free",
      movementMeters: 0,
      preparedReaction: false,
    };
  }

  if (requested === "prepare_reaction") {
    if ((state.available.standard ?? 0) > 0) {
      return {
        allowed: true,
        consumedFrom: "standard",
        movementMeters: 0,
        preparedReaction: true,
      };
    }

    return {
      allowed: false,
      consumedFrom: null,
      movementMeters: 0,
      preparedReaction: false,
      reason: "No Standard Action available to prepare a reaction.",
    };
  }

  if (requested === "standard") {
    if ((state.available.standard ?? 0) > 0) {
      return {
        allowed: true,
        consumedFrom: "standard",
        movementMeters: 0,
        preparedReaction: false,
      };
    }

    return {
      allowed: false,
      consumedFrom: null,
      movementMeters: 0,
      preparedReaction: false,
      reason: "No Standard Action available.",
    };
  }

  if (requested === "bonus") {
    if ((state.available.bonus ?? 0) > 0) {
      return {
        allowed: true,
        consumedFrom: "bonus",
        movementMeters: 0,
        preparedReaction: false,
      };
    }

    if ((state.available.standard ?? 0) > 0) {
      return {
        allowed: true,
        consumedFrom: "standard",
        movementMeters: 0,
        preparedReaction: false,
      };
    }

    return {
      allowed: false,
      consumedFrom: null,
      movementMeters: 0,
      preparedReaction: false,
      reason: "No Bonus Action or substitutable Standard Action available.",
    };
  }

  if (requested === "move") {
    if ((state.available.move ?? 0) > 0) {
      return {
        allowed: true,
        consumedFrom: "move",
        movementMeters: MOVE_ACTION_DISTANCE_METERS,
        preparedReaction: false,
      };
    }

    if ((state.available.standard ?? 0) > 0) {
      return {
        allowed: true,
        consumedFrom: "standard",
        movementMeters: STANDARD_AS_MOVE_DISTANCE_METERS,
        preparedReaction: false,
      };
    }

    return {
      allowed: false,
      consumedFrom: null,
      movementMeters: 0,
      preparedReaction: false,
      reason: "No Move Action or substitutable Standard Action available.",
    };
  }

  if (requested === "reaction") {
    if ((state.available.reaction ?? 0) > 0) {
      return {
        allowed: true,
        consumedFrom: "reaction",
        movementMeters: 0,
        preparedReaction: false,
      };
    }

    return {
      allowed: false,
      consumedFrom: null,
      movementMeters: 0,
      preparedReaction: false,
      reason: "No Reaction available.",
    };
  }

  return {
    allowed: false,
    consumedFrom: null,
    movementMeters: 0,
    preparedReaction: false,
    reason: `Unsupported action request: ${requested satisfies never}`,
  };
}

export function canSpendAction(state: ActionState, requested: RequestedAction): boolean {
  return getActionAvailability(state, requested).allowed;
}

export function spendAction(state: ActionState, requested: RequestedAction): ActionSpendResolution {
  const availability = getActionAvailability(state, requested);

  if (!availability.allowed || availability.consumedFrom === null) {
    throw new RangeError(availability.reason ?? `Action ${requested} is not available.`);
  }

  const nextState = consumeFromSource(state, availability.consumedFrom);

  return {
    requested,
    consumedFrom: availability.consumedFrom,
    movementMeters: availability.movementMeters,
    preparedReaction: availability.preparedReaction,
    nextState,
  };
}

export function grantActionUses(
  state: ActionState,
  action: Exclude<ActionType, "free">,
  amount: number = 1
): ActionState {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError("amount must be a non-negative integer.");
  }

  const nextState = cloneActionState(state);
  const current = nextState.available[action];

  if (current === null) {
    throw new RangeError(`Cannot grant finite uses to ${action} because it is unbounded.`);
  }

  nextState.available[action] = current + amount;
  return nextState;
}

export function restoreActionUses(
  state: ActionState,
  action: Exclude<ActionType, "free">,
  amount: number = 1
): ActionState {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError("amount must be a non-negative integer.");
  }

  const nextState = cloneActionState(state);
  const available = nextState.available[action];

  if (available === null) {
    throw new RangeError(`Cannot restore ${action} because it is unbounded.`);
  }

  nextState.available[action] = available + amount;
  nextState.spent[action] = Math.max(0, nextState.spent[action] - amount);
  return nextState;
}

export function lockActionUses(
  state: ActionState,
  action: Exclude<ActionType, "free">,
  amount: number = 1
): ActionState {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError("amount must be a non-negative integer.");
  }

  const nextState = cloneActionState(state);
  const available = nextState.available[action];

  if (available === null) {
    throw new RangeError(`Cannot lock ${action} because it is unbounded.`);
  }

  nextState.available[action] = Math.max(0, available - amount);
  return nextState;
}
