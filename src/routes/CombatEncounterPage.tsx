import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { D10Icon } from "../components/shared/D10Icon";
import { resolveDicePool } from "../config/combat";
import { buildCharacterEncounterSnapshot } from "../config/combatEncounter";
import { applyDamageToSheet, applyHealingToSheet } from "../config/combatResolution";
import { buildCharacterDerivedValues, getCurrentSkillValue } from "../config/characterRuntime";
import {
  applyActivePowerEffect,
  buildActivePowerEffect,
  buildDirectDamageCastResolution,
  buildAuraSharedPowerEffect,
  buildHealingCastResolution,
  canSelectAuraTargets,
  doesActivePowerEffectConflict,
  getCastPowerAllowedStats,
  getCastPowerModeOptionsForVariant,
  getCastPowerTargetLimit,
  getCastPowerTargetModeForVariant,
  getCastPowerVariantOptions,
  getHealingPowerTotal,
  isAuraSharedEffect,
  isAuraSourceEffect,
  getSupportedCastablePowers,
  removeActivePowerEffect,
  removeAuraSharedEffectsBySource,
  removeAuraSharedEffectsForTarget,
  spendPowerMana,
  updateAuraSourceTargets,
} from "../config/powerEffects";
import { getRuntimePowerAbbreviation, getRuntimePowerLevelDefinition } from "../config/powerData";
import type { GameHistoryEntry, PowerEntry } from "../config/characterTemplate";
import { getCrAndRankFromXpUsed } from "../config/xpTables";
import { useAppFlow } from "../state/appFlow";
import type { ActivePowerEffect, ActivePowerShareMode } from "../types/activePowerEffects";
import type {
  CastPowerMode,
  CastPowerVariantId,
  DamageMitigationChannel,
} from "../config/powerEffects";
import { CombatantRuntimeAdjustments } from "../components/combat-encounter/CombatantRuntimeAdjustments";
import type {
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../components/combat-encounter/types";
import { rollD10Faces } from "../lib/dice";
import { prependGameHistoryEntry } from "../lib/historyEntries";
import { createTimestampedId } from "../lib/ids";
import type { DamageTypeId } from "../config/resistances";
import type { CharacterRecord, StatId } from "../types/character";
import type {
  CharacterEncounterSnapshot,
  CombatEncounterParty,
  CombatEncounterParticipant,
} from "../types/combatEncounter";

const ROLLER_EXCLUDED_SUMMARY_IDS = new Set(["hp", "mana", "ac", "dr", "soak"]);

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

type RollTarget = {
  id: string;
  label: string;
  value: number;
  category: "summary" | "stat" | "skill";
};

type PreparedCastRequest = {
  casterCharacterId: string;
  targetCharacterIds: string[];
  manaCost: number;
  effects: ActivePowerEffect[];
  historyEntries: Array<{
    characterId: string;
    entry: GameHistoryEntry;
  }>;
  healingApplications: Array<{
    targetCharacterId: string;
    amount: number;
  }>;
  damageApplications: Array<{
    targetCharacterId: string;
    rawAmount: number;
    damageType: DamageTypeId;
    mitigationChannel: DamageMitigationChannel;
    sourceLabel: string;
    sourceSummary: string;
  }>;
};

type CastOutcomeState = "unresolved" | "hit" | "miss";

type PendingCastConfirmation = {
  request: PreparedCastRequest;
  warnings: string[];
};

type CastRequestPayload = {
  casterCharacter: CharacterRecord;
  casterDisplayName: string;
  selectedPower: PowerEntry;
  selectedVariantId: CastPowerVariantId;
  attackOutcome: "unresolved" | "hit" | "miss";
  selectedTargetIds: string[];
  fallbackTargetIds: string[];
  healingAllocations: Record<string, number>;
  selectedStatId: StatId | null;
  castMode: CastPowerMode;
  encounterParticipants: EncounterParticipantView[];
};

type EncounterPartyMemberView = {
  participant: CombatEncounterParticipant;
  character: CharacterRecord;
  currentHp: number;
  maxHp: number;
};

function formatEncounterTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }

  return date.toLocaleString();
}

type CombatantPowerControlsProps = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  requestCast: (payload: CastRequestPayload) => string | null;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

function getReplacementWarnings(
  finalTargets: CharacterRecord[],
  builtEffects: ActivePowerEffect[]
): string[] {
  return finalTargets.flatMap((targetCharacter, index) => {
    const builtEffect = builtEffects[index];

    const existingEffect = (targetCharacter.sheet.activePowerEffects ?? []).find(
      (effect) => doesActivePowerEffectConflict(effect, builtEffect)
    );

    if (!existingEffect) {
      return [];
    }

    const targetName = targetCharacter.sheet.name.trim() || targetCharacter.id;
    const statText = builtEffect.selectedStatId ? ` on ${builtEffect.selectedStatId}` : "";

    return [
      `${targetName} already has ${existingEffect.label}${statText}. Recasting will replace it and still spend mana.`,
    ];
  });
}

