import {
  createActionState,
  resetActionStateForTurn,
  spendAction,
  type RequestedAction,
} from "./actions.ts";
import { resolveHit, resolveMagicalDamage, resolvePhysicalDamage } from "./combat.ts";
import {
  getKnownPowerLevel,
  getRuntimePowerLevel,
  isActionCompatibleWithPower,
  powerRuntimeLibrary,
} from "./powerRuntime.ts";
import {
  calculateArmorClass,
  calculateInitiative,
  calculateMaxHP,
  calculateRangedBonusDice,
} from "./stats.ts";
import type {
  AuthorizationMode,
  CombatDerivedState,
  CombatEvent,
  CombatModifier,
  CombatState,
  CombatantProfile,
  OwnershipRole,
} from "../types/combat.ts";
import type {
  CoreStatId,
  EncounterId,
  ParticipantId,
  PowerId,
  SkillId,
} from "../types/game.ts";
import type { CastCommand } from "../types/powers.ts";

type DamageKind = "physical" | "magical";

export interface StartCombatInput {
  encounterId: EncounterId;
  label: string;
  authorizationMode: AuthorizationMode;
  combatants: CombatantProfile[];
}

export interface ConsumeActionCommand {
  kind: "consume_action";
  actorParticipantId: ParticipantId;
  requestedAction: RequestedAction;
}

export interface AttackCommand {
  kind: "attack";
  actorParticipantId: ParticipantId;
  targetParticipantId: ParticipantId;
  requestedAction: RequestedAction;
  attackSuccesses: number;
  damageAmount: number;
  damageKind: DamageKind;
}

export interface CastPowerActionCommand {
  kind: "cast_power";
  cast: CastCommand;
}

export type CombatCommand =
  | ConsumeActionCommand
  | AttackCommand
  | CastPowerActionCommand;

let generatedCounter = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  generatedCounter += 1;
  return `${prefix}-${Date.now()}-${generatedCounter}`;
}

function cloneState(state: CombatState): CombatState {
  return structuredClone(state);
}

function createEvent(
  state: CombatState,
  type: CombatEvent["type"],
  actorParticipantId: ParticipantId | null,
  targetParticipantId: ParticipantId | null,
  message: string,
  payload: Record<string, unknown> = {}
): CombatEvent {
  return {
    eventId: nextId("event"),
    type,
    roundNumber: state.turn.roundNumber,
    actorParticipantId,
    targetParticipantId,
    message,
    payload,
    createdAt: nowIso(),
  };
}

function assertActiveCombat(state: CombatState): void {
  if (state.status !== "active") {
    throw new RangeError("Combat is not active.");
  }
}

function isPhysicalStat(stat: CoreStatId): boolean {
  return stat === "STR" || stat === "DEX" || stat === "STAM";
}

function sumModifier(modifiers: CombatModifier[], target: CombatModifier["target"]): number {
  return modifiers
    .filter((modifier) => modifier.target === target)
    .reduce((total, modifier) => total + modifier.value, 0);
}

function getActiveParticipantId(state: CombatState): ParticipantId {
  const participantId = state.turn.initiativeOrder[state.turn.activeIndex];
  if (!participantId || !state.participants[participantId]) {
    throw new RangeError("Active participant could not be resolved.");
  }

  return participantId;
}

function getSkillLevel(
  profile: CombatantProfile,
  skillId: SkillId,
  fallback: number = 0
): number {
  return Math.max(0, Math.floor(profile.skillLevels[skillId] ?? fallback));
}

function collectPassivePowerModifiers(profile: CombatantProfile): CombatModifier[] {
  const modifiers: CombatModifier[] = [];

  for (const [powerId, level] of Object.entries(profile.knownPowers) as Array<
    [PowerId, number]
  >) {
    const knownLevel = getKnownPowerLevel(profile.knownPowers, powerId);
    if (knownLevel <= 0) {
      continue;
    }

    const runtimeLevel = getRuntimePowerLevel(powerId, Math.min(level ?? 0, knownLevel));
    if (!runtimeLevel) {
      continue;
    }

    modifiers.push(...runtimeLevel.passiveModifiers);
  }

  return modifiers;
}

