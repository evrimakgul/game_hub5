import { useEffect, useRef, useState, type RefObject } from "react";

import {
  applyActivePowerEffect,
  buildLinkedAuraEffectForTarget,
  doesActivePowerEffectConflict,
  isAuraSharedEffect,
  isAuraSourceEffect,
  removeActivePowerEffect,
  removeAuraSharedEffectsForTarget,
  updateAuraSourceTargets,
} from "../rules/powerEffects";
import {
  canEncounterTargetReceiveGroupBuff,
  getAuraSelectedTargetIds,
  isTargetAffectedByAuraSource,
} from "../lib/combatEncounterCasting";
import type { ActivePowerEffect } from "../types/activePowerEffects";
import type {
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../types/combatEncounterView";

type UseAuraEffectManagerParams = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

export type AuraEffectManagerState = {
  openAuraEffectId: string | null;
  auraPopoverRef: RefObject<HTMLDivElement | null>;
  toggleAuraPopover: (effectId: string) => void;
  handleRemoveEffect: (effect: ActivePowerEffect) => void;
  isAuraTargetSelected: (effect: ActivePowerEffect, targetId: string) => boolean;
  toggleAuraTarget: (effect: ActivePowerEffect, targetId: string) => void;
  applyAuraToAllAllies: (effect: ActivePowerEffect) => void;
};

export function useAuraEffectManager({
  view,
  encounterParticipants,
  updateCharacter,
}: UseAuraEffectManagerParams): AuraEffectManagerState {
  const [openAuraEffectId, setOpenAuraEffectId] = useState<string | null>(null);
  const auraPopoverRef = useRef<HTMLDivElement | null>(null);
  const character = view.character;

  useEffect(() => {
    if (!openAuraEffectId) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (!auraPopoverRef.current?.contains(event.target as Node)) {
        setOpenAuraEffectId(null);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpenAuraEffectId(null);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [openAuraEffectId]);

  function getLatestSourceEffect(sourceEffect: ActivePowerEffect): ActivePowerEffect | null {
    if (!character) {
      return null;
    }

    return (character.sheet.activePowerEffects ?? []).find((effect) => effect.id === sourceEffect.id) ?? sourceEffect;
  }

  function getCasterPartyId(sourceEffect: ActivePowerEffect): string | null {
    return (
      encounterParticipants.find(
        ({ participant }) => participant.characterId === sourceEffect.casterCharacterId
      )?.participant.partyId ?? null
    );
  }

  function isEnemyLightAuraTarget(
    sourceEffect: ActivePowerEffect,
    targetView: EncounterParticipantView
  ): boolean {
    const casterPartyId = getCasterPartyId(sourceEffect);
    return (
      sourceEffect.powerId === "light_support" &&
      sourceEffect.sourceLevel >= 5 &&
      targetView.participant.partyId !== null &&
      casterPartyId !== null &&
      targetView.participant.partyId !== casterPartyId
    );
  }

  function canSelectAuraTarget(
    sourceEffect: ActivePowerEffect,
    targetView: EncounterParticipantView
  ): boolean {
    if (targetView.character === null) {
      return false;
    }

    if (targetView.participant.characterId === sourceEffect.casterCharacterId) {
      return true;
    }

    return (
      canEncounterTargetReceiveGroupBuff(targetView) ||
      isEnemyLightAuraTarget(sourceEffect, targetView)
    );
  }

  function applyAuraTargets(sourceEffect: ActivePowerEffect, rawTargetIds: string[]): void {
    const latestSourceEffect = getLatestSourceEffect(sourceEffect);
    if (!latestSourceEffect) {
      return;
    }

    const nextTargetIds = Array.from(
      new Set(
        [latestSourceEffect.casterCharacterId, ...rawTargetIds].filter(
          (targetId) =>
            targetId === latestSourceEffect.casterCharacterId ||
            encounterParticipants.some(
              (view) =>
                view.participant.characterId === targetId &&
                canSelectAuraTarget(latestSourceEffect, view)
            )
        )
      )
    );
    const currentTargetIds = encounterParticipants.flatMap(({ participant, character: targetCharacter }) => {
      if (!targetCharacter || !isTargetAffectedByAuraSource(latestSourceEffect, targetCharacter)) {
        return [];
      }

      return [participant.characterId];
    });
    const targetIdsToRemove = currentTargetIds.filter(
      (targetId) => targetId !== latestSourceEffect.casterCharacterId && !nextTargetIds.includes(targetId)
    );
    const targetIdsToAdd = nextTargetIds.filter(
      (targetId) => targetId !== latestSourceEffect.casterCharacterId && !currentTargetIds.includes(targetId)
    );

    updateCharacter(latestSourceEffect.casterCharacterId, (currentSheet) =>
      updateAuraSourceTargets(currentSheet, latestSourceEffect.id, nextTargetIds)
    );

    targetIdsToRemove.forEach((targetId) => {
      updateCharacter(targetId, (currentSheet) =>
        removeAuraSharedEffectsForTarget(currentSheet, latestSourceEffect, targetId)
      );
    });

    targetIdsToAdd.forEach((targetId) => {
      const targetCharacter =
        encounterParticipants.find(({ participant }) => participant.characterId === targetId)?.character ?? null;
      if (!targetCharacter) {
        return;
      }

      const targetView =
        encounterParticipants.find(({ participant }) => participant.characterId === targetId) ?? null;
      if (!targetView) {
        return;
      }

      const nextSharedEffect = buildLinkedAuraEffectForTarget(latestSourceEffect, targetId, {
        targetDisposition: isEnemyLightAuraTarget(latestSourceEffect, targetView) ? "enemy" : "ally",
      });
      const conflictingAura = (targetCharacter.sheet.activePowerEffects ?? []).find(
        (candidate) =>
          isAuraSharedEffect(candidate) &&
          candidate.sourceEffectId !== latestSourceEffect.id &&
          doesActivePowerEffectConflict(candidate, nextSharedEffect)
      );

      if (conflictingAura?.sourceEffectId) {
        const conflictingSourceEffectId = conflictingAura.sourceEffectId;
        updateCharacter(conflictingAura.casterCharacterId, (currentSheet) => {
          const existingSourceEffect = (currentSheet.activePowerEffects ?? []).find(
            (candidate) => candidate.id === conflictingSourceEffectId
          );
          if (!existingSourceEffect) {
            return currentSheet;
          }

          return updateAuraSourceTargets(
            currentSheet,
            conflictingSourceEffectId,
            getAuraSelectedTargetIds(existingSourceEffect).filter((entryId) => entryId !== targetId)
          );
        });
      }

      updateCharacter(targetId, (currentSheet) => applyActivePowerEffect(currentSheet, nextSharedEffect));
    });
  }

  function handleRemoveEffect(effect: ActivePowerEffect): void {
    const casterCharacter = view.character;
    if (!casterCharacter) {
      return;
    }

    if (isAuraSourceEffect(effect)) {
      getAuraSelectedTargetIds(effect)
        .filter((targetId) => targetId !== effect.casterCharacterId)
        .forEach((targetId) => {
          updateCharacter(targetId, (currentSheet) =>
            removeAuraSharedEffectsForTarget(currentSheet, effect, targetId)
          );
        });
      setOpenAuraEffectId((currentEffectId) => (currentEffectId === effect.id ? null : currentEffectId));
      updateCharacter(casterCharacter.id, (currentSheet) => removeActivePowerEffect(currentSheet, effect.id));
      return;
    }

    if (isAuraSharedEffect(effect) && effect.sourceEffectId) {
      const sourceEffectId = effect.sourceEffectId;
      updateCharacter(effect.casterCharacterId, (currentSheet) => {
        const sourceEffect = (currentSheet.activePowerEffects ?? []).find(
          (candidate) => candidate.id === sourceEffectId
        );
        if (!sourceEffect) {
          return currentSheet;
        }

        return updateAuraSourceTargets(
          currentSheet,
          sourceEffectId,
          getAuraSelectedTargetIds(sourceEffect).filter((targetId) => targetId !== casterCharacter.id)
        );
      });
    }

    updateCharacter(casterCharacter.id, (currentSheet) => removeActivePowerEffect(currentSheet, effect.id));
  }

  function isAuraTargetSelected(effect: ActivePowerEffect, targetId: string): boolean {
    const targetCharacter =
      encounterParticipants.find(({ participant }) => participant.characterId === targetId)?.character ?? null;

    return targetCharacter ? isTargetAffectedByAuraSource(effect, targetCharacter) : false;
  }

  function toggleAuraTarget(sourceEffect: ActivePowerEffect, targetId: string): void {
    const latestSourceEffect = getLatestSourceEffect(sourceEffect);
    if (!latestSourceEffect) {
      return;
    }

    const targetCharacter =
      encounterParticipants.find(({ participant }) => participant.characterId === targetId)?.character ?? null;
    if (!targetCharacter) {
      return;
    }
    const targetView =
      encounterParticipants.find(({ participant }) => participant.characterId === targetId) ?? null;
    if (!targetView || !canSelectAuraTarget(latestSourceEffect, targetView)) {
      return;
    }

    const isCurrentlyAffected = isTargetAffectedByAuraSource(latestSourceEffect, targetCharacter);
    const nextTargetIds = isCurrentlyAffected
      ? getAuraSelectedTargetIds(latestSourceEffect).filter((entryId) => entryId !== targetId)
      : [...getAuraSelectedTargetIds(latestSourceEffect), targetId];

    applyAuraTargets(latestSourceEffect, nextTargetIds);
  }

  function applyAuraToAllAllies(sourceEffect: ActivePowerEffect): void {
    const latestSourceEffect = getLatestSourceEffect(sourceEffect);
    if (!latestSourceEffect) {
      return;
    }

    const casterPartyId = encounterParticipants.find(
      ({ participant }) => participant.characterId === latestSourceEffect.casterCharacterId
    )?.participant.partyId;
    const alliedTargetIds = encounterParticipants
      .filter(
        (view) =>
          canEncounterTargetReceiveGroupBuff(view) &&
          view.character !== null &&
          view.participant.partyId !== null &&
          view.participant.partyId === casterPartyId
      )
      .map(({ participant }) => participant.characterId);
    const alliedNonSelfTargetIds = alliedTargetIds.filter(
      (targetId) => targetId !== latestSourceEffect.casterCharacterId
    );
    const everyAllyIsAffected = alliedNonSelfTargetIds.every((targetId) => {
      const targetCharacter =
        encounterParticipants.find(({ participant }) => participant.characterId === targetId)?.character ?? null;

      return targetCharacter ? isTargetAffectedByAuraSource(latestSourceEffect, targetCharacter) : false;
    });

    applyAuraTargets(
      latestSourceEffect,
      everyAllyIsAffected ? [latestSourceEffect.casterCharacterId] : alliedTargetIds
    );
  }

  return {
    openAuraEffectId,
    auraPopoverRef,
    toggleAuraPopover: (effectId) =>
      setOpenAuraEffectId((currentEffectId) => (currentEffectId === effectId ? null : effectId)),
    handleRemoveEffect,
    isAuraTargetSelected,
    toggleAuraTarget,
    applyAuraToAllAllies,
  };
}