function prepareCastRequest(
  payload: CastRequestPayload
): { error: string } | { request: PreparedCastRequest; warnings: string[] } {
  const resolvedTargets = payload.selectedTargetIds
    .map((targetId) =>
      payload.encounterParticipants.find(({ participant }) => participant.characterId === targetId)
        ?.character ?? null
    )
    .filter((targetCharacter): targetCharacter is CharacterRecord => targetCharacter !== null);
  const fallbackTargets = payload.fallbackTargetIds
    .map((targetId) =>
      payload.encounterParticipants.find(({ participant }) => participant.characterId === targetId)
        ?.character ?? null
    )
    .filter((targetCharacter): targetCharacter is CharacterRecord => targetCharacter !== null);
  const finalTargets = resolvedTargets.length > 0 ? resolvedTargets : fallbackTargets;

  if (finalTargets.length === 0) {
    return { error: "Select at least one valid target before casting." };
  }

  if (
    payload.selectedPower.id === "awareness" &&
    payload.selectedVariantId === "assess_character"
  ) {
    const targetCharacter = finalTargets[0];
    if (!targetCharacter) {
      return { error: "Select one target for Assess Character." };
    }

    const awarenessLevel = payload.selectedPower.level;
    const casterPerception =
      buildCharacterDerivedValues(payload.casterCharacter.sheet).currentStats.PER;
    const crCaps = [0, 6, 9, 12, 15, 18];
    const allowedCr = Math.min(casterPerception + awarenessLevel, crCaps[awarenessLevel] ?? 18);
    const targetCr = getCrAndRankFromXpUsed(targetCharacter.sheet.xpUsed).cr;

    if (targetCr > allowedCr) {
      return {
        error: `Assess Character limit is CR ${allowedCr}, but ${targetCharacter.sheet.name.trim() || targetCharacter.id} is CR ${targetCr}.`,
      };
    }

    const now = new Date();

    return {
      request: {
        casterCharacterId: payload.casterCharacter.id,
        targetCharacterIds: [targetCharacter.id],
        manaCost: 0,
        effects: [],
        historyEntries: [
          {
            characterId: payload.casterCharacter.id,
            entry: buildAssessCharacterHistoryEntry(
              payload.casterCharacter.sheet,
              targetCharacter,
              `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`
            ),
          },
        ],
        healingApplications: [],
        damageApplications: [],
      },
      warnings: [],
    };
  }

  if (payload.selectedPower.id === "healing") {
    const healingResolution = buildHealingCastResolution({
      casterSheet: payload.casterCharacter.sheet,
      power: payload.selectedPower,
      targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
      allocations: payload.healingAllocations,
    });
    if ("error" in healingResolution) {
      return { error: healingResolution.error };
    }

    return {
      request: {
        casterCharacterId: payload.casterCharacter.id,
        targetCharacterIds: healingResolution.applications.map(
          (application) => application.targetCharacterId
        ),
        manaCost: healingResolution.manaCost,
        effects: [],
        historyEntries: [],
        healingApplications: healingResolution.applications,
        damageApplications: [],
      },
      warnings: [],
    };
  }

  if (
    payload.selectedPower.id === "shadow_control" &&
    payload.selectedVariantId === "shadow_manipulation"
  ) {
    const damageResolution = buildDirectDamageCastResolution({
      casterSheet: payload.casterCharacter.sheet,
      power: payload.selectedPower,
      variantId: payload.selectedVariantId,
      targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
    });
    if ("error" in damageResolution) {
      return { error: damageResolution.error };
    }

    return {
      request: {
        casterCharacterId: payload.casterCharacter.id,
        targetCharacterIds: damageResolution.applications.map(
          (application) => application.targetCharacterId
        ),
        manaCost: damageResolution.manaCost,
        effects: [],
        historyEntries: [],
        healingApplications: [],
        damageApplications: damageResolution.applications,
      },
      warnings: [],
    };
  }

  if (
    payload.selectedPower.id === "necromancy" &&
    payload.selectedVariantId === "necrotic_touch"
  ) {
    if (payload.attackOutcome === "unresolved") {
      return { error: "Resolve the touch attack outcome first." };
    }

    if (payload.attackOutcome === "miss") {
      const runtimeLevel = getRuntimePowerLevelDefinition(
        payload.selectedPower.id,
        payload.selectedPower.level
      );
      const necroticTouch =
        runtimeLevel?.mechanics?.necrotic_touch &&
        typeof runtimeLevel.mechanics.necrotic_touch === "object"
          ? (runtimeLevel.mechanics.necrotic_touch as Record<string, unknown>)
          : null;

      return {
        request: {
          casterCharacterId: payload.casterCharacter.id,
          targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
          manaCost:
            typeof necroticTouch?.mana_cost === "number"
              ? necroticTouch.mana_cost
              : (runtimeLevel?.mana_cost ?? 0),
          effects: [],
          historyEntries: [],
          healingApplications: [],
          damageApplications: [],
        },
        warnings: [],
      };
    }

    const damageResolution = buildDirectDamageCastResolution({
      casterSheet: payload.casterCharacter.sheet,
      power: payload.selectedPower,
      variantId: payload.selectedVariantId,
      targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
    });
    if ("error" in damageResolution) {
      return { error: damageResolution.error };
    }

    return {
      request: {
        casterCharacterId: payload.casterCharacter.id,
        targetCharacterIds: damageResolution.applications.map(
          (application) => application.targetCharacterId
        ),
        manaCost: damageResolution.manaCost,
        effects: [],
        historyEntries: [],
        healingApplications: [
          {
            targetCharacterId: payload.casterCharacter.id,
            amount: payload.selectedPower.level,
          },
        ],
        damageApplications: damageResolution.applications,
      },
      warnings: [],
    };
  }

  const builtEffects = finalTargets.map((targetCharacter) =>
    buildActivePowerEffect({
      casterCharacterId: payload.casterCharacter.id,
      casterName: payload.casterCharacter.sheet.name.trim() || payload.casterDisplayName,
      targetCharacterId: targetCharacter.id,
      targetName: targetCharacter.sheet.name.trim() || targetCharacter.id,
      power: payload.selectedPower,
      variantId: payload.selectedVariantId,
      selectedStatId: payload.selectedStatId,
      castMode: payload.castMode,
    })
  );
  const buildError = builtEffects.find((effect) => "error" in effect);
  if (buildError && "error" in buildError) {
    return { error: buildError.error };
  }

  const effects = builtEffects.map((effect) => {
    if ("error" in effect) {
      throw new Error("Cast effect unexpectedly failed after validation.");
    }

    return effect.effect;
  });

  return {
    request: {
      casterCharacterId: payload.casterCharacter.id,
      targetCharacterIds: finalTargets.map((targetCharacter) => targetCharacter.id),
      manaCost: builtEffects[0] && !("error" in builtEffects[0]) ? builtEffects[0].manaCost : 0,
      effects,
      historyEntries: [],
      healingApplications: [],
      damageApplications: [],
    },
    warnings: getReplacementWarnings(finalTargets, effects),
  };
}