function collectAllModifiersForParticipant(
  state: CombatState,
  participantId: ParticipantId
): CombatModifier[] {
  const participant = state.participants[participantId];
  if (!participant) {
    return [];
  }

  const passiveModifiers = collectPassivePowerModifiers(participant.profile);
  const activeModifiers = participant.effects.flatMap((effect) => effect.modifiers);

  return [...passiveModifiers, ...activeModifiers];
}

function computeEffectiveCoreStats(state: CombatState, participantId: ParticipantId): Record<CoreStatId, number> {
  const participant = state.participants[participantId];
  if (!participant) {
    throw new RangeError(`Participant ${participantId} does not exist.`);
  }

  const modifiers = collectAllModifiersForParticipant(state, participantId);
  const nextStats = { ...participant.profile.coreStats };

  for (const statId of Object.keys(nextStats) as CoreStatId[]) {
    nextStats[statId] += sumModifier(modifiers, statId);
  }

  return nextStats;
}

function computeDerived(state: CombatState, participantId: ParticipantId): CombatDerivedState {
  const participant = state.participants[participantId];
  if (!participant) {
    throw new RangeError(`Participant ${participantId} does not exist.`);
  }

  const effectiveStats = computeEffectiveCoreStats(state, participantId);
  const modifiers = collectAllModifiersForParticipant(state, participantId);
  const globalRollBonus = sumModifier(modifiers, "successes_to_any_roll");
  const athletics = getSkillLevel(participant.profile, "athletics");
  const melee = getSkillLevel(participant.profile, "melee");
  const ranged = getSkillLevel(participant.profile, "ranged");
  const maxHp = calculateMaxHP(Math.max(0, effectiveStats.STAM));
  const maxMana = Math.max(0, participant.profile.currentMana);

  return {
    maxHp,
    maxMana,
    initiative:
      calculateInitiative(effectiveStats.DEX, effectiveStats.WITS) +
      sumModifier(modifiers, "initiative"),
    armorClass:
      calculateArmorClass(effectiveStats.DEX, athletics, 0) +
      sumModifier(modifiers, "armor_class"),
    damageReduction: Math.max(0, sumModifier(modifiers, "damage_reduction")),
    soak: Math.max(0, effectiveStats.STAM + sumModifier(modifiers, "soak")),
    meleeAttack: melee + effectiveStats.DEX + sumModifier(modifiers, "melee_attack") + globalRollBonus,
    rangedAttack:
      ranged +
      effectiveStats.DEX +
      calculateRangedBonusDice(effectiveStats.PER) +
      sumModifier(modifiers, "ranged_attack") +
      globalRollBonus,
    meleeDamage: effectiveStats.STR + sumModifier(modifiers, "melee_damage"),
    rangedDamage: Math.max(0, sumModifier(modifiers, "ranged_damage")),
    successesToAnyRoll: globalRollBonus,
  };
}

function findNextAliveIndex(state: CombatState, fromIndex: number): number {
  const order = state.turn.initiativeOrder;
  if (order.length === 0) {
    return 0;
  }

  for (let offset = 1; offset <= order.length; offset += 1) {
    const index = (fromIndex + offset) % order.length;
    const participant = state.participants[order[index]];
    if (participant && !participant.defeated) {
      return index;
    }
  }

  return fromIndex;
}

function ensureActorCanControl(
  state: CombatState,
  actorParticipantId: ParticipantId,
  actorRole: OwnershipRole
): void {
  const actorParticipant = state.participants[actorParticipantId];
  if (!actorParticipant) {
    throw new RangeError(`Participant ${actorParticipantId} does not exist.`);
  }

  if (state.authorizationMode === "sandbox") {
    return;
  }

  if (actorRole === "dm") {
    return;
  }

  if (actorRole === "player" && actorParticipant.profile.ownerRole === "player") {
    return;
  }

  if (actorRole === "system" && actorParticipant.profile.ownerRole === "system") {
    return;
  }

  throw new RangeError("Actor is not authorized to control this participant.");
}

function ensureActorTurn(state: CombatState, actorParticipantId: ParticipantId): void {
  const activeParticipantId = getActiveParticipantId(state);
  if (activeParticipantId !== actorParticipantId) {
    throw new RangeError("Only the active participant can dispatch this action.");
  }
}

