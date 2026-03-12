import { useEffect, useState } from "react";

import type { PowerEntry } from "../config/characterTemplate";
import {
  getCastPowerAllowedStats,
  getCastPowerModeOptionsForVariant,
  getCastPowerTargetLimit,
  getCastPowerTargetModeForVariant,
  getCastPowerVariantOptions,
  getHealingPowerTotal,
  getSupportedCastablePowers,
  type CastPowerMode,
  type CastPowerTargetMode,
  type CastPowerVariantId,
  type CastPowerVariantOption,
} from "../rules/powerEffects";
import { buildDefaultHealingAllocations } from "../lib/combatEncounterCasting";
import type {
  CastOutcomeState,
  CastRequestPayload,
  EncounterParticipantView,
} from "../types/combatEncounterView";
import type { StatId } from "../types/character";

type UseCombatantCastStateParams = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  requestCast: (payload: CastRequestPayload) => string | null;
};

export type CombatantCastState = {
  castablePowers: PowerEntry[];
  selectedPower: PowerEntry | null;
  variantOptions: CastPowerVariantOption[];
  resolvedVariantId: CastPowerVariantId;
  targetMode: CastPowerTargetMode;
  targetLimit: number;
  modeOptions: CastPowerMode[];
  allowedStats: StatId[];
  targetOptions: EncounterParticipantView[];
  selectedTargetIds: string[];
  resolvedTargetIds: string[];
  resolvedSingleTargetId: string;
  resolvedSelectedStatId: StatId | "";
  attackOutcome: CastOutcomeState;
  resolvedCastMode: CastPowerMode;
  castError: string | null;
  healingTotal: number | null;
  allocatedHealingTotal: number;
  healingAllocations: Record<string, string>;
  shouldShowVariantField: boolean;
  shouldShowTargetField: boolean;
  shouldShowModeField: boolean;
  shouldShowHealingAllocationEditor: boolean;
  requiresAttackOutcome: boolean;
  selectPower: (powerId: string) => void;
  selectVariant: (variantId: CastPowerVariantId) => void;
  toggleTarget: (targetId: string) => void;
  selectSingleTarget: (targetId: string) => void;
  selectCastMode: (mode: CastPowerMode) => void;
  selectAttackOutcome: (outcome: CastOutcomeState) => void;
  selectStat: (statId: string) => void;
  updateHealingAllocation: (targetId: string, value: string) => void;
  handleCast: () => void;
};