function CombatantPowerControls({
  view,
  encounterParticipants,
  requestCast,
  updateCharacter,
}: CombatantPowerControlsProps) {
  const [selectedPowerId, setSelectedPowerId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<CastPowerVariantId>("default");
  const [attackOutcome, setAttackOutcome] = useState<CastOutcomeState>("unresolved");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [healingAllocations, setHealingAllocations] = useState<Record<string, string>>({});
  const [selectedStatId, setSelectedStatId] = useState("");
  const [selectedCastMode, setSelectedCastMode] = useState<CastPowerMode>("self");
  const [castError, setCastError] = useState<string | null>(null);
  const [openAuraEffectId, setOpenAuraEffectId] = useState<string | null>(null);
  const character = view.character;
  const auraPopoverRef = useRef<HTMLDivElement | null>(null);
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
    allowedStats.includes(selectedStatId as StatId) ? (selectedStatId as StatId) : allowedStats[0] ?? "";
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
  const requiresAttackOutcome = selectedPower?.id === "necromancy" && resolvedVariantId === "necrotic_touch";

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
      if (
        selectedTargetIds.length !== 1 ||
        selectedTargetIds[0] !== view.participant.characterId
      ) {
        setSelectedTargetIds([view.participant.characterId]);
      }
    } else if (targetMode === "single") {
      if (
        !singleTargetId ||
        !targetOptions.some(({ participant }) => participant.characterId === singleTargetId)
      ) {
        const fallbackTargetId =
          targetOptions[0]?.participant.characterId ?? view.participant.characterId;

        if (
          selectedTargetIds.length !== 1 ||
          selectedTargetIds[0] !== fallbackTargetId
        ) {
          setSelectedTargetIds([fallbackTargetId]);
        }
      }
    } else {
      const validTargetIds = selectedTargetIds.filter((targetId) =>
        targetOptions.some(({ participant }) => participant.characterId === targetId)
      );

      if (validTargetIds.length === 0) {
        const fallbackTargetId =
          targetOptions[0]?.participant.characterId ?? view.participant.characterId;

        if (
          selectedTargetIds.length !== 1 ||
          selectedTargetIds[0] !== fallbackTargetId
        ) {
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
    } else if (!allowedStats.includes(selectedStatId as typeof allowedStats[number])) {
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
  }, [
    healingTotal,
    resolvedTargetIdsKey,
    selectedPower?.id,
    selectedPower?.level,
    targetMode,
  ]);

  if (!character) {
    return null;
  }
  const casterCharacter = character;
  const shouldShowVariantField = variantOptions.length > 1;
  const shouldShowTargetField = targetMode !== "self";
  const shouldShowModeField = selectedPower?.id === "shadow_control" && modeOptions.length > 1;

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
    if (!selectedPower) {
      setCastError("Select a supported power first.");
      return;
    }

    const error = requestCast({
      casterCharacter,
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

  function handleRemoveEffect(effect: ActivePowerEffect): void {
    if (isAuraSourceEffect(effect)) {
      getAuraSelectedTargetIds(effect)
        .filter((targetId) => targetId !== effect.casterCharacterId)
        .forEach((targetId) => {
          updateCharacter(targetId, (currentSheet) =>
            removeAuraSharedEffectsForTarget(currentSheet, effect, targetId)
          );
        });
      setOpenAuraEffectId((currentEffectId) => (currentEffectId === effect.id ? null : currentEffectId));
      updateCharacter(casterCharacter.id, (currentSheet) =>
        removeActivePowerEffect(currentSheet, effect.id)
      );
      return;
    }

    if (isAuraSharedEffect(effect) && effect.sourceEffectId) {
      updateCharacter(effect.casterCharacterId, (currentSheet) => {
        const sourceEffect = (currentSheet.activePowerEffects ?? []).find(
          (candidate) => candidate.id === effect.sourceEffectId
        );
        if (!sourceEffect) {
          return currentSheet;
        }

        const sourceEffectId = effect.sourceEffectId;
        if (!sourceEffectId) {
          return currentSheet;
        }

        return updateAuraSourceTargets(
          currentSheet,
          sourceEffectId,
          getAuraSelectedTargetIds(sourceEffect).filter((targetId) => targetId !== casterCharacter.id)
        );
      });
    }

    updateCharacter(casterCharacter.id, (currentSheet) =>
      removeActivePowerEffect(currentSheet, effect.id)
    );
  }

  function toggleAuraTarget(sourceEffect: ActivePowerEffect, targetId: string): void {
    const latestSourceEffect =
      (casterCharacter.sheet.activePowerEffects ?? []).find((effect) => effect.id === sourceEffect.id) ??
      sourceEffect;
    const targetCharacter =
      encounterParticipants.find(({ participant }) => participant.characterId === targetId)?.character ?? null;

    if (!targetCharacter) {
      return;
    }

    const isCurrentlyAffected = isTargetAffectedByAuraSource(latestSourceEffect, targetCharacter);
    const nextTargetIds = isCurrentlyAffected
      ? getAuraSelectedTargetIds(latestSourceEffect).filter((entryId) => entryId !== targetId)
      : [...getAuraSelectedTargetIds(latestSourceEffect), targetId];

    applyAuraTargets(latestSourceEffect, nextTargetIds);
  }

  function applyAuraTargets(sourceEffect: ActivePowerEffect, rawTargetIds: string[]): void {
    const latestSourceEffect =
      (casterCharacter.sheet.activePowerEffects ?? []).find((effect) => effect.id === sourceEffect.id) ??
      sourceEffect;
    const nextTargetIds = Array.from(
      new Set(
        [latestSourceEffect.casterCharacterId, ...rawTargetIds].filter(
          (targetId) =>
            targetId === latestSourceEffect.casterCharacterId ||
            encounterParticipants.some(
              ({ character: candidateCharacter, participant }) =>
                participant.characterId === targetId && candidateCharacter !== null
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
      (targetId) =>
        targetId !== latestSourceEffect.casterCharacterId && !nextTargetIds.includes(targetId)
    );
    const targetIdsToAdd = nextTargetIds.filter(
      (targetId) =>
        targetId !== latestSourceEffect.casterCharacterId && !currentTargetIds.includes(targetId)
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

      const nextSharedEffect = buildAuraSharedPowerEffect(latestSourceEffect, targetId);
      const conflictingAura = (targetCharacter.sheet.activePowerEffects ?? []).find(
        (candidate) =>
          isAuraSharedEffect(candidate) &&
          candidate.sourceEffectId !== latestSourceEffect.id &&
          doesActivePowerEffectConflict(candidate, nextSharedEffect)
      );

      if (conflictingAura?.sourceEffectId) {
        updateCharacter(conflictingAura.casterCharacterId, (currentSheet) => {
          const existingSourceEffect = (currentSheet.activePowerEffects ?? []).find(
            (candidate) => candidate.id === conflictingAura.sourceEffectId
          );
          if (!existingSourceEffect) {
            return currentSheet;
          }

          const conflictingSourceEffectId = conflictingAura.sourceEffectId;
          if (!conflictingSourceEffectId) {
            return currentSheet;
          }

          return updateAuraSourceTargets(
            currentSheet,
            conflictingSourceEffectId,
            getAuraSelectedTargetIds(existingSourceEffect).filter((entryId) => entryId !== targetId)
          );
        });
      }

      updateCharacter(targetId, (currentSheet) =>
        applyActivePowerEffect(currentSheet, nextSharedEffect)
      );
    });
  }

  function applyAuraToAllAllies(sourceEffect: ActivePowerEffect): void {
    const casterPartyId = encounterParticipants.find(
      ({ participant }) => participant.characterId === sourceEffect.casterCharacterId
    )?.participant.partyId;
    const alliedTargetIds = encounterParticipants
      .filter(
        ({ participant, character: targetCharacter }) =>
          targetCharacter !== null &&
          participant.partyId !== null &&
          participant.partyId === casterPartyId
      )
      .map(({ participant }) => participant.characterId);
    const latestSourceEffect =
      (casterCharacter.sheet.activePowerEffects ?? []).find((effect) => effect.id === sourceEffect.id) ??
      sourceEffect;
    const alliedNonSelfTargetIds = alliedTargetIds.filter(
      (targetId) => targetId !== latestSourceEffect.casterCharacterId
    );
    const everyAllyIsAffected = alliedNonSelfTargetIds.every((targetId) => {
      const targetCharacter =
        encounterParticipants.find(({ participant }) => participant.characterId === targetId)?.character ??
        null;

      return targetCharacter
        ? isTargetAffectedByAuraSource(latestSourceEffect, targetCharacter)
        : false;
    });

    applyAuraTargets(
      latestSourceEffect,
      everyAllyIsAffected ? [latestSourceEffect.casterCharacterId] : alliedTargetIds
    );
  }

  return (
    <>
      <div className="dm-combatant-tool-section">
        <p className="section-kicker">Cast Power Mechanism</p>
        <h3 className="dm-subheading">Active Power Effects</h3>
        {castablePowers.length === 0 ? (
          <p className="dm-summary-line">
            This combatant has no supported castable powers in the first slice.
          </p>
        ) : (
          <>
            <div className="dm-power-form">
              <label className="dm-field">
                <span>Power</span>
                <select
                  value={selectedPower?.id ?? ""}
                  onChange={(event) => setSelectedPowerId(event.target.value)}
                >
                  {castablePowers.map((power) => (
                    <option key={power.id} value={power.id}>
                      {getRuntimePowerAbbreviation(power.id) ?? power.name} Lv {power.level}
                    </option>
                  ))}
                </select>
              </label>

              {shouldShowVariantField ? (
                <label className="dm-field">
                  <span>Action</span>
                  <select
                    value={resolvedVariantId}
                    onChange={(event) =>
                      setSelectedVariantId(event.target.value as CastPowerVariantId)
                    }
                  >
                    {variantOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {shouldShowTargetField ? (
                <label className="dm-field">
                  <span>{targetMode === "multiple" ? "Targets" : "Target"}</span>
                  {targetMode === "multiple" ? (
                    <>
                      <div className="dm-target-multi-grid">
                        {targetOptions.map(({ participant }) => {
                          const isSelected = selectedTargetIds.includes(participant.characterId);

                          return (
                            <button
                              key={participant.characterId}
                              type="button"
                              className={`dm-target-chip${isSelected ? " is-selected" : ""}`}
                              onClick={() => toggleTarget(participant.characterId)}
                            >
                              {participant.displayName}
                            </button>
                          );
                        })}
                      </div>
                      <small className="dm-field-hint">
                        Up to {targetLimit} target{targetLimit === 1 ? "" : "s"}.
                      </small>
                    </>
                  ) : (
                    <select
                      value={resolvedSingleTargetId}
                      onChange={(event) => setSelectedTargetIds([event.target.value])}
                    >
                      {targetOptions.map(({ participant }) => (
                        <option key={participant.characterId} value={participant.characterId}>
                          {participant.displayName}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              ) : null}

              {shouldShowModeField ? (
                <label className="dm-field">
                  <span>Mode</span>
                  <select
                    value={resolvedCastMode ?? "self"}
                    onChange={(event) =>
                      setSelectedCastMode(event.target.value === "aura" ? "aura" : "self")
                    }
                  >
                    <option value="self">Self</option>
                    <option value="aura">Aura</option>
                  </select>
                </label>
              ) : null}

              {requiresAttackOutcome ? (
                <label className="dm-field">
                  <span>Touch Attack</span>
                  <select
                    value={attackOutcome}
                    onChange={(event) =>
                      setAttackOutcome(event.target.value as CastOutcomeState)
                    }
                  >
                    <option value="unresolved">Resolve First</option>
                    <option value="hit">Hit</option>
                    <option value="miss">Miss</option>
                  </select>
                </label>
              ) : null}

              {allowedStats.length > 0 ? (
                <label className="dm-field">
                  <span>Stat</span>
                  <select
                    value={resolvedSelectedStatId}
                    onChange={(event) => setSelectedStatId(event.target.value)}
                  >
                    {allowedStats.map((statId) => (
                      <option key={statId} value={statId}>
                        {statId}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            {selectedPower?.id === "healing" && healingTotal !== null ? (
              <div className="dm-healing-panel">
                <div className="dm-summary-box">
                  <strong>Heal Pool</strong>
                  <span>{healingTotal}</span>
                </div>
                <div className="dm-summary-box">
                  <strong>Target Limit</strong>
                  <span>{targetLimit}</span>
                </div>
                {shouldShowHealingAllocationEditor ? (
                  <div className="dm-summary-box">
                    <strong>Allocated</strong>
                    <span>
                      {allocatedHealingTotal} / {healingTotal}
                    </span>
                  </div>
                ) : null}

                {shouldShowHealingAllocationEditor ? (
                  <div className="dm-healing-allocation-grid">
                    {resolvedTargetIds.map((targetId) => {
                      const targetLabel =
                        targetOptions.find(({ participant }) => participant.characterId === targetId)
                          ?.participant.displayName ?? targetId;

                      return (
                        <label key={targetId} className="dm-field">
                          <span>{targetLabel}</span>
                          <input
                            type="number"
                            min="0"
                            max={healingTotal}
                            value={healingAllocations[targetId] ?? "0"}
                            onChange={(event) =>
                              updateHealingAllocation(targetId, event.target.value)
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="dm-control-row">
              <button type="button" className="flow-primary" onClick={handleCast}>
                Cast Selected Power
              </button>
            </div>

            {castError ? <p className="dm-error">{castError}</p> : null}
          </>
        )}
      </div>

      <div className="dm-combatant-tool-section">
        <p className="section-kicker">Applied Effects</p>
        {character.sheet.activePowerEffects.length === 0 ? (
          <p className="dm-summary-line">No active power effects on this combatant.</p>
        ) : (
          <div className="dm-effect-list">
            {character.sheet.activePowerEffects.map((effect) => (
              <article key={effect.id} className="dm-effect-card">
                <div>
                  <strong>{effect.label}</strong>
                  <small>{effect.summary}</small>
                  <small>
                    {effect.casterName} {"->"} {effect.powerName}
                  </small>
                </div>
                <div
                  className="dm-effect-actions"
                  ref={openAuraEffectId === effect.id ? auraPopoverRef : null}
                >
                  {isAuraSourceEffect(effect) ? (
                    <>
                      <button
                        type="button"
                        className="flow-secondary"
                        disabled={!canSelectAuraTargets(effect)}
                        onClick={() =>
                          canSelectAuraTargets(effect)
                            ? setOpenAuraEffectId((currentEffectId) =>
                                currentEffectId === effect.id ? null : effect.id
                              )
                            : null
                        }
                      >
                        Affected Targets
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="flow-secondary"
                    onClick={() => handleRemoveEffect(effect)}
                  >
                    Remove
                  </button>
                  {openAuraEffectId === effect.id && canSelectAuraTargets(effect) ? (
                    <div className="dm-aura-popover">
                      <div className="dm-aura-popover-head">
                        <p className="section-kicker">Affected Targets</p>
                        <button
                          type="button"
                          className="flow-secondary"
                          onClick={() => applyAuraToAllAllies(effect)}
                        >
                          All Allies
                        </button>
                      </div>
                      <div className="dm-target-multi-grid">
                        {encounterParticipants
                          .filter(({ character: candidateCharacter }) => candidateCharacter !== null)
                          .map(({ participant }) => {
                            const isSelf = participant.characterId === effect.casterCharacterId;
                            const targetCharacter =
                              encounterParticipants.find(
                                ({ character: candidateCharacter, participant: candidateParticipant }) =>
                                  candidateParticipant.characterId === participant.characterId &&
                                  candidateCharacter !== null
                              )?.character ?? null;
                            const isSelected =
                              isSelf ||
                              (targetCharacter
                                ? isTargetAffectedByAuraSource(effect, targetCharacter)
                                : false);

                            return (
                              <button
                                key={participant.characterId}
                                type="button"
                              className={`dm-target-chip${isSelected ? " is-selected" : ""}`}
                              aria-pressed={isSelf ? undefined : isSelected}
                              disabled={isSelf}
                              onClick={() => toggleAuraTarget(effect, participant.characterId)}
                            >
                              {isSelf ? "Self" : participant.displayName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function CombatEncounterPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    activeCombatEncounter,
    characters,
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
  const dragRef = useRef<{ active: boolean; moved: boolean; offsetX: number; offsetY: number }>({
    active: false,
    moved: false,
    offsetX: 0,
    offsetY: 0,
  });

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

  function openCharacterSheet(characterId: string, ownerRole: "player" | "dm"): void {
    const routePath = ownerRole === "dm" ? "/dm/npc-character" : "/dm/character";
    const popupUrl = `${routePath}?characterId=${encodeURIComponent(characterId)}`;

    window.open(
      popupUrl,
      "_blank",
      "popup=yes,width=1380,height=920,noopener,noreferrer"
    );
  }

  function moveEncounterParticipantToParty(
    characterId: string,
    partyId: string | null
  ): void {
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

  function executePreparedCast(request: PreparedCastRequest): string | null {
    const casterCharacter = characters.find((entry) => entry.id === request.casterCharacterId);
    if (!casterCharacter) {
      return "The casting character no longer resolves to a saved character sheet.";
    }

    const spentMana = spendPowerMana(casterCharacter.sheet, request.manaCost);
    if ("error" in spentMana) {
      return spentMana.error;
    }

    if (request.historyEntries.length > 0) {
      const historyEntriesByCharacterId = new Map(
        request.historyEntries.map((item) => [item.characterId, item.entry] as const)
      );

      updateCharacter(casterCharacter.id, (currentSheet) => {
        const nextHistoryEntry = historyEntriesByCharacterId.get(casterCharacter.id);
        if (!nextHistoryEntry) {
          return spentMana.sheet;
        }

        return {
          ...spentMana.sheet,
          gameHistory: prependGameHistoryEntry(spentMana.sheet.gameHistory ?? [], nextHistoryEntry),
        };
      });

      request.historyEntries
        .filter((item) => item.characterId !== casterCharacter.id)
        .forEach((item) => {
          updateCharacter(item.characterId, (currentSheet) => ({
            ...currentSheet,
            gameHistory: prependGameHistoryEntry(currentSheet.gameHistory ?? [], item.entry),
          }));
        });

      if (request.healingApplications.length === 0 && request.damageApplications.length === 0 && request.effects.length === 0) {
        return null;
      }
    }

    if (request.healingApplications.length > 0 || request.damageApplications.length > 0) {
      let nextCasterSheet = spentMana.sheet;

      request.healingApplications
        .filter((application) => application.targetCharacterId === casterCharacter.id)
        .forEach((application) => {
          nextCasterSheet = applyHealingToSheet(nextCasterSheet, application.amount).sheet;
        });

      request.damageApplications
        .filter((application) => application.targetCharacterId === casterCharacter.id)
        .forEach((application) => {
          nextCasterSheet = applyDamageToSheet(nextCasterSheet, {
            rawAmount: application.rawAmount,
            damageType: application.damageType,
            mitigationChannel: application.mitigationChannel,
          }).sheet;
        });

      updateCharacter(casterCharacter.id, nextCasterSheet);

      request.healingApplications
        .filter((application) => application.targetCharacterId !== casterCharacter.id)
        .forEach((application) => {
          updateCharacter(application.targetCharacterId, (currentSheet) =>
            applyHealingToSheet(currentSheet, application.amount).sheet
          );
        });

      request.damageApplications
        .filter((application) => application.targetCharacterId !== casterCharacter.id)
        .forEach((application) => {
          updateCharacter(application.targetCharacterId, (currentSheet) =>
            applyDamageToSheet(currentSheet, {
              rawAmount: application.rawAmount,
              damageType: application.damageType,
              mitigationChannel: application.mitigationChannel,
            }).sheet
          );
        });

      return null;
    }

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
                  updateCharacter(targetId, (currentSheet) =>
                    removeAuraSharedEffectsForTarget(currentSheet, existingEffect, targetId)
                  );
                });
            });
    });

    const isSelfCast =
      request.targetCharacterIds.length === 1 && request.targetCharacterIds[0] === casterCharacter.id;

    if (isSelfCast) {
      const selfEffect = request.effects[0];
      if (!selfEffect) {
        return "Cast effect could not be resolved.";
      }

      updateCharacter(casterCharacter.id, applyActivePowerEffect(spentMana.sheet, selfEffect));
      return null;
    }

    updateCharacter(casterCharacter.id, spentMana.sheet);
    request.effects.forEach((effect) => {
      updateCharacter(effect.targetCharacterId, (currentSheet) =>
        applyActivePowerEffect(currentSheet, effect)
      );
    });
    return null;
  }

  function requestCast(payload: CastRequestPayload): string | null {
    const prepared = prepareCastRequest(payload);
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

  const encounterParticipants = activeCombatEncounter
    ? activeCombatEncounter.participants.map((participant) => {
        const character = characters.find((entry) => entry.id === participant.characterId) ?? null;
        const snapshot = character ? buildCharacterEncounterSnapshot(character.sheet) : null;

        return {
          participant,
          character,
          snapshot,
        };
      })
    : [];
  const encounterParties = activeCombatEncounter?.parties ?? [];
  const unassignedEncounterMembers = getEncounterPartyMembers(encounterParticipants, null);

  const selectedCombatant =
    encounterParticipants.find(({ participant }) => participant.characterId === selectedCombatantId) ??
    encounterParticipants[0] ??
    null;
  const selectedSnapshot = selectedCombatant?.snapshot ?? null;
  const rollTargets: RollTarget[] = selectedSnapshot
    ? [
        ...selectedSnapshot.combatSummary
          .filter(
            (field) =>
              !ROLLER_EXCLUDED_SUMMARY_IDS.has(field.id) && field.selectableValue !== null
          )
          .map((field) => ({
            id: `summary:${field.id}`,
            label: field.label,
            value: field.selectableValue ?? 0,
            category: "summary" as const,
          })),
        ...selectedSnapshot.stats.map((field) => ({
          id: `stat:${field.id}`,
          label: field.label,
          value: Number(field.value),
          category: "stat" as const,
        })),
        ...selectedSnapshot.highlightedSkills.map((field) => ({
          id: `skill:${field.id}`,
          label: field.label,
          value: Number(field.value),
          category: "skill" as const,
        })),
      ]
    : [];
  const summaryRollTargets = rollTargets.filter((target) => target.category === "summary");
  const statRollTargets = rollTargets.filter((target) => target.category === "stat");
  const skillRollTargets = rollTargets.filter((target) => target.category === "skill");
  const selectedRollTargets = selectedRollIds
    .map((targetId) => rollTargets.find((target) => target.id === targetId))
    .filter((target): target is RollTarget => target !== undefined);
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

  function handleDiceMouseDown(event: React.MouseEvent<HTMLButtonElement>): void {
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

  return (
    <main className="dm-page">
      <button
        type="button"
        className="floating-dice"
        style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y}px` }}
        onMouseDown={handleDiceMouseDown}
        onClick={handleDiceClick}
        aria-label="Open dice roller"
      >
        <D10Icon />
        <span className="sr-only">Open dice roller</span>
      </button>

      {isDiceOpen ? (
        <aside
          className="dice-popover"
          style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y + 72}px` }}
        >
          <div className="dice-popover-head">
            <D10Icon />
            <p className="section-kicker">10 Roll Helper</p>
          </div>
          <h2>Dice Roller</h2>

          <label className="dm-field dice-popover-field">
            <span>Combatant</span>
            <select
              value={selectedCombatant?.participant.characterId ?? ""}
              onChange={(event) => setSelectedCombatantId(event.target.value)}
            >
              {encounterParticipants.map(({ participant }, index) => (
                <option key={participant.characterId} value={participant.characterId}>
                  {index + 1}. {participant.displayName}
                </option>
              ))}
            </select>
          </label>

          {selectedCombatant && selectedSnapshot ? (
            <>
              <div className="dice-summary">
                <span>Initiative</span>
                <strong>
                  Pool {selectedCombatant.participant.initiativePool} | Roll{" "}
                  {selectedCombatant.participant.initiativeFaces.join(", ")} | Successes{" "}
                  {selectedCombatant.participant.initiativeSuccesses}
                </strong>
              </div>

              <div className="dm-summary-mini-grid dice-summary-grid">
                {selectedSnapshot.combatSummary
                  .filter((field) => !ROLLER_EXCLUDED_SUMMARY_IDS.has(field.id))
                  .map((field) => (
                    <div key={field.id}>
                      <span>{field.label}</span>
                      <strong>{field.value}</strong>
                    </div>
                  ))}
                <div>
                  <span>Inspiration</span>
                  <strong>{selectedSnapshot.inspiration}</strong>
                  <small>{selectedSnapshot.inspirationDetail}</small>
                </div>
              </div>

              <div className="dice-summary">
                <span>Selected</span>
                <strong>
                  {selectedRollTargets.length > 0 || customRollModifiers.length > 0
                    ? [
                        ...selectedRollTargets.map((target) => target.label),
                        ...customRollModifiers.map(
                          (modifier) =>
                            `Custom ${modifier.value >= 0 ? "+" : ""}${modifier.value}`
                        ),
                      ].join(" + ")
                    : "None"}
                </strong>
              </div>
              <div className="dice-summary">
                <span>Pool</span>
                <strong>{selectedRollPool}</strong>
              </div>

              <section className="dice-summary-section">
                <h3>Combat Summary</h3>
                <div className="dice-summary-targets">
                  {summaryRollTargets.map((target) => {
                    const isSelected = selectedRollIds.includes(target.id);
                    const wouldExceedLimit = !isSelected && selectedRollIds.length >= 9;

                    return (
                      <button
                        key={target.id}
                        type="button"
                        className={`dice-target${isSelected ? " is-selected" : ""}`}
                        onClick={() => toggleRollTarget(target.id)}
                        disabled={wouldExceedLimit}
                      >
                        <span>{target.label}</span>
                        <strong>{target.value}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="dice-columns">
                <section className="dice-column">
                  <h3>Stats</h3>
                  <div className="dice-targets">
                    {statRollTargets.map((target) => {
                      const isSelected = selectedRollIds.includes(target.id);
                      const wouldExceedLimit = !isSelected && selectedRollIds.length >= 9;

                      return (
                        <button
                          key={target.id}
                          type="button"
                          className={`dice-target${isSelected ? " is-selected" : ""}`}
                          onClick={() => toggleRollTarget(target.id)}
                          disabled={wouldExceedLimit}
                        >
                          <span>{target.label}</span>
                          <strong>{target.value}</strong>
                        </button>
                      );
                    })}
                  </div>

                  <div className="dice-custom-add">
                    <span>Add</span>
                    <div className="dice-custom-row">
                      <input
                        type="number"
                        value={customRollInput}
                        onChange={(event) => setCustomRollInput(event.target.value)}
                        placeholder="+/-"
                      />
                      <button type="button" onClick={handleAddCustomRollModifier}>
                        Add
                      </button>
                    </div>
                    {customRollModifiers.length > 0 ? (
                      <div className="dice-custom-list">
                        {customRollModifiers.map((modifier) => (
                          <button
                            key={modifier.id}
                            type="button"
                            className="dice-custom-chip"
                            onClick={() => removeCustomRollModifier(modifier.id)}
                          >
                            {modifier.value >= 0 ? "+" : ""}
                            {modifier.value}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="dice-column">
                  <h3>Skills</h3>
                  <div className="dice-targets">
                    {skillRollTargets.map((target) => {
                      const isSelected = selectedRollIds.includes(target.id);
                      const wouldExceedLimit = !isSelected && selectedRollIds.length >= 9;

                      return (
                        <button
                          key={target.id}
                          type="button"
                          className={`dice-target${isSelected ? " is-selected" : ""}`}
                          onClick={() => toggleRollTarget(target.id)}
                          disabled={wouldExceedLimit}
                        >
                          <span>{target.label}</span>
                          <strong>{target.value}</strong>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="dice-actions">
                <button
                  type="button"
                  onClick={handleRoll}
                  disabled={
                    selectedRollTargets.length === 0 && customRollModifiers.length === 0
                  }
                >
                  Roll
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRollIds([]);
                    setCustomRollModifiers([]);
                    setCustomRollInput("");
                    setLastRoll(null);
                  }}
                >
                  Clear
                </button>
              </div>

              {lastRoll ? (
                <div className="roll-result">
                  <span>Last Roll</span>
                  <strong>
                    {lastRoll.successes} successes{lastRoll.isBotch ? " (botch)" : ""}
                  </strong>
                  <small>{lastRoll.labels.join(" + ")}</small>
                  <small>{lastRoll.faces.join(", ")}</small>
                </div>
              ) : null}
            </>
          ) : (
            <p className="dm-summary-line">
              This combatant no longer resolves to a saved character sheet.
            </p>
          )}
        </aside>
      ) : null}

      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Combat Encounter</h1>
          </div>
          <div className="dm-nav-actions">
            <button
              type="button"
              className="sheet-nav-button"
              onClick={() => navigate("/dm/combat")}
            >
              Combat Dashboard
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
          </div>
        </header>

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

          <article className="sheet-card dm-log-card">
            <p className="section-kicker">Parties</p>
            <h2>Encounter Parties</h2>
            <div className="dm-party-grid">
              {encounterParties.map((party) => {
                const partyMembers = getEncounterPartyMembers(encounterParticipants, party.partyId);

                return (
                  <section key={party.partyId} className="dm-party-card">
                    <div className="dm-party-card-head">
                      <strong>{party.label}</strong>
                      <small>
                        {party.kind === "players"
                          ? "Player Party"
                          : party.kind === "npcs"
                            ? "NPC Party"
                            : "Custom Party"}
                      </small>
                    </div>
                    <div className="dm-party-member-list">
                      {partyMembers.length === 0 ? (
                        <p className="empty-block-copy">No combatants assigned.</p>
                      ) : (
                        partyMembers.map((member) => {
                          const hpPercent =
                            member.maxHp > 0
                              ? Math.max(0, Math.min(100, (member.currentHp / member.maxHp) * 100))
                              : 0;

                          return (
                            <div key={member.participant.characterId} className="dm-party-member-card">
                              <div className="dm-party-hp-row">
                                <span>{member.participant.displayName}</span>
                                <strong>
                                  {member.currentHp} / {member.maxHp}
                                </strong>
                              </div>
                              {member.character.sheet.statusTags.length > 0 ? (
                                <small>{member.character.sheet.statusTags.map((tag) => tag.label).join(" | ")}</small>
                              ) : null}
                              <div className="dm-party-hp-bar" aria-hidden="true">
                                <div
                                  className="dm-party-hp-fill"
                                  style={{ width: `${hpPercent}%` }}
                                />
                              </div>
                              <div className="dm-selection-controls">
                                <select
                                  value={member.participant.partyId ?? ""}
                                  onChange={(event) =>
                                    moveEncounterParticipantToParty(
                                      member.participant.characterId,
                                      event.target.value || null
                                    )
                                  }
                                >
                                  {encounterParties.map((destinationParty) => (
                                    <option
                                      key={destinationParty.partyId}
                                      value={destinationParty.partyId}
                                    >
                                      {destinationParty.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    moveEncounterParticipantToParty(
                                      member.participant.characterId,
                                      null
                                    )
                                  }
                                >
                                  Remove from Party
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}

              {unassignedEncounterMembers.length > 0 ? (
                <section className="dm-party-card">
                  <div className="dm-party-card-head">
                    <strong>Unassigned</strong>
                    <small>Encounter Only</small>
                  </div>
                  <div className="dm-party-member-list">
                    {unassignedEncounterMembers.map((member) => {
                      const hpPercent =
                        member.maxHp > 0
                          ? Math.max(0, Math.min(100, (member.currentHp / member.maxHp) * 100))
                          : 0;

                      return (
                        <div key={member.participant.characterId} className="dm-party-member-card">
                          <div className="dm-party-hp-row">
                            <span>{member.participant.displayName}</span>
                            <strong>
                              {member.currentHp} / {member.maxHp}
                            </strong>
                          </div>
                          {member.character.sheet.statusTags.length > 0 ? (
                            <small>{member.character.sheet.statusTags.map((tag) => tag.label).join(" | ")}</small>
                          ) : null}
                          <div className="dm-party-hp-bar" aria-hidden="true">
                            <div
                              className="dm-party-hp-fill"
                              style={{ width: `${hpPercent}%` }}
                            />
                          </div>
                          <div className="dm-selection-controls">
                            <select
                              value=""
                              onChange={(event) =>
                                moveEncounterParticipantToParty(
                                  member.participant.characterId,
                                  event.target.value || null
                                )
                              }
                            >
                              <option value="">Choose party</option>
                              {encounterParties.map((destinationParty) => (
                                <option key={destinationParty.partyId} value={destinationParty.partyId}>
                                  {destinationParty.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </article>

          <article className="sheet-card dm-log-card">
            <p className="section-kicker">Combatants Block</p>
            <h2>Initiative Order</h2>
            <div className="dm-accordion-list">
              {encounterParticipants.map((view, index) => {
                const { participant, snapshot } = view;

                return (
                <details key={participant.characterId} className="dm-accordion">
                  <summary className="dm-accordion-summary">
                    <div>
                      <strong>
                        {index + 1}. {participant.displayName}
                      </strong>
                      <small>
                        Init Pool {participant.initiativePool} | Roll{" "}
                        {participant.initiativeFaces.join(", ")} | Successes{" "}
                        {participant.initiativeSuccesses}
                      </small>
                      {view.character && view.character.sheet.statusTags.length > 0 ? (
                        <small>{view.character.sheet.statusTags.map((tag) => tag.label).join(" | ")}</small>
                      ) : null}
                    </div>
                  </summary>

                  <div className="dm-accordion-body">
                    {snapshot ? (
                      <>
                        <div className="dm-combatant-tools">
                          <div className="dm-combatant-tool-section dm-combatant-tool-stack">
                            <div className="dm-combatant-tool-subsection">
                              <p className="section-kicker">Character Sheet</p>
                              <div className="dm-entry-actions">
                                <button
                                  type="button"
                                  className="flow-secondary"
                                  onClick={() =>
                                    openCharacterSheet(
                                      participant.characterId,
                                      participant.ownerRole
                                    )
                                  }
                                >
                                  Open Full Character Sheet
                                </button>
                              </div>
                            </div>

                            <CombatantRuntimeAdjustments
                              view={view}
                              updateCharacter={updateCharacter}
                            />
                          </div>

                          <CombatantPowerControls
                            view={view}
                            encounterParticipants={encounterParticipants}
                            requestCast={requestCast}
                            updateCharacter={updateCharacter}
                          />
                        </div>

                        <div className="dm-combatant-values">
                          <div className="dm-combatant-section">
                            <p className="section-kicker">Combat Summary</p>
                            <div className="dm-action-grid">
                              {snapshot.combatSummary.map((field) => (
                                <div key={field.id}>
                                  <span>{field.label}</span>
                                  <strong>{field.value}</strong>
                                </div>
                              ))}
                              <div>
                                <span>Inspiration</span>
                                <strong>{snapshot.inspiration}</strong>
                                <small>{snapshot.inspirationDetail}</small>
                              </div>
                            </div>
                          </div>

                          <div className="dm-combatant-side-stack">
                            <div className="dm-combatant-section">
                              <p className="section-kicker">Stats</p>
                              <div className="dm-detail-grid dm-detail-grid-compact">
                                {snapshot.stats.map((field) => (
                                  <article key={field.id} className="dm-detail-card dm-detail-card-compact">
                                    <span>{field.label}</span>
                                    <strong>{field.value}</strong>
                                  </article>
                                ))}
                              </div>
                            </div>

                            <div className="dm-combatant-section">
                              <p className="section-kicker">Highlighted Skills</p>
                              <div className="dm-detail-grid-small dm-detail-grid-compact">
                                {snapshot.highlightedSkills.map((field) => (
                                  <article key={field.id} className="dm-detail-card dm-detail-card-compact">
                                    <span>{field.label}</span>
                                    <strong>{field.value}</strong>
                                  </article>
                                ))}
                              </div>
                            </div>
                          </div>

                          {snapshot.visibleResistances.length > 0 ? (
                            <div className="dm-combatant-section dm-combatant-section-full">
                              <p className="section-kicker">Resistances</p>
                              <div className="dm-pill-list">
                                {snapshot.visibleResistances.map((resistance) => (
                                  <div key={resistance.id} className="dm-pill">
                                    <strong>{resistance.label}</strong>
                                    <span>
                                      {resistance.levelLabel} {resistance.multiplierLabel}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {snapshot.statusTags.length > 0 ? (
                            <div className="dm-combatant-section dm-combatant-section-full">
                              <p className="section-kicker">Status Tags</p>
                              <div className="dm-pill-list">
                                {snapshot.statusTags.map((tag) => (
                                  <div key={tag} className="dm-pill">
                                    <strong>{tag}</strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="dm-summary-line">
                        This combatant no longer resolves to a saved character sheet.
                      </p>
                    )}
                  </div>
                </details>
                );
              })}
            </div>
          </article>
        </section>
      </section>

      {pendingCastConfirmation ? (
        <div
          className="dm-confirm-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePendingCastConfirmation();
            }
          }}
        >
          <div
            className="dm-confirm-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dm-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="section-kicker">Warning</p>
            <h2 id="dm-confirm-title">Replace Existing Effect?</h2>
            <div className="dm-confirm-copy">
              {pendingCastConfirmation.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              <p>Proceed and replace the existing effect?</p>
            </div>
            {pendingCastError ? <p className="dm-error">{pendingCastError}</p> : null}
            <div className="dm-confirm-actions">
              <button type="button" className="flow-secondary" onClick={closePendingCastConfirmation}>
                Cancel
              </button>
              <button type="button" className="flow-primary" onClick={confirmPendingCast}>
                Confirm Cast
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function getAuraSelectedTargetIds(effect: ActivePowerEffect): string[] {
  const targetIds = effect.sharedTargetCharacterIds ?? [effect.casterCharacterId];
  return Array.from(new Set([effect.casterCharacterId, ...targetIds]));
}

function buildDefaultHealingAllocations(
  totalAmount: number,
  targetIds: string[]
): Record<string, string> {
  if (targetIds.length === 0) {
    return {};
  }

  const normalizedTotal = Math.max(0, Math.trunc(totalAmount));
  const baseAmount = Math.floor(normalizedTotal / targetIds.length);
  const remainder = normalizedTotal % targetIds.length;

  return Object.fromEntries(
    targetIds.map((targetId, index) => [
      targetId,
      String(baseAmount + (index < remainder ? 1 : 0)),
    ])
  );
}

function buildAssessCharacterHistoryEntry(
  casterSheet: CharacterRecord["sheet"],
  targetCharacter: CharacterRecord,
  actualDateTime: string
): GameHistoryEntry {
  const targetDerived = buildCharacterDerivedValues(targetCharacter.sheet);
  const targetSnapshot = buildCharacterEncounterSnapshot(targetCharacter.sheet);
  const awarenessLevel =
    casterSheet.powers.find((power) => power.id === "awareness")?.level ?? 0;
  const targetProgression = getCrAndRankFromXpUsed(targetCharacter.sheet.xpUsed);

  return {
    id: createTimestampedId("history-intel"),
    type: "intel_snapshot",
    actualDateTime,
    gameDateTime: casterSheet.gameDateTime,
    sourcePower: `Assess Character Lv ${awarenessLevel}`,
    targetCharacterId: targetCharacter.id,
    targetName: targetCharacter.sheet.name.trim() || targetCharacter.id,
    summary: `CR ${targetProgression.cr}, Rank ${targetProgression.rank}`,
    snapshot: {
      rank: targetProgression.rank,
      cr: targetProgression.cr,
      age: targetCharacter.sheet.age,
      karma: `-${targetCharacter.sheet.negativeKarma} / +${targetCharacter.sheet.positiveKarma}`,
      biographyPrimary: targetCharacter.sheet.biographyPrimary,
      resistances: targetSnapshot.visibleResistances.map(
        (resistance) =>
          `${resistance.label}: ${resistance.levelLabel} ${resistance.multiplierLabel}`
      ),
      combatSummary: targetSnapshot.combatSummary.map((field) => ({
        label: field.label,
        value: field.value,
      })),
      stats: targetSnapshot.stats.map((field) => ({
        label: field.label,
        value: field.value,
      })),
      skills: targetCharacter.sheet.skills.map((skill) => ({
        label: skill.label,
        value: getCurrentSkillValue(targetCharacter.sheet, skill.id),
      })),
      powers:
        awarenessLevel >= 2
          ? targetCharacter.sheet.powers.map(
              (power) => `${power.name} Lv ${power.level}`
            )
          : [],
      specials: awarenessLevel >= 2 ? targetCharacter.sheet.statusTags.map((tag) => tag.label) : [],
      notes: [
        `HP ${targetCharacter.sheet.currentHp} / ${targetDerived.maxHp}`,
        `Inspiration ${targetDerived.totalInspiration}`,
      ],
    },
  };
}

function getEncounterPartyMembers(
  encounterParticipants: EncounterParticipantView[],
  partyId: string | null
): EncounterPartyMemberView[] {
  return encounterParticipants.flatMap((view) => {
    if (!view.character || view.participant.partyId !== partyId) {
      return [];
    }

    const derived = buildCharacterDerivedValues(view.character.sheet);
    return [
      {
        participant: view.participant,
        character: view.character,
        currentHp: view.character.sheet.currentHp,
        maxHp: derived.maxHp,
      },
    ];
  });
}

function isTargetAffectedByAuraSource(
  sourceEffect: ActivePowerEffect,
  targetCharacter: CharacterRecord
): boolean {
  if (targetCharacter.id === sourceEffect.casterCharacterId) {
    return true;
  }

  const comparisonEffect = buildAuraSharedPowerEffect(sourceEffect, targetCharacter.id);
  return (targetCharacter.sheet.activePowerEffects ?? []).some(
    (effect) =>
      isAuraSharedEffect(effect) &&
      (effect.sourceEffectId === sourceEffect.id ||
        doesActivePowerEffectConflict(effect, comparisonEffect))
  );
}