function recomputeAllParticipants(state: CombatState): CombatState {
  const nextState = cloneState(state);

  for (const participantId of Object.keys(nextState.participants)) {
    const participant = nextState.participants[participantId];
    participant.derived = computeDerived(nextState, participantId);
    participant.profile.currentHp = Math.min(
      Math.max(0, participant.profile.currentHp),
      participant.derived.maxHp
    );
    participant.defeated = participant.profile.currentHp <= 0;
  }

  nextState.updatedAt = nowIso();
  return nextState;
}

function applyPowerBuffEffect(
  state: CombatState,
  actorParticipantId: ParticipantId,
  targetParticipantId: ParticipantId,
  powerId: PowerId,
  powerLevel: number,
  selectedStat: CoreStatId | null,
  actorRole: OwnershipRole
): CombatState {
  const actor = state.participants[actorParticipantId];
  const target = state.participants[targetParticipantId];
  if (!actor || !target) {
    throw new RangeError("Actor or target does not exist.");
  }

  ensureActorCanControl(state, actorParticipantId, actorRole);
  ensureActorTurn(state, actorParticipantId);

  const mechanics = getRuntimePowerLevel(powerId, powerLevel);
  if (!mechanics) {
    throw new RangeError("Power mechanics were not found for the selected level.");
  }

  if (mechanics.castMode !== "buff") {
    throw new RangeError("This power level is not a buff cast.");
  }

  const dynamicModifiers: CombatModifier[] = [];
  if (mechanics.selectedPhysicalStatBonus !== null) {
    if (!selectedStat || !isPhysicalStat(selectedStat)) {
      throw new RangeError("Selected stat must be physical for this power.");
    }

    dynamicModifiers.push({
      target: selectedStat,
      value: mechanics.selectedPhysicalStatBonus,
    });
  }

  const effectLabel = `${powerRuntimeLibrary[powerId].name} Lv ${powerLevel}`;
  target.effects.push({
    effectInstanceId: nextId("effect"),
    sourcePowerId: powerId,
    sourcePowerLevel: powerLevel,
    appliedByParticipantId: actorParticipantId,
    targetParticipantId,
    label: effectLabel,
    modifiers: [...mechanics.activeModifiers, ...dynamicModifiers],
    remainingRounds: mechanics.durationRounds,
    maintenanceManaCost: mechanics.maintenanceManaCost,
    metadata: {},
  });

  const withDerived = recomputeAllParticipants(state);
  withDerived.events.push(
    createEvent(
      withDerived,
      "effect_applied",
      actorParticipantId,
      targetParticipantId,
      `${actor.profile.displayName} applied ${effectLabel} to ${target.profile.displayName}.`,
      {
        powerId,
        powerLevel,
      }
    )
  );
  return withDerived;
}

function removeExpiredEffects(state: CombatState): CombatState {
  const nextState = cloneState(state);
  let changed = false;

  for (const participantId of Object.keys(nextState.participants)) {
    const participant = nextState.participants[participantId];
    const remainingEffects = [];

    for (const effect of participant.effects) {
      if (effect.remainingRounds === null) {
        remainingEffects.push(effect);
        continue;
      }

      const nextRounds = effect.remainingRounds - 1;
      if (nextRounds <= 0) {
        changed = true;
        nextState.events.push(
          createEvent(
            nextState,
            "effect_expired",
            effect.appliedByParticipantId,
            participantId,
            `${effect.label} expired on ${participant.profile.displayName}.`,
            {
              effectInstanceId: effect.effectInstanceId,
            }
          )
        );
        continue;
      }

      remainingEffects.push({
        ...effect,
        remainingRounds: nextRounds,
      });
    }

    participant.effects = remainingEffects;
  }

  return changed ? recomputeAllParticipants(nextState) : nextState;
}

