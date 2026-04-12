import { buildCharacterDerivedValues } from "../config/characterRuntime.ts";
import { prependGameHistoryEntry } from "../lib/historyEntries.ts";
import { createTimestampedId } from "../lib/ids.ts";
import {
  applyKnowledgeBatch,
  buildLinkedCharacterKnowledgeBatchFromIntelEntry,
} from "../lib/knowledge.ts";
import {
  incrementPerTargetDailyPowerUsageCount,
  POWER_USAGE_KEYS,
  incrementPowerUsageCount,
  setLongRestSelection,
} from "../lib/powerUsage.ts";
import { getBruteDefianceState } from "../lib/combatEncounterSpecialActions.ts";
import { applyDamageToSheet, applyHealingToSheet } from "../rules/combatResolution.ts";
import {
  applyActivePowerEffect,
  doesActivePowerEffectConflict,
  isAuraSourceEffect,
  removeActivePowerEffect,
  removeAuraSharedEffectsForTarget,
  spendPowerMana,
} from "../rules/powerEffects.ts";
import { getAuraSelectedTargetIds } from "../powers/runtimeSupport.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { ActivePowerEffect } from "../types/activePowerEffects.ts";
import type { CombatEncounterState, EncounterOngoingState } from "../types/combatEncounter.ts";
import type { PreparedCastRequest } from "../types/combatEncounterView.ts";
import type { SharedItemRecord } from "../types/items.ts";
import type { KnowledgeState } from "../types/knowledge.ts";

type CharacterSheetUpdater =
  | CharacterRecord["sheet"]
  | ((current: CharacterRecord["sheet"]) => CharacterRecord["sheet"]);

export type EncounterExecutionResult = {
  characters: CharacterRecord[];
  encounter: CombatEncounterState;
  knowledgeState: KnowledgeState;
};

type EncounterExecutionEngineArgs = {
  characters: CharacterRecord[];
  encounter: CombatEncounterState;
  knowledgeState: KnowledgeState;
  itemsById: Record<string, SharedItemRecord>;
};

