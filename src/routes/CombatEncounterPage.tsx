import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { resolveDicePool } from "../rules/combat";
import { buildCharacterEncounterSnapshot } from "../rules/combatEncounter";
import { buildCharacterDerivedValues } from "../config/characterRuntime";
import { applyDamageToSheet, applyHealingToSheet } from "../rules/combatResolution";
import {
  applyActivePowerEffect,
  doesActivePowerEffectConflict,
  isAuraSourceEffect,
  removeActivePowerEffect,
  removeAuraSharedEffectsForTarget,
  spendPowerMana,
} from "../rules/powerEffects";
import {
  getAuraSelectedTargetIds,
  prepareCastRequest,
} from "../lib/combatEncounterCasting";
import {
  preparePhysicalAttackRequest,
} from "../lib/combatEncounterPhysicalAttacks";
import {
  prepareBruteDefianceRequest,
} from "../lib/combatEncounterSpecialActions.ts";
import { rollD10Faces } from "../lib/dice";
import { createTimestampedId } from "../lib/ids.ts";
import { prependGameHistoryEntry } from "../lib/historyEntries";
import { buildItemIndex } from "../lib/items.ts";
import {
  incrementPerTargetDailyPowerUsageCount,
  incrementPowerUsageCount,
  setLongRestSelection,
} from "../lib/powerUsage";
import { buildEncounterRollTargets, getEncounterPartyMembers } from "../selectors/encounterViewModel";
import { useAppFlow } from "../state/appFlow";
import type {
  CastRequestPayload,
  EncounterParticipantView,
  EncounterRollTarget,
  PreparedCastRequest,
} from "../types/combatEncounterView";
import type { CharacterRecord } from "../types/character";
import { EncounterCastConfirmationDialog } from "../components/combat-encounter/EncounterCastConfirmationDialog";
import { EncounterActivityLogPanel } from "../components/combat-encounter/EncounterActivityLogPanel";
import { EncounterInitiativePanel } from "../components/combat-encounter/EncounterInitiativePanel";
import { EncounterPartiesPanel } from "../components/combat-encounter/EncounterPartiesPanel";
import { EncounterRollHelper } from "../components/combat-encounter/EncounterRollHelper";
import { EncounterTopbar } from "../components/combat-encounter/EncounterTopbar";

type RollResult = {
  labels: string[];
  poolSize: number;
  faces: number[];
  successes: number;
  isBotch: boolean;
};

type CustomRollModifier = {
  id: number;
  value: number;
};

type PendingCastConfirmation = {
  request: PreparedCastRequest;
  warnings: string[];
};

function formatEncounterTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }

  return date.toLocaleString();
}

function applySheetUpdater(
  currentSheet: CharacterRecord["sheet"],
  updater:
    | CharacterRecord["sheet"]
    | ((current: CharacterRecord["sheet"]) => CharacterRecord["sheet"])
): CharacterRecord["sheet"] {
  return typeof updater === "function" ? updater(currentSheet) : updater;
}

function normalizeStatusTagText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function buildEncounterLogEntry(summary: string) {
  return {
    id: createTimestampedId("encounter-log"),
    createdAt: new Date().toISOString(),
    summary,
  };
}