function runMaintenanceCostsForActiveParticipant(state: CombatState): CombatState {
  const nextState = cloneState(state);
  const activeParticipantId = getActiveParticipantId(nextState);
  const activeParticipant = nextState.participants[activeParticipantId];
  if (!activeParticipant) {
    return nextState;
  }

  let changed = false;

  for (const targetId of Object.keys(nextState.participants)) {
    const target = nextState.participants[targetId];
    const nextEffects = [];

    for (const effect of target.effects) {
      if (
        effect.maintenanceManaCost === null ||
        effect.maintenanceManaCost <= 0 ||
        effect.appliedByParticipantId !== activeParticipantId
      ) {
        nextEffects.push(effect);
        continue;
      }

      if (activeParticipant.profile.currentMana >= effect.maintenanceManaCost) {
        activeParticipant.profile.currentMana -= effect.maintenanceManaCost;
        changed = true;
        nextState.events.push(
          createEvent(
            nextState,
            "effect_maintained",
            activeParticipantId,
            targetId,
            `${activeParticipant.profile.displayName} maintained ${effect.label}.`,
            {
              effectInstanceId: effect.effectInstanceId,
              manaCost: effect.maintenanceManaCost,
            }
          )
        );
        nextEffects.push(effect);
        continue;
      }

      changed = true;
      nextState.events.push(
        createEvent(
          nextState,
          "effect_expired",
          activeParticipantId,
          targetId,
          `${effect.label} expired (maintenance not paid).`,
          {
            effectInstanceId: effect.effectInstanceId,
          }
        )
      );
    }

    target.effects = nextEffects;
  }

  return changed ? recomputeAllParticipants(nextState) : nextState;
}

function applyDamage(
  state: CombatState,
  targetParticipantId: ParticipantId,
  amount: number
): CombatState {
  const nextState = cloneState(state);
  const target = nextState.participants[targetParticipantId];
  if (!target) {
    throw new RangeError(`Target ${targetParticipantId} does not exist.`);
  }

  const normalizedDamage = Math.max(0, Math.floor(amount));
  target.profile.currentHp = Math.max(0, target.profile.currentHp - normalizedDamage);
  target.defeated = target.profile.currentHp <= 0;
  return recomputeAllParticipants(nextState);
}

function applyHealing(
  state: CombatState,
  targetParticipantId: ParticipantId,
  amount: number
): CombatState {
  const nextState = cloneState(state);
  const target = nextState.participants[targetParticipantId];
  if (!target) {
    throw new RangeError(`Target ${targetParticipantId} does not exist.`);
  }

  const normalizedHealing = Math.max(0, Math.floor(amount));
  target.profile.currentHp = Math.min(
    target.derived.maxHp,
    target.profile.currentHp + normalizedHealing
  );
  target.defeated = target.profile.currentHp <= 0;
  return recomputeAllParticipants(nextState);
}

function addSummon(
  state: CombatState,
  ownerParticipantId: ParticipantId,
  quantity: number
): CombatState {
  const nextState = cloneState(state);
  const owner = nextState.participants[ownerParticipantId];
  if (!owner) {
    throw new RangeError(`Owner ${ownerParticipantId} does not exist.`);
  }

  for (let index = 0; index < quantity; index += 1) {
    const summonId = nextId(`${ownerParticipantId}-summon`);
    const stamina = 2;

    nextState.participants[summonId] = {
      profile: {
        participantId: summonId,
        displayName: `${owner.profile.displayName} Summon ${index + 1}`,
        kind: "summon",
        ownerRole: owner.profile.ownerRole,
        characterId: null,
        coreStats: {
          STR: 2,
          DEX: 2,
          STAM: stamina,
          CHA: 1,
          APP: 1,
          MAN: 1,
          INT: 1,
          WITS: 2,
          PER: 2,
        },
        skillLevels: {
          melee: 1,
          ranged: 0,
          athletics: 1,
        },
        knownPowers: {},
        currentHp: calculateMaxHP(stamina),
        currentMana: 0,
      },
      actionState: createActionState(),
      derived: {
        maxHp: 0,
        maxMana: 0,
        initiative: 0,
        armorClass: 0,
        damageReduction: 0,
        soak: 0,
        meleeAttack: 0,
        rangedAttack: 0,
        meleeDamage: 0,
        rangedDamage: 0,
        successesToAnyRoll: 0,
      },
      effects: [],
      statuses: [],
      defeated: false,
    };

    nextState.turn.initiativeOrder.push(summonId);
  }

  return recomputeAllParticipants(nextState);
}