export function useCombatantCastState({
  view,
  encounterParticipants,
  requestCast,
}: UseCombatantCastStateParams): CombatantCastState {
  const [selectedPowerId, setSelectedPowerId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<CastPowerVariantId>("default");
  const [attackOutcome, setAttackOutcome] = useState<CastOutcomeState>("unresolved");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [healingAllocations, setHealingAllocations] = useState<Record<string, string>>({});
  const [selectedStatId, setSelectedStatId] = useState("");
  const [selectedCastMode, setSelectedCastMode] = useState<CastPowerMode>("self");
  const [castError, setCastError] = useState<string | null>(null);

  const character = view.character;
  const castablePowers = character ? getSupportedCastablePowers(character.sheet) : [];
  const selectedPower =
    castablePowers.find((power) => power.id === selectedPowerId) ?? castablePowers[0] ?? null;
  const variantOptions = selectedPower ? getCastPowerVariantOptions(selectedPower) : [];
  const resolvedVariantId =
    variantOptions.find((option) => option.id === selectedVariantId)?.id ??
    variantOptions[0]?.id ??
    "default";
  const targetMode = selectedPower
    ? getCastPowerTargetModeForVariant(selectedPower, resolvedVariantId)
    : "self";
  const targetLimit = selectedPower ? getCastPowerTargetLimit(selectedPower) : 1;
  const modeOptions = selectedPower
    ? getCastPowerModeOptionsForVariant(selectedPower, resolvedVariantId)
    : (["self"] satisfies CastPowerMode[]);
  const allowedStats = selectedPower ? getCastPowerAllowedStats(selectedPower) : [];
  const targetOptions =
    targetMode === "self"
      ? encounterParticipants.filter(
          ({ participant }) => participant.characterId === view.participant.characterId
        )
      : encounterParticipants.filter(
          ({ participant, character: candidateCharacter }) =>
            candidateCharacter !== null &&
            (selectedPower?.id !== "healing" ||
              view.participant.partyId === null ||
              participant.partyId === view.participant.partyId)
        );
  const singleTargetId = selectedTargetIds[0] ?? "";
  const resolvedSelectedStatId =
    allowedStats.includes(selectedStatId as StatId)
      ? (selectedStatId as StatId)
      : (allowedStats[0] ?? "");
  const resolvedTargetIds =
    selectedTargetIds.length > 0
      ? selectedTargetIds
      : targetOptions[0]
        ? [targetOptions[0].participant.characterId]
        : [];
  const resolvedSingleTargetId = resolvedTargetIds[0] ?? "";
  const healingTotal = selectedPower && character ? getHealingPowerTotal(character.sheet, selectedPower) : null;
  const resolvedHealingAllocations = Object.fromEntries(
    Object.entries(healingAllocations).map(([targetId, value]) => [
      targetId,
      Math.max(0, Math.trunc(Number.parseInt(value, 10) || 0)),
    ])
  );
  const allocatedHealingTotal = resolvedTargetIds.reduce(
    (sum, targetId) => sum + (resolvedHealingAllocations[targetId] ?? 0),
    0
  );
  const resolvedCastMode: CastPowerMode = modeOptions.includes(selectedCastMode)
    ? selectedCastMode
    : modeOptions[0];
  const allowedStatsKey = allowedStats.join("|");
  const targetOptionIdsKey = targetOptions.map(({ participant }) => participant.characterId).join("|");
  const resolvedTargetIdsKey = resolvedTargetIds.join("|");
  const shouldShowHealingAllocationEditor =
    selectedPower?.id === "healing" &&
    targetMode === "multiple" &&
    healingTotal !== null &&
    resolvedTargetIds.length > 0;
  const requiresAttackOutcome =
    selectedPower?.id === "necromancy" && resolvedVariantId === "necrotic_touch";

  useEffect(() => {
    if (castablePowers.length === 0) {
      setSelectedPowerId("");
      return;
    }

    if (!selectedPowerId || !castablePowers.some((power) => power.id === selectedPowerId)) {
      setSelectedPowerId(castablePowers[0].id);
    }
  }, [castablePowers, selectedPowerId]);

  useEffect(() => {
    if (variantOptions.length === 0) {
      if (selectedVariantId !== "default") {
        setSelectedVariantId("default");
      }
      return;
    }

    if (!variantOptions.some((option) => option.id === selectedVariantId)) {
      setSelectedVariantId(variantOptions[0].id);
    }
  }, [selectedVariantId, variantOptions]);

  useEffect(() => {
    setAttackOutcome("unresolved");
  }, [selectedPower?.id, resolvedVariantId, resolvedSingleTargetId]);

  useEffect(() => {
    if (!selectedPower) {
      setSelectedCastMode("self");
      return;
    }

    if (!modeOptions.includes(selectedCastMode)) {
      setSelectedCastMode(modeOptions[0]);
    }
  }, [modeOptions, selectedCastMode, selectedPower]);

  useEffect(() => {
    if (!selectedPower) {
      if (selectedTargetIds.length > 0) {
        setSelectedTargetIds([]);
      }

      if (Object.keys(healingAllocations).length > 0) {
        setHealingAllocations({});
      }

      if (selectedStatId !== "") {
        setSelectedStatId("");
      }

      return;
    }

    if (targetMode === "self") {
      if (selectedTargetIds.length !== 1 || selectedTargetIds[0] !== view.participant.characterId) {
        setSelectedTargetIds([view.participant.characterId]);
      }
    } else if (targetMode === "single") {
      if (
        !singleTargetId ||
        !targetOptions.some(({ participant }) => participant.characterId === singleTargetId)
      ) {
        const fallbackTargetId = targetOptions[0]?.participant.characterId ?? view.participant.characterId;

        if (selectedTargetIds.length !== 1 || selectedTargetIds[0] !== fallbackTargetId) {
          setSelectedTargetIds([fallbackTargetId]);
        }
      }
    } else {
      const validTargetIds = selectedTargetIds.filter((targetId) =>
        targetOptions.some(({ participant }) => participant.characterId === targetId)
      );

      if (validTargetIds.length === 0) {
        const fallbackTargetId = targetOptions[0]?.participant.characterId ?? view.participant.characterId;

        if (selectedTargetIds.length !== 1 || selectedTargetIds[0] !== fallbackTargetId) {
          setSelectedTargetIds([fallbackTargetId]);
        }
      } else {
        const cappedTargetIds = validTargetIds.slice(0, targetLimit);
        if (
          cappedTargetIds.length !== selectedTargetIds.length ||
          cappedTargetIds.some((targetId, index) => targetId !== selectedTargetIds[index])
        ) {
          setSelectedTargetIds(cappedTargetIds);
        }
      }
    }

    if (allowedStats.length === 0) {
      if (selectedStatId !== "") {
        setSelectedStatId("");
      }
    } else if (!allowedStats.includes(selectedStatId as (typeof allowedStats)[number])) {
      setSelectedStatId(allowedStats[0]);
    }
  }, [
    allowedStatsKey,
    selectedPower,
    selectedStatId,
    selectedTargetIds,
    singleTargetId,
    targetLimit,
    targetMode,
    targetOptionIdsKey,
    view.participant.characterId,
  ]);

  useEffect(() => {
    if (
      selectedPower?.id !== "healing" ||
      targetMode !== "multiple" ||
      healingTotal === null ||
      resolvedTargetIds.length === 0
    ) {
      if (Object.keys(healingAllocations).length > 0) {
        setHealingAllocations({});
      }
      return;
    }

    const nextAllocations = buildDefaultHealingAllocations(healingTotal, resolvedTargetIds);
    setHealingAllocations((current) => {
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(nextAllocations);

      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === nextAllocations[key])
      ) {
        return current;
      }

      return nextAllocations;
    });
  }, [healingTotal, resolvedTargetIdsKey, selectedPower?.id, selectedPower?.level, targetMode]);

  function toggleTarget(targetId: string): void {
    if (targetMode !== "multiple") {
      setSelectedTargetIds([targetId]);
      return;
    }

    setSelectedTargetIds((currentIds) =>
      currentIds.includes(targetId)
        ? currentIds.filter((currentId) => currentId !== targetId)
        : currentIds.length >= targetLimit
          ? currentIds
          : [...currentIds, targetId]
    );
  }

  function updateHealingAllocation(targetId: string, value: string): void {
    setHealingAllocations((current) => ({
      ...current,
      [targetId]: value,
    }));
  }

  function handleCast(): void {
    if (!selectedPower || !character) {
      setCastError("Select a supported power first.");
      return;
    }

    const error = requestCast({
      casterCharacter: character,
      casterDisplayName: view.participant.displayName,
      selectedPower,
      selectedVariantId: resolvedVariantId,
      attackOutcome,
      selectedTargetIds,
      fallbackTargetIds: resolvedTargetIds,
      healingAllocations: resolvedHealingAllocations,
      selectedStatId: resolvedSelectedStatId || null,
      castMode: resolvedCastMode,
      encounterParticipants,
    });

    setCastError(error);
  }

  return {
    castablePowers,
    selectedPower,
    variantOptions,
    resolvedVariantId,
    targetMode,
    targetLimit,
    modeOptions,
    allowedStats,
    targetOptions,
    selectedTargetIds,
    resolvedTargetIds,
    resolvedSingleTargetId,
    resolvedSelectedStatId,
    attackOutcome,
    resolvedCastMode,
    castError,
    healingTotal,
    allocatedHealingTotal,
    healingAllocations,
    shouldShowVariantField: variantOptions.length > 1,
    shouldShowTargetField: targetMode !== "self",
    shouldShowModeField: selectedPower?.id === "shadow_control" && modeOptions.length > 1,
    shouldShowHealingAllocationEditor,
    requiresAttackOutcome,
    selectPower: setSelectedPowerId,
    selectVariant: setSelectedVariantId,
    toggleTarget,
    selectSingleTarget: (targetId) => setSelectedTargetIds([targetId]),
    selectCastMode: setSelectedCastMode,
    selectAttackOutcome: setAttackOutcome,
    selectStat: setSelectedStatId,
    updateHealingAllocation,
    handleCast,
  };
}