export function CombatEncounterPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    activeCombatEncounter,
    characters,
    items,
    updateCharacter,
    updateCombatEncounter,
  } = useAppFlow();
  const [pendingCastConfirmation, setPendingCastConfirmation] =
    useState<PendingCastConfirmation | null>(null);
  const [pendingCastError, setPendingCastError] = useState<string | null>(null);
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [dicePosition, setDicePosition] = useState({ x: 24, y: 24 });
  const [selectedCombatantId, setSelectedCombatantId] = useState("");
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [customRollInput, setCustomRollInput] = useState("");
  const [customRollModifiers, setCustomRollModifiers] = useState<CustomRollModifier[]>([]);
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const itemsById = buildItemIndex(items);
  const dragRef = useRef<{ active: boolean; moved: boolean; offsetX: number; offsetY: number }>(
    {
      active: false,
      moved: false,
      offsetX: 0,
      offsetY: 0,
    }
  );

  useEffect(() => {
    function handleMouseMove(event: globalThis.MouseEvent): void {
      if (!dragRef.current.active) {
        return;
      }

      dragRef.current.moved = true;
      setDicePosition({
        x: Math.max(24, window.innerWidth - event.clientX - dragRef.current.offsetX),
        y: Math.max(24, window.innerHeight - event.clientY - dragRef.current.offsetY),
      });
    }

    function handleMouseUp(): void {
      dragRef.current.active = false;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!pendingCastConfirmation) {
      return;
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setPendingCastConfirmation(null);
        setPendingCastError(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [pendingCastConfirmation]);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  if (!activeCombatEncounter) {
    return <Navigate to="/dm/combat" replace />;
  }

  const encounterParticipants: EncounterParticipantView[] = activeCombatEncounter.participants.map(
    (participant) => {
      const transientCombatant =
        activeCombatEncounter.transientCombatants.find(
          (entry) => entry.id === participant.characterId
        ) ?? null;
      const character =
        characters.find((entry) => entry.id === participant.characterId) ??
        (transientCombatant
          ? {
              id: transientCombatant.id,
              ownerRole: transientCombatant.ownerRole,
              sheet: transientCombatant.sheet,
            }
          : null);
      const snapshot = character ? buildCharacterEncounterSnapshot(character.sheet, itemsById) : null;

      return {
        participant,
        character,
        transientCombatant,
        snapshot,
      };
    }
  );
  const encounterParties = activeCombatEncounter.parties;
  const currentTurnState = activeCombatEncounter.turnState;
  const activeCombatantLabel =
    currentTurnState.activeParticipantId
      ? encounterParticipants.find(
          ({ participant }) => participant.characterId === currentTurnState.activeParticipantId
        )?.participant.displayName ?? null
      : null;
  const unassignedEncounterMembers = getEncounterPartyMembers(
    encounterParticipants,
    null,
    itemsById
  );
  const selectedCombatant =
    encounterParticipants.find(({ participant }) => participant.characterId === selectedCombatantId) ??
    encounterParticipants[0] ??
    null;
  const selectedSnapshot = selectedCombatant?.snapshot ?? null;
  const rollTargets = buildEncounterRollTargets(selectedSnapshot);
  const summaryRollTargets = rollTargets.filter((target) => target.category === "summary");
  const statRollTargets = rollTargets.filter((target) => target.category === "stat");
  const skillRollTargets = rollTargets.filter((target) => target.category === "skill");
  const selectedRollTargets = selectedRollIds
    .map((targetId) => rollTargets.find((target) => target.id === targetId))
    .filter((target): target is EncounterRollTarget => target !== undefined);
  const customRollPool = customRollModifiers.reduce((total, modifier) => total + modifier.value, 0);
  const selectedRollPool =
    selectedRollTargets.reduce((total, target) => total + target.value, 0) + customRollPool;

  useEffect(() => {
    if (encounterParticipants.length === 0) {
      setSelectedCombatantId("");
      return;
    }

    if (
      !selectedCombatantId ||
      !encounterParticipants.some(
        ({ participant }) => participant.characterId === selectedCombatantId
      )
    ) {
      setSelectedCombatantId(encounterParticipants[0].participant.characterId);
    }
  }, [encounterParticipants, selectedCombatantId]);

  useEffect(() => {
    setSelectedRollIds([]);
    setCustomRollModifiers([]);
    setCustomRollInput("");
    setLastRoll(null);
  }, [selectedCombatantId]);

  function openCharacterSheet(characterId: string, ownerRole: "player" | "dm"): void {
    const routePath = ownerRole === "dm" ? "/dm/npc-character" : "/dm/character";
    const popupUrl = `${routePath}?characterId=${encodeURIComponent(characterId)}`;

    window.open(popupUrl, "_blank", "popup=yes,width=1380,height=920,noopener,noreferrer");
  }

  function moveEncounterParticipantToParty(characterId: string, partyId: string | null): void {
    updateCombatEncounter((currentEncounter) => ({
      ...currentEncounter,
      participants: currentEncounter.participants.map((participant) =>
        participant.characterId === characterId
          ? {
              ...participant,
              partyId,
            }
          : participant
      ),
    }));
  }

  function updateEncounterCharacter(
    characterId: string,
    updater:
      | CharacterRecord["sheet"]
      | ((current: CharacterRecord["sheet"]) => CharacterRecord["sheet"])
  ): void {
    if (characters.some((entry) => entry.id === characterId)) {
      updateCharacter(characterId, updater);
      return;
    }

    updateCombatEncounter((currentEncounter) => ({
      ...currentEncounter,
      transientCombatants: currentEncounter.transientCombatants.map((entry) =>
        entry.id === characterId
          ? {
              ...entry,
              sheet: applySheetUpdater(entry.sheet, updater),
            }
          : entry
      ),
    }));
  }

  function resolveEncounterSheet(
    currentEncounter: NonNullable<typeof activeCombatEncounter>,
    characterId: string
  ): CharacterRecord["sheet"] | null {
    const persistedCharacter = characters.find((entry) => entry.id === characterId);
    if (persistedCharacter) {
      return persistedCharacter.sheet;
    }

    return (
      currentEncounter.transientCombatants.find((entry) => entry.id === characterId)?.sheet ?? null
    );
  }

  function applyStatusTagChange(change: PreparedCastRequest["statusTagChanges"][number]): void {
    updateEncounterCharacter(change.characterId, (currentSheet) => {
      if (change.operation === "add") {
        const alreadyExists = currentSheet.statusTags.some(
          (tag) =>
            tag.id === change.tag.id ||
            normalizeStatusTagText(tag.label) === normalizeStatusTagText(change.tag.label)
        );
        if (alreadyExists) {
          return currentSheet;
        }

        return {
          ...currentSheet,
          statusTags: [...currentSheet.statusTags, change.tag],
        };
      }

      return {
        ...currentSheet,
        statusTags: currentSheet.statusTags.filter(
          (tag) =>
            tag.id !== change.tag.id &&
            normalizeStatusTagText(tag.label) !== normalizeStatusTagText(change.tag.label)
        ),
      };
    });
  }

  function applyUsageCounterChange(change: PreparedCastRequest["usageCounterChanges"][number]): void {
    updateEncounterCharacter(change.characterId, (currentSheet) => {
      if (change.operation === "setSelection") {
        return {
          ...currentSheet,
          powerUsageState: setLongRestSelection(
            currentSheet.powerUsageState,
            change.key,
            change.value
          ),
        };
      }

      return {
        ...currentSheet,
        powerUsageState:
          change.scope === "perTargetDaily"
            ? incrementPerTargetDailyPowerUsageCount(
                currentSheet.powerUsageState,
                change.key,
                change.targetCharacterId ?? "",
                change.amount
              )
            : incrementPowerUsageCount(
                currentSheet.powerUsageState,
                change.scope,
                change.key,
                change.amount
              ),
      };
    });
  }

  function mergeEncounterStructuralChanges(
    currentEncounter: NonNullable<typeof activeCombatEncounter>,
    request: PreparedCastRequest,
    brokenCrowdControlStates: Array<
      Extract<(typeof currentEncounter.ongoingStates)[number], { kind: "crowd_control" }>
    >
  ): NonNullable<typeof activeCombatEncounter> {
    const dismissedIds = new Set(
      request.summonChanges
        .filter(
          (change): change is Extract<typeof request.summonChanges[number], { operation: "dismiss" }> =>
            change.operation === "dismiss"
        )
        .map((change) => change.summonId)
    );
    const explicitRemovedStateIds = new Set(
      request.ongoingStateChanges
        .filter(
          (change): change is Extract<typeof request.ongoingStateChanges[number], { operation: "remove" }> =>
            change.operation === "remove"
        )
        .map((change) => change.ongoingStateId)
    );
    const releasedCrowdControlTargets = request.ongoingStateChanges.filter(
      (
        change
      ): change is Extract<
        typeof request.ongoingStateChanges[number],
        { operation: "releaseCrowdControl" }
      > => change.operation === "releaseCrowdControl"
    );
    const addedStates = request.ongoingStateChanges.flatMap((change) =>
      change.operation === "add" ? [change.state] : []
    );
    let participants = currentEncounter.participants.filter(
      (participant) => !dismissedIds.has(participant.characterId)
    );
    let transientCombatants = currentEncounter.transientCombatants.filter(
      (entry) => !dismissedIds.has(entry.id)
    );
    let insertedCount = 0;

    request.summonChanges
      .filter(
        (change): change is Extract<typeof request.summonChanges[number], { operation: "spawn" }> =>
          change.operation === "spawn"
      )
      .forEach((change) => {
        transientCombatants = [...transientCombatants, change.summon];
        const casterIndex = participants.findIndex(
          (participant) => participant.characterId === request.casterCharacterId
        );
        const insertIndex = casterIndex >= 0 ? casterIndex + 1 + insertedCount : participants.length;
        participants = [
          ...participants.slice(0, insertIndex),
          change.participant,
          ...participants.slice(insertIndex),
        ];
        insertedCount += 1;
      });

    const activeParticipantId = participants.some(
      (participant) => participant.characterId === currentEncounter.turnState.activeParticipantId
    )
      ? currentEncounter.turnState.activeParticipantId
      : participants[currentEncounter.turnState.activeParticipantIndex]?.characterId ??
        participants[0]?.characterId ??
        null;

    return {
      ...currentEncounter,
      participants,
      transientCombatants,
      ongoingStates: [
        ...currentEncounter.ongoingStates.filter((state) => {
          if (brokenCrowdControlStates.some((brokenState) => brokenState.id === state.id)) {
            return false;
          }

          if (explicitRemovedStateIds.has(state.id)) {
            return false;
          }

          if (
            state.kind === "crowd_control" &&
            releasedCrowdControlTargets.some(
              (change) =>
                change.casterCharacterId === state.casterCharacterId &&
                change.targetCharacterId === state.targetCharacterId
            )
          ) {
            return false;
          }

          if (
            addedStates.some((addedState) => {
              if (addedState.kind !== state.kind) {
                return false;
              }

              if (state.kind === "crowd_control" && addedState.kind === "crowd_control") {
                return (
                  state.casterCharacterId === addedState.casterCharacterId &&
                  state.targetCharacterId === addedState.targetCharacterId
                );
              }

              if (state.kind === "expose_darkness" && addedState.kind === "expose_darkness") {
                return (
                  state.casterCharacterId === addedState.casterCharacterId &&
                  state.targetCharacterId === addedState.targetCharacterId
                );
              }

              if (
                state.kind === "body_reinforcement_revive" &&
                addedState.kind === "body_reinforcement_revive"
              ) {
                return state.characterId === addedState.characterId;
              }

              return false;
            })
          ) {
            return false;
          }

          return true;
        }),
        ...addedStates,
      ],
      activityLog: [...request.activityLogEntries, ...currentEncounter.activityLog].slice(0, 200),
      turnState: {
        ...currentEncounter.turnState,
        activeParticipantId,
      },
    };
  }

  function advanceEncounterTurn(): void {
    const currentEncounter = activeCombatEncounter;
    if (!currentEncounter || currentEncounter.participants.length === 0) {
      return;
    }
    const turnLogEntries: Array<ReturnType<typeof buildEncounterLogEntry>> = [];

    const currentIndex = Math.max(
      0,
      Math.min(currentEncounter.turnState.activeParticipantIndex, currentEncounter.participants.length - 1)
    );
    const nextIndex = (currentIndex + 1) % currentEncounter.participants.length;
    const nextRound =
      nextIndex <= currentIndex ? currentEncounter.turnState.round + 1 : currentEncounter.turnState.round;
    const nextActiveParticipantId =
      currentEncounter.participants[nextIndex]?.characterId ?? null;

    const nextOngoingStates = currentEncounter.ongoingStates.reduce<
      NonNullable<typeof activeCombatEncounter>["ongoingStates"]
    >((states, state) => {
      if (state.kind === "body_reinforcement_revive") {
        return states;
      }

      states.push(state);
      return states;
    }, []);

    const maintainedCrowdControlStates = nextOngoingStates.filter(
      (state): state is Extract<(typeof nextOngoingStates)[number], { kind: "crowd_control" }> =>
        state.kind === "crowd_control"
    );
    const nextControllerStates = nextActiveParticipantId
      ? maintainedCrowdControlStates.filter(
          (state) => state.casterCharacterId === nextActiveParticipantId
        )
      : [];

    if (nextControllerStates.length > 0 && nextActiveParticipantId) {
      const controllerSheet = resolveEncounterSheet(currentEncounter, nextActiveParticipantId);
      const totalMaintenanceCost = nextControllerStates.reduce(
        (sum, state) => sum + state.maintenanceManaCost,
        0
      );
      const maintenanceFailed =
        !controllerSheet ||
        ("error" in spendPowerMana(controllerSheet, totalMaintenanceCost, itemsById));

      if (totalMaintenanceCost > 0) {
        if (maintenanceFailed) {
          nextControllerStates.forEach((state) => {
            applyStatusTagChange({
              characterId: state.targetCharacterId,
              operation: "remove",
              tag: { id: "paralyzed", label: "Paralyzed" },
            });
            applyStatusTagChange({
              characterId: state.targetCharacterId,
              operation: "remove",
              tag: {
                id: `crowd_control:${state.casterCharacterId}`,
                label: `Controlled by ${currentEncounter.participants.find((participant) => participant.characterId === state.casterCharacterId)?.displayName ?? state.casterCharacterId}`,
              },
            });
          });
          turnLogEntries.push(
            buildEncounterLogEntry(
              `Crowd Control dropped because ${
                currentEncounter.participants.find(
                  (participant) => participant.characterId === nextActiveParticipantId
                )?.displayName ?? nextActiveParticipantId
              } could not pay upkeep.`
            )
          );
        } else {
          const spentMaintenance = spendPowerMana(
            controllerSheet!,
            totalMaintenanceCost,
            itemsById
          );
          if (!("error" in spentMaintenance)) {
            updateEncounterCharacter(nextActiveParticipantId, spentMaintenance.sheet);
          }
        }
      }

      if (maintenanceFailed) {
        for (let index = nextOngoingStates.length - 1; index >= 0; index -= 1) {
          const state = nextOngoingStates[index];
          if (
            state.kind === "crowd_control" &&
            state.casterCharacterId === nextActiveParticipantId
          ) {
            nextOngoingStates.splice(index, 1);
          }
        }
      }
    }

    currentEncounter.participants.forEach((participant) => {
      const sheet = resolveEncounterSheet(currentEncounter, participant.characterId);
      if (!sheet) {
        return;
      }

      const sourceEffects = (sheet.activePowerEffects ?? []).filter(isAuraSourceEffect);
      if (sourceEffects.length === 0) {
        return;
      }

      const isDeadSource =
        sheet.currentHp <= -10 ||
        sheet.statusTags.some(
          (tag) =>
            normalizeStatusTagText(tag.id) === "dead" ||
            normalizeStatusTagText(tag.label) === "dead"
        );
      if (!isDeadSource) {
        return;
      }

      sourceEffects.forEach((effect) => {
        getAuraSelectedTargetIds(effect)
          .filter((targetId) => targetId !== participant.characterId)
          .forEach((targetId) => {
            updateEncounterCharacter(targetId, (currentSheet) =>
              removeAuraSharedEffectsForTarget(currentSheet, effect, targetId)
            );
          });
        updateEncounterCharacter(participant.characterId, (currentSheet) =>
          removeActivePowerEffect(currentSheet, effect.id)
        );
      });
      turnLogEntries.push(
        buildEncounterLogEntry(`Aura effects ended because ${participant.displayName} is down.`)
      );
    });

    updateCombatEncounter((encounter) => ({
      ...encounter,
      activityLog: [...turnLogEntries, ...encounter.activityLog].slice(0, 200),
      ongoingStates: nextOngoingStates,
      turnState: {
        round: nextRound,
        activeParticipantIndex: nextIndex,
        activeParticipantId: nextActiveParticipantId,
      },
    }));
  }

  function executePreparedCast(request: PreparedCastRequest): string | null {
    const casterCharacter = characters.find((entry) => entry.id === request.casterCharacterId);
    const currentEncounter = activeCombatEncounter;
    if (!casterCharacter) {
      return "The casting character no longer resolves to a saved character sheet.";
    }
    if (!currentEncounter) {
      return "The active encounter is no longer available.";
    }

    const spentMana = spendPowerMana(casterCharacter.sheet, request.manaCost, itemsById);
    if ("error" in spentMana) {
      return spentMana.error;
    }
    updateEncounterCharacter(casterCharacter.id, () => spentMana.sheet);

    request.historyEntries.forEach((item) => {
      updateEncounterCharacter(item.characterId, (currentSheet) => ({
        ...currentSheet,
        gameHistory: prependGameHistoryEntry(currentSheet.gameHistory ?? [], item.entry),
      }));
    });

    request.resourceChanges.forEach((change) => {
      updateEncounterCharacter(change.characterId, (currentSheet) => {
        const derived = buildCharacterDerivedValues(currentSheet, itemsById);
        const currentValue =
          change.field === "currentMana"
            ? derived.currentMana
            : currentSheet[change.field];
        const rawNextValue =
          change.operation === "set" ? change.value : currentValue + change.value;
        const nextValue =
          change.field === "currentMana"
            ? Math.max(0, Math.min(Math.trunc(rawNextValue), derived.maxMana))
            : change.field === "temporaryHp"
              ? Math.max(0, Math.trunc(rawNextValue))
              : Math.trunc(rawNextValue);

        return {
          ...currentSheet,
          [change.field]: nextValue,
          ...(change.field === "currentMana" ? { manaInitialized: true } : null),
        };
      });
    });

    request.statusTagChanges.forEach(applyStatusTagChange);
    request.usageCounterChanges.forEach(applyUsageCounterChange);

    request.healingApplications.forEach((application) => {
      updateEncounterCharacter(application.targetCharacterId, (currentSheet) =>
        applyHealingToSheet(currentSheet, application.amount, {
          temporaryHpCap: application.temporaryHpCap,
          itemsById,
        }).sheet
      );
    });

    request.damageApplications.forEach((application) => {
      updateEncounterCharacter(application.targetCharacterId, (currentSheet) =>
        applyDamageToSheet(currentSheet, {
          rawAmount: application.rawAmount,
          damageType: application.damageType,
          mitigationChannel: application.mitigationChannel,
          itemsById,
        }).sheet
      );
    });

    const brokenCrowdControlStates = currentEncounter.ongoingStates.filter(
      (state): state is Extract<(typeof currentEncounter.ongoingStates)[number], { kind: "crowd_control" }> =>
        state.kind === "crowd_control" &&
        request.damageApplications.some(
          (application) =>
            application.targetCharacterId === state.targetCharacterId &&
            ((application.sourceCharacterId === state.casterCharacterId &&
              state.breaksOnDamageFromCaster) ||
              (application.sourceCharacterId !== state.casterCharacterId &&
                state.breaksOnDamageFromOthers))
        )
    );

    brokenCrowdControlStates.forEach((state) => {
      applyStatusTagChange({
        characterId: state.targetCharacterId,
        operation: "remove",
        tag: { id: "paralyzed", label: "Paralyzed" },
      });
      applyStatusTagChange({
        characterId: state.targetCharacterId,
        operation: "remove",
        tag: {
          id: `crowd_control:${state.casterCharacterId}`,
          label: `Controlled by ${state.casterCharacterId}`,
        },
      });
      applyStatusTagChange({
        characterId: state.targetCharacterId,
        operation: "add",
        tag: {
          id: "crowd_control_immunity",
          label: "Crowd Control Immune (1 day)",
        },
      });
    });

    updateCombatEncounter((currentEncounter) => {
      return mergeEncounterStructuralChanges(currentEncounter, request, brokenCrowdControlStates);
    });

    const auraSourceEffects = request.effects.filter((effect) => isAuraSourceEffect(effect));
    auraSourceEffects.forEach((sourceEffect) => {
      (casterCharacter.sheet.activePowerEffects ?? [])
        .filter(
          (existingEffect) =>
            isAuraSourceEffect(existingEffect) &&
            doesActivePowerEffectConflict(existingEffect, sourceEffect)
        )
        .forEach((existingEffect) => {
          getAuraSelectedTargetIds(existingEffect)
            .filter((targetId) => targetId !== casterCharacter.id)
            .forEach((targetId) => {
              updateEncounterCharacter(targetId, (currentSheet) =>
                removeAuraSharedEffectsForTarget(currentSheet, existingEffect, targetId)
              );
            });
        });
    });

    request.effects.forEach((effect) => {
      updateEncounterCharacter(effect.targetCharacterId, (currentSheet) =>
        applyActivePowerEffect(currentSheet, effect)
      );
    });

    return null;
  }

  function requestCast(payload: CastRequestPayload): string | null {
    const prepared = prepareCastRequest({
      ...payload,
      itemsById,
    });
    if ("error" in prepared) {
      return prepared.error;
    }

    setPendingCastError(null);
    if (prepared.warnings.length > 0) {
      setPendingCastConfirmation({
        request: prepared.request,
        warnings: prepared.warnings,
      });
      return null;
    }

    return executePreparedCast(prepared.request);
  }

  function requestPhysicalAttack(payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
  }): string | null {
    const casterCharacter = payload.casterView.character;
    const targetCharacter = payload.targetView.character;
    if (!casterCharacter || !targetCharacter) {
      return "The selected combatants no longer resolve to character sheets.";
    }

    const prepared = preparePhysicalAttackRequest({
      casterCharacter,
      targetCharacter,
      itemsById,
    });
    if ("error" in prepared) {
      return prepared.error;
    }

    return executePreparedCast(prepared.request);
  }

  function requestBruteDefiance(payload: {
    view: EncounterParticipantView;
  }): string | null {
    const character = payload.view.character;
    if (!character) {
      return "The selected combatant no longer resolves to a character sheet.";
    }

    const prepared = prepareBruteDefianceRequest({
      character,
    });
    if ("error" in prepared) {
      return prepared.error;
    }

    return executePreparedCast(prepared.request);
  }

  function closePendingCastConfirmation(): void {
    setPendingCastConfirmation(null);
    setPendingCastError(null);
  }

  function confirmPendingCast(): void {
    if (!pendingCastConfirmation) {
      return;
    }

    const error = executePreparedCast(pendingCastConfirmation.request);
    if (error) {
      setPendingCastError(error);
      return;
    }

    setPendingCastConfirmation(null);
    setPendingCastError(null);
  }

  function handleDiceMouseDown(event: ReactMouseEvent<HTMLButtonElement>): void {
    dragRef.current.active = true;
    dragRef.current.moved = false;
    dragRef.current.offsetX = window.innerWidth - event.clientX - dicePosition.x;
    dragRef.current.offsetY = window.innerHeight - event.clientY - dicePosition.y;
  }

  function handleDiceClick(): void {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }

    setIsDiceOpen((open) => !open);
  }

  function toggleRollTarget(targetId: string): void {
    setSelectedRollIds((currentIds) => {
      if (currentIds.includes(targetId)) {
        return currentIds.filter((entryId) => entryId !== targetId);
      }

      if (currentIds.length >= 9) {
        return currentIds;
      }

      return [...currentIds, targetId];
    });
  }

  function handleAddCustomRollModifier(): void {
    const value = Number.parseInt(customRollInput.trim(), 10);
    if (!Number.isFinite(value) || value === 0) {
      return;
    }

    setCustomRollModifiers((currentModifiers) => [
      ...currentModifiers,
      {
        id: currentModifiers.length + 1,
        value,
      },
    ]);
    setCustomRollInput("");
  }

  function removeCustomRollModifier(modifierId: number): void {
    setCustomRollModifiers((currentModifiers) =>
      currentModifiers.filter((modifier) => modifier.id !== modifierId)
    );
  }

  function handleRoll(): void {
    if (selectedRollTargets.length === 0 && customRollModifiers.length === 0) {
      return;
    }

    const faces = rollD10Faces(selectedRollPool);
    const resolution = resolveDicePool(faces, selectedRollPool);

    setLastRoll({
      labels: [
        ...selectedRollTargets.map((target) => target.label),
        ...customRollModifiers.map(
          (modifier) => `Custom ${modifier.value >= 0 ? "+" : ""}${modifier.value}`
        ),
      ],
      poolSize: selectedRollPool,
      faces,
      successes: resolution.successes,
      isBotch: resolution.isBotch,
    });
  }

  function clearRollHelper(): void {
    setSelectedRollIds([]);
    setCustomRollModifiers([]);
    setCustomRollInput("");
    setLastRoll(null);
  }

  return (
    <main className="dm-page">
      <EncounterRollHelper
        isDiceOpen={isDiceOpen}
        dicePosition={dicePosition}
        selectedCombatant={selectedCombatant}
        selectedSnapshot={selectedSnapshot}
        encounterParticipants={encounterParticipants}
        summaryRollTargets={summaryRollTargets}
        statRollTargets={statRollTargets}
        skillRollTargets={skillRollTargets}
        selectedRollIds={selectedRollIds}
        selectedRollTargets={selectedRollTargets}
        customRollInput={customRollInput}
        customRollModifiers={customRollModifiers}
        selectedRollPool={selectedRollPool}
        lastRoll={lastRoll}
        onDiceMouseDown={handleDiceMouseDown}
        onDiceClick={handleDiceClick}
        onSelectCombatant={setSelectedCombatantId}
        onToggleRollTarget={toggleRollTarget}
        onCustomRollInputChange={setCustomRollInput}
        onAddCustomRollModifier={handleAddCustomRollModifier}
        onRemoveCustomRollModifier={removeCustomRollModifier}
        onRoll={handleRoll}
        onClear={clearRollHelper}
      />

      <section className="dm-shell">
        <EncounterTopbar
          currentRound={currentTurnState.round}
          activeCombatantLabel={activeCombatantLabel}
          onAdvanceTurn={advanceEncounterTurn}
          onOpenCombatDashboard={() => navigate("/dm/combat")}
          onOpenDmDashboard={() => navigate("/dm")}
        />

        <section className="dm-encounter-layout">
          <article className="sheet-card">
            <p className="section-kicker">Combat Encounter</p>
            <h2>{activeCombatEncounter.label}</h2>
            <p className="dm-summary-line">
              Initiative has been rolled for {activeCombatEncounter.participants.length} combatants.
            </p>
            <div className="dm-action-grid">
              <div>
                <span>Created</span>
                <strong>{formatEncounterTime(activeCombatEncounter.createdAt)}</strong>
              </div>
              <div>
                <span>Combat Encounter Id</span>
                <strong>{activeCombatEncounter.encounterId}</strong>
              </div>
            </div>
          </article>

          <EncounterPartiesPanel
            encounterParties={encounterParties}
            encounterParticipants={encounterParticipants}
            unassignedEncounterMembers={unassignedEncounterMembers}
            moveEncounterParticipantToParty={moveEncounterParticipantToParty}
          />

          <EncounterActivityLogPanel activityLog={activeCombatEncounter.activityLog} />

          <EncounterInitiativePanel
              encounterParticipants={encounterParticipants}
              itemsById={itemsById}
              openCharacterSheet={openCharacterSheet}
              requestCast={requestCast}
              requestPhysicalAttack={requestPhysicalAttack}
              requestBruteDefiance={requestBruteDefiance}
              updateCharacter={updateEncounterCharacter}
            />
        </section>
      </section>

      <EncounterCastConfirmationDialog
        pendingCastConfirmation={pendingCastConfirmation}
        pendingCastError={pendingCastError}
        onClose={closePendingCastConfirmation}
        onConfirm={confirmPendingCast}
      />
    </main>
  );
}