export function startCombat(input: StartCombatInput): CombatState {
  if (input.combatants.length === 0) {
    throw new RangeError("Cannot start combat without participants.");
  }

  const createdAt = nowIso();
  const participants = Object.fromEntries(
    input.combatants.map((profile) => [
      profile.participantId,
      {
        profile: structuredClone(profile),
        actionState: createActionState(),
        derived: {
          maxHp: 0,
          maxMana: 0,
          initiative: 0,
          armorClass: 0,
          damageReduction: 0,
          soak: 0,
          meleeAttack: 0,
          rangedAttack: 0,
          meleeDamage: 0,
          rangedDamage: 0,
          successesToAnyRoll: 0,
        },
        effects: [],
        statuses: [],
        defeated: profile.currentHp <= 0,
      },
    ])
  );

  const initialState: CombatState = {
    encounterId: input.encounterId,
    label: input.label,
    authorizationMode: input.authorizationMode,
    status: "active",
    participants,
    turn: {
      roundNumber: 1,
      initiativeOrder: input.combatants.map((profile) => profile.participantId),
      activeIndex: 0,
    },
    events: [],
    createdAt,
    updatedAt: createdAt,
    endedAt: null,
  };

  const withDerived = recomputeAllParticipants(initialState);
  withDerived.turn.initiativeOrder = [...withDerived.turn.initiativeOrder].sort((left, right) => {
    const leftParticipant = withDerived.participants[left];
    const rightParticipant = withDerived.participants[right];

    if (!leftParticipant || !rightParticipant) {
      return 0;
    }

    if (leftParticipant.derived.initiative !== rightParticipant.derived.initiative) {
      return rightParticipant.derived.initiative - leftParticipant.derived.initiative;
    }

    return leftParticipant.profile.displayName.localeCompare(rightParticipant.profile.displayName);
  });

  withDerived.turn.activeIndex = 0;
  const activeParticipantId = getActiveParticipantId(withDerived);
  withDerived.participants[activeParticipantId].actionState = resetActionStateForTurn();
  withDerived.events.push(
    createEvent(
      withDerived,
      "combat_started",
      null,
      null,
      `Combat started: ${withDerived.label}.`,
      {
        participantCount: withDerived.turn.initiativeOrder.length,
      }
    )
  );
  return withDerived;
}

export function recomputeDerived(state: CombatState): CombatState {
  return recomputeAllParticipants(state);
}

export function advanceTurn(
  state: CombatState,
  actorRole: OwnershipRole = "dm"
): CombatState {
  assertActiveCombat(state);
  if (state.authorizationMode === "role_enforced" && actorRole !== "dm") {
    throw new RangeError("Only DM can advance turns in role-enforced mode.");
  }

  const beforeMaintenance = removeExpiredEffects(state);
  const nextState = cloneState(beforeMaintenance);
  const previousIndex = nextState.turn.activeIndex;
  const nextIndex = findNextAliveIndex(nextState, previousIndex);
  const wrapped = nextIndex <= previousIndex && nextState.turn.initiativeOrder.length > 1;

  nextState.turn.activeIndex = nextIndex;
  if (wrapped) {
    nextState.turn.roundNumber += 1;
  }

  const activeParticipantId = getActiveParticipantId(nextState);
  nextState.participants[activeParticipantId].actionState = resetActionStateForTurn();

  const maintainedState = runMaintenanceCostsForActiveParticipant(nextState);
  maintainedState.events.push(
    createEvent(
      maintainedState,
      "turn_advanced",
      activeParticipantId,
      null,
      `Turn advanced to ${maintainedState.participants[activeParticipantId].profile.displayName}.`,
      {
        roundNumber: maintainedState.turn.roundNumber,
      }
    )
  );
  maintainedState.updatedAt = nowIso();
  return maintainedState;
}

function getGoverningStatValue(
  state: CombatState,
  actorParticipantId: ParticipantId,
  powerId: PowerId
): number {
  const actor = state.participants[actorParticipantId];
  if (!actor) {
    throw new RangeError("Actor does not exist.");
  }

  const governingStat = powerRuntimeLibrary[powerId].governingStat;
  return computeEffectiveCoreStats(state, actorParticipantId)[governingStat];
}