function applySheetUpdater(
  currentSheet: CharacterRecord["sheet"],
  updater: CharacterSheetUpdater
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

export class EncounterExecutionEngine {
  private characters: CharacterRecord[];
  private encounter: CombatEncounterState;
  private knowledgeState: KnowledgeState;
  private itemsById: Record<string, SharedItemRecord>;

  constructor(args: EncounterExecutionEngineArgs) {
    this.characters = args.characters.slice();
    this.encounter = {
      ...args.encounter,
      parties: args.encounter.parties.slice(),
      participants: args.encounter.participants.slice(),
      transientCombatants: args.encounter.transientCombatants.slice(),
      ongoingStates: args.encounter.ongoingStates.slice(),
      activityLog: args.encounter.activityLog.slice(),
      turnState: { ...args.encounter.turnState },
    };
    this.knowledgeState = {
      knowledgeEntities: args.knowledgeState.knowledgeEntities.slice(),
      knowledgeRevisions: args.knowledgeState.knowledgeRevisions.slice(),
      knowledgeOwnerships: args.knowledgeState.knowledgeOwnerships.slice(),
    };
    this.itemsById = args.itemsById;
  }

  executePreparedRequest(
    request: PreparedCastRequest
  ): { error: string } | { result: EncounterExecutionResult } {
    const casterCharacter = this.characters.find((entry) => entry.id === request.casterCharacterId);
    if (!casterCharacter) {
      return { error: "The casting character no longer resolves to a saved character sheet." };
    }

    const spentMana = spendPowerMana(casterCharacter.sheet, request.manaCost, this.itemsById);
    if ("error" in spentMana) {
      return { error: spentMana.error };
    }
    this.updateEncounterCharacter(casterCharacter.id, () => spentMana.sheet);

    const resolvedHistoryEntries = request.historyEntries.map((item) => {
      const historyEntry = item.entry;
      if (historyEntry.type !== "intel_snapshot" || !historyEntry.targetCharacterId) {
        return item;
      }

      const targetCharacter =
        this.characters.find((entry) => entry.id === historyEntry.targetCharacterId) ??
        this.encounter.transientCombatants
          .filter((entry) => entry.id === historyEntry.targetCharacterId)
          .map((entry) => ({
            id: entry.id,
            ownerRole: entry.ownerRole,
            sheet: entry.sheet,
          }))[0] ??
        null;

      if (!targetCharacter) {
        return item;
      }

      const linked = buildLinkedCharacterKnowledgeBatchFromIntelEntry({
        state: this.knowledgeState,
        casterCharacter,
        targetCharacter,
        entry: historyEntry,
      });
      this.knowledgeState = applyKnowledgeBatch(this.knowledgeState, linked.batch);

      return {
        ...item,
        entry: linked.entry,
      };
    });

    resolvedHistoryEntries.forEach((item) => {
      this.updateEncounterCharacter(item.characterId, (currentSheet) => ({
        ...currentSheet,
        gameHistory: prependGameHistoryEntry(currentSheet.gameHistory ?? [], item.entry),
      }));
    });

    request.resourceChanges.forEach((change) => {
      this.updateEncounterCharacter(change.characterId, (currentSheet) => {
        const derived = buildCharacterDerivedValues(currentSheet, this.itemsById);
        const currentValue =
          change.field === "currentMana" ? derived.currentMana : currentSheet[change.field];
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

    request.statusTagChanges.forEach((change) => this.applyStatusTagChange(change));
    request.usageCounterChanges.forEach((change) => this.applyUsageCounterChange(change));

    request.healingApplications.forEach((application) => {
      this.updateEncounterCharacter(application.targetCharacterId, (currentSheet) =>
        applyHealingToSheet(currentSheet, application.amount, {
          temporaryHpCap: application.temporaryHpCap,
          itemsById: this.itemsById,
        }).sheet
      );
    });

    request.damageApplications.forEach((application) => {
      this.updateEncounterCharacter(application.targetCharacterId, (currentSheet) =>
        applyDamageToSheet(currentSheet, {
          rawAmount: application.rawAmount,
          damageType: application.damageType,
          mitigationChannel: application.mitigationChannel,
          armorPenetration: application.armorPenetration,
          itemsById: this.itemsById,
        }).sheet
      );
    });

    const brokenCrowdControlStates = this.encounter.ongoingStates.filter(
      (state): state is Extract<EncounterOngoingState, { kind: "crowd_control" }> =>
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
      this.applyStatusTagChange({
        characterId: state.targetCharacterId,
        operation: "remove",
        tag: { id: "paralyzed", label: "Paralyzed" },
      });
      this.applyStatusTagChange({
        characterId: state.targetCharacterId,
        operation: "remove",
        tag: {
          id: `crowd_control:${state.casterCharacterId}`,
          label: `Controlled by ${state.casterCharacterId}`,
        },
      });
      this.applyStatusTagChange({
        characterId: state.targetCharacterId,
        operation: "add",
        tag: {
          id: "crowd_control_immunity",
          label: "Crowd Control Immune (1 day)",
        },
      });
    });

    this.encounter = this.mergeEncounterStructuralChanges(
      this.encounter,
      request,
      brokenCrowdControlStates
    );

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
              this.updateEncounterCharacter(targetId, (currentSheet) =>
                removeAuraSharedEffectsForTarget(currentSheet, existingEffect, targetId)
              );
            });
        });
    });

    request.effects.forEach((effect) => {
      this.updateEncounterCharacter(effect.targetCharacterId, (currentSheet) =>
        applyActivePowerEffect(currentSheet, effect)
      );
    });

    const bruteDefianceLogEntries = this.scheduleAutomaticBruteDefiance();
    if (bruteDefianceLogEntries.length > 0) {
      this.encounter = {
        ...this.encounter,
        activityLog: [...bruteDefianceLogEntries, ...this.encounter.activityLog].slice(0, 200),
      };
    }

    return { result: this.getResult() };
  }

  advanceTurn(): EncounterExecutionResult {
    if (this.encounter.participants.length === 0) {
      return this.getResult();
    }

    const turnLogEntries: Array<ReturnType<typeof buildEncounterLogEntry>> = [];
    const currentIndex = Math.max(
      0,
      Math.min(this.encounter.turnState.activeParticipantIndex, this.encounter.participants.length - 1)
    );
    const nextIndex = (currentIndex + 1) % this.encounter.participants.length;
    const nextRound =
      nextIndex <= currentIndex ? this.encounter.turnState.round + 1 : this.encounter.turnState.round;
    const nextActiveParticipantId = this.encounter.participants[nextIndex]?.characterId ?? null;

    const nextOngoingStates: EncounterOngoingState[] = [];
    this.encounter.ongoingStates.forEach((state) => {
      if (state.kind !== "body_reinforcement_revive") {
        nextOngoingStates.push(state);
        return;
      }

      if (state.remainingTurnAdvances > 1) {
        nextOngoingStates.push({
          ...state,
          remainingTurnAdvances: state.remainingTurnAdvances - 1,
        });
        return;
      }

      const characterSheet = this.resolveEncounterSheet(state.characterId);
      if (!characterSheet || characterSheet.currentHp > 0) {
        return;
      }

      this.updateEncounterCharacter(state.characterId, {
        ...characterSheet,
        currentHp: state.reviveHp,
        statusTags: characterSheet.statusTags.filter(
          (tag) => !["dead", "dying", "unconscious"].includes(tag.id)
        ),
      });
      turnLogEntries.push(
        buildEncounterLogEntry(
          `Brute Defiance revived ${
            this.encounter.participants.find((participant) => participant.characterId === state.characterId)
              ?.displayName ?? state.characterId
          } to ${state.reviveHp} HP.`
        )
      );
    });

    const maintainedCrowdControlStates = nextOngoingStates.filter(
      (state): state is Extract<EncounterOngoingState, { kind: "crowd_control" }> =>
        state.kind === "crowd_control"
    );
    const nextControllerStates = nextActiveParticipantId
      ? maintainedCrowdControlStates.filter(
          (state) => state.casterCharacterId === nextActiveParticipantId
        )
      : [];

    if (nextControllerStates.length > 0 && nextActiveParticipantId) {
      const controllerSheet = this.resolveEncounterSheet(nextActiveParticipantId);
      const totalMaintenanceCost = nextControllerStates.reduce(
        (sum, state) => sum + state.maintenanceManaCost,
        0
      );
      const maintenanceFailed =
        !controllerSheet ||
        ("error" in spendPowerMana(controllerSheet, totalMaintenanceCost, this.itemsById));

      if (totalMaintenanceCost > 0) {
        if (maintenanceFailed) {
          nextControllerStates.forEach((state) => {
            this.applyStatusTagChange({
              characterId: state.targetCharacterId,
              operation: "remove",
              tag: { id: "paralyzed", label: "Paralyzed" },
            });
            this.applyStatusTagChange({
              characterId: state.targetCharacterId,
              operation: "remove",
              tag: {
                id: `crowd_control:${state.casterCharacterId}`,
                label: `Controlled by ${this.encounter.participants.find((participant) => participant.characterId === state.casterCharacterId)?.displayName ?? state.casterCharacterId}`,
              },
            });
          });
          turnLogEntries.push(
            buildEncounterLogEntry(
              `Crowd Control dropped because ${
                this.encounter.participants.find(
                  (participant) => participant.characterId === nextActiveParticipantId
                )?.displayName ?? nextActiveParticipantId
              } could not pay upkeep.`
            )
          );
        } else {
          const spentMaintenance = spendPowerMana(
            controllerSheet!,
            totalMaintenanceCost,
            this.itemsById
          );
          if (!("error" in spentMaintenance)) {
            this.updateEncounterCharacter(nextActiveParticipantId, spentMaintenance.sheet);
          }
        }
      }

      if (maintenanceFailed) {
        for (let index = nextOngoingStates.length - 1; index >= 0; index -= 1) {
          const state = nextOngoingStates[index];
          if (state.kind === "crowd_control" && state.casterCharacterId === nextActiveParticipantId) {
            nextOngoingStates.splice(index, 1);
          }
        }
      }
    }

    this.encounter.participants.forEach((participant) => {
      const sheet = this.resolveEncounterSheet(participant.characterId);
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
            this.updateEncounterCharacter(targetId, (currentSheet) =>
              removeAuraSharedEffectsForTarget(currentSheet, effect, targetId)
            );
          });
        this.updateEncounterCharacter(participant.characterId, (currentSheet) =>
          removeActivePowerEffect(currentSheet, effect.id)
        );
      });
      turnLogEntries.push(
        buildEncounterLogEntry(`Aura effects ended because ${participant.displayName} is down.`)
      );
    });

    this.encounter = {
      ...this.encounter,
      activityLog: [...turnLogEntries, ...this.encounter.activityLog].slice(0, 200),
      ongoingStates: nextOngoingStates,
      turnState: {
        round: nextRound,
        activeParticipantIndex: nextIndex,
        activeParticipantId: nextActiveParticipantId,
      },
    };

    return this.getResult();
  }

  private getResult(): EncounterExecutionResult {
    return {
      characters: this.characters,
      encounter: this.encounter,
      knowledgeState: this.knowledgeState,
    };
  }

  private updateEncounterCharacter(characterId: string, updater: CharacterSheetUpdater): void {
    if (this.characters.some((entry) => entry.id === characterId)) {
      this.characters = this.characters.map((entry) =>
        entry.id === characterId
          ? {
              ...entry,
              sheet: applySheetUpdater(entry.sheet, updater),
            }
          : entry
      );
      return;
    }

    this.encounter = {
      ...this.encounter,
      transientCombatants: this.encounter.transientCombatants.map((entry) =>
        entry.id === characterId
          ? {
              ...entry,
              sheet: applySheetUpdater(entry.sheet, updater),
            }
          : entry
      ),
    };
  }

  private resolveEncounterSheet(characterId: string): CharacterRecord["sheet"] | null {
    const persistedCharacter = this.characters.find((entry) => entry.id === characterId);
    if (persistedCharacter) {
      return persistedCharacter.sheet;
    }

    return this.encounter.transientCombatants.find((entry) => entry.id === characterId)?.sheet ?? null;
  }

  private applyStatusTagChange(
    change: PreparedCastRequest["statusTagChanges"][number]
  ): void {
    this.updateEncounterCharacter(change.characterId, (currentSheet) => {
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

  private applyUsageCounterChange(
    change: PreparedCastRequest["usageCounterChanges"][number]
  ): void {
    this.updateEncounterCharacter(change.characterId, (currentSheet) => {
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

  private mergeEncounterStructuralChanges(
    currentEncounter: CombatEncounterState,
    request: PreparedCastRequest,
    brokenCrowdControlStates: Array<Extract<EncounterOngoingState, { kind: "crowd_control" }>>
  ): CombatEncounterState {
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

  private scheduleAutomaticBruteDefiance(): ReturnType<typeof buildEncounterLogEntry>[] {
    const logEntries: Array<ReturnType<typeof buildEncounterLogEntry>> = [];

    this.characters.forEach((character) => {
      const reviveState = getBruteDefianceState(character, this.encounter.ongoingStates);
      if (!reviveState.isAvailable || !reviveState.isEligible) {
        return;
      }

      this.updateEncounterCharacter(character.id, (currentSheet) => ({
        ...currentSheet,
        powerUsageState: incrementPowerUsageCount(
          currentSheet.powerUsageState,
          "daily",
          POWER_USAGE_KEYS.bodyReinforcementRevive,
          1
        ),
      }));
      this.encounter = {
        ...this.encounter,
        ongoingStates: [
          ...this.encounter.ongoingStates,
          {
            id: createTimestampedId("body-reinforcement-revive"),
            kind: "body_reinforcement_revive",
            characterId: character.id,
            reviveHp: reviveState.reviveHp,
            remainingTurnAdvances: 1,
          },
        ],
      };
      logEntries.push(
        buildEncounterLogEntry(
          `Brute Defiance will revive ${character.sheet.name.trim() || character.id} to ${
            reviveState.reviveHp
          } HP after one turn.`
        )
      );
    });

    return logEntries;
  }
}