export function castPower(
  state: CombatState,
  cast: CastCommand,
  actorRole: OwnershipRole = "dm"
): CombatState {
  assertActiveCombat(state);
  const actorParticipantId = cast.actorParticipantId;
  ensureActorCanControl(state, actorParticipantId, actorRole);
  ensureActorTurn(state, actorParticipantId);

  const actor = state.participants[actorParticipantId];
  if (!actor) {
    throw new RangeError("Actor was not found.");
  }

  const powerLevel = getKnownPowerLevel(actor.profile.knownPowers, cast.powerId);
  if (powerLevel <= 0) {
    throw new RangeError("Actor does not know this power.");
  }

  const mechanics = getRuntimePowerLevel(cast.powerId, powerLevel);
  if (!mechanics) {
    throw new RangeError("Power mechanics could not be resolved.");
  }

  if (mechanics.actionType === null || mechanics.castMode === "none") {
    throw new RangeError("This power does not have an active cast action.");
  }

  if (!isActionCompatibleWithPower(cast.requestedAction, mechanics.actionType)) {
    throw new RangeError("Requested action is not compatible with this power.");
  }

  const nextState = cloneState(state);
  const actorInNextState = nextState.participants[actorParticipantId];
  if (!actorInNextState) {
    throw new RangeError("Actor no longer exists in state.");
  }

  const spendResolution = spendAction(
    actorInNextState.actionState,
    cast.requestedAction as RequestedAction
  );
  actorInNextState.actionState = spendResolution.nextState;

  if (actorInNextState.profile.currentMana < mechanics.manaCost) {
    throw new RangeError("Insufficient mana for this power.");
  }
  actorInNextState.profile.currentMana -= mechanics.manaCost;

  const targetParticipantId =
    cast.targetParticipantId ?? cast.actorParticipantId;

  if (!nextState.participants[targetParticipantId]) {
    throw new RangeError("Selected power target does not exist.");
  }

  let updatedState = nextState;

  if (mechanics.castMode === "buff") {
    updatedState = applyPowerBuffEffect(
      updatedState,
      actorParticipantId,
      targetParticipantId,
      cast.powerId,
      powerLevel,
      cast.selectedStat ?? null,
      actorRole
    );
  } else if (mechanics.castMode === "damage") {
    const governingStatValue = getGoverningStatValue(
      updatedState,
      actorParticipantId,
      cast.powerId
    );
    const target = updatedState.participants[targetParticipantId];
    if (!target) {
      throw new RangeError("Selected power target does not exist.");
    }
    const rawDamage = governingStatValue + (mechanics.directDamageBonus ?? 0);
    const finalDamage = resolveMagicalDamage(rawDamage, target.derived.soak);
    updatedState = applyDamage(updatedState, targetParticipantId, finalDamage);
  } else if (mechanics.castMode === "healing") {
    const governingStatValue = getGoverningStatValue(
      updatedState,
      actorParticipantId,
      cast.powerId
    );
    const healingAmount = governingStatValue + (mechanics.directHealingBonus ?? 0);
    updatedState = applyHealing(updatedState, targetParticipantId, healingAmount);
  } else if (mechanics.castMode === "control") {
    const target = updatedState.participants[targetParticipantId];
    if (!target) {
      throw new RangeError("Selected power target does not exist.");
    }
    target.effects.push({
      effectInstanceId: nextId("effect"),
      sourcePowerId: cast.powerId,
      sourcePowerLevel: powerLevel,
      appliedByParticipantId: actorParticipantId,
      targetParticipantId,
      label: "Crowd Controlled",
      modifiers: [],
      remainingRounds: mechanics.durationRounds,
      maintenanceManaCost: mechanics.maintenanceManaCost,
      metadata: {
        statusId: mechanics.statusId,
      },
    });
    if (!target.statuses.includes("crowd_controlled")) {
      target.statuses.push("crowd_controlled");
    }
    updatedState = recomputeAllParticipants(updatedState);
  } else if (mechanics.castMode === "summon") {
    updatedState = addSummon(
      updatedState,
      actorParticipantId,
      Math.max(1, mechanics.summonCount ?? 1)
    );
  }

  updatedState.events.push(
    createEvent(
      updatedState,
      "power_cast",
      actorParticipantId,
      targetParticipantId,
      `${actorInNextState.profile.displayName} cast ${powerRuntimeLibrary[cast.powerId].name} Lv ${powerLevel}.`,
      {
        powerId: cast.powerId,
        powerLevel,
        manaCost: mechanics.manaCost,
      }
    )
  );
  updatedState.updatedAt = nowIso();
  return updatedState;
}

export function dispatchAction(
  state: CombatState,
  command: CombatCommand,
  actorRole: OwnershipRole = "dm"
): CombatState {
  assertActiveCombat(state);

  if (command.kind === "cast_power") {
    return castPower(state, command.cast, actorRole);
  }

  const actorParticipantId = command.actorParticipantId;
  ensureActorCanControl(state, actorParticipantId, actorRole);
  ensureActorTurn(state, actorParticipantId);

  const nextState = cloneState(state);
  const actor = nextState.participants[actorParticipantId];
  if (!actor) {
    throw new RangeError("Actor was not found.");
  }

  if (command.kind === "consume_action") {
    const resolution = spendAction(actor.actionState, command.requestedAction);
    actor.actionState = resolution.nextState;
    nextState.events.push(
      createEvent(
        nextState,
        "action_consumed",
        actorParticipantId,
        null,
        `${actor.profile.displayName} consumed ${resolution.consumedFrom} (${resolution.requested}).`,
        {
          consumedFrom: resolution.consumedFrom,
          requested: resolution.requested,
        }
      )
    );
    nextState.updatedAt = nowIso();
    return nextState;
  }

  const target = nextState.participants[command.targetParticipantId];
  if (!target) {
    throw new RangeError("Attack target was not found.");
  }

  const actionResolution = spendAction(actor.actionState, command.requestedAction);
  actor.actionState = actionResolution.nextState;

  const hitResult = resolveHit(
    command.attackSuccesses,
    target.derived.armorClass,
    actor.profile.ownerRole === "player",
    target.profile.ownerRole === "player"
  );

  let damageApplied = 0;
  if (hitResult.hit) {
    const rawDamage = Math.max(0, Math.floor(command.damageAmount));
    damageApplied =
      command.damageKind === "physical"
        ? resolvePhysicalDamage(rawDamage + actor.derived.meleeDamage, target.derived.damageReduction)
        : resolveMagicalDamage(rawDamage, target.derived.soak);

    target.profile.currentHp = Math.max(0, target.profile.currentHp - damageApplied);
    target.defeated = target.profile.currentHp <= 0;
  }

  const withDerived = recomputeAllParticipants(nextState);
  withDerived.events.push(
    createEvent(
      withDerived,
      "attack_resolved",
      actorParticipantId,
      command.targetParticipantId,
      `${actor.profile.displayName} attacked ${target.profile.displayName} (${hitResult.hit ? "hit" : "miss"}).`,
      {
        hit: hitResult.hit,
        margin: hitResult.margin,
        damageApplied,
        damageKind: command.damageKind,
      }
    )
  );
  withDerived.updatedAt = nowIso();
  return withDerived;
}

export function resolve(
  state: CombatState,
  command: CombatCommand,
  actorRole: OwnershipRole = "dm"
): CombatState {
  return dispatchAction(state, command, actorRole);
}

export function finalizeCombat(
  state: CombatState,
  actorRole: OwnershipRole = "dm"
): CombatState {
  assertActiveCombat(state);
  if (state.authorizationMode === "role_enforced" && actorRole !== "dm") {
    throw new RangeError("Only DM can finalize combat in role-enforced mode.");
  }

  const nextState = cloneState(state);
  nextState.status = "completed";
  nextState.endedAt = nowIso();
  nextState.updatedAt = nextState.endedAt;
  nextState.events.push(
    createEvent(
      nextState,
      "combat_finalized",
      null,
      null,
      `Combat finalized: ${nextState.label}.`,
      {}
    )
  );
  return nextState;
}
