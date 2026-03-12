import { useEffect, useRef, useState } from "react";

import { getRuntimePowerAbbreviation } from "../../config/powerData";
import {
  applyActivePowerEffect,
  buildAuraSharedPowerEffect,
  canSelectAuraTargets,
  doesActivePowerEffectConflict,
  getCastPowerAllowedStats,
  getCastPowerModeOptionsForVariant,
  getCastPowerTargetLimit,
  getCastPowerTargetModeForVariant,
  getCastPowerVariantOptions,
  getHealingPowerTotal,
  getSupportedCastablePowers,
  isAuraSharedEffect,
  isAuraSourceEffect,
  removeActivePowerEffect,
  removeAuraSharedEffectsForTarget,
  updateAuraSourceTargets,
  type CastPowerMode,
  type CastPowerVariantId,
} from "../../config/powerEffects";
import {
  buildDefaultHealingAllocations,
  getAuraSelectedTargetIds,
  isTargetAffectedByAuraSource,
} from "../../lib/combatEncounterCasting";
import type { ActivePowerEffect } from "../../types/activePowerEffects";
import type {
  CastOutcomeState,
  CastRequestPayload,
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../../types/combatEncounterView";
import type { StatId } from "../../types/character";
import { AuraTargetPopover } from "./AuraTargetPopover";

type CombatantPowerControlsProps = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  requestCast: (payload: CastRequestPayload) => string | null;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

export function CombatantPowerControls({
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

  if (!character) {
    return null;
  }

  const casterCharacter = character;
  const shouldShowVariantField = variantOptions.length > 1;
  const shouldShowTargetField = targetMode !== "self";
  const shouldShowModeField = selectedPower?.id === "shadow_control" && modeOptions.length > 1;

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

      const nextSharedEffect = buildAuraSharedPowerEffect(latestSourceEffect, targetId);
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
        encounterParticipants.find(({ participant }) => participant.characterId === targetId)?.character ?? null;

      return targetCharacter ? isTargetAffectedByAuraSource(latestSourceEffect, targetCharacter) : false;
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
          <p className="dm-summary-line">This combatant has no supported castable powers in the first slice.</p>
        ) : (
          <>
            <div className="dm-power-form">
              <label className="dm-field">
                <span>Power</span>
                <select value={selectedPower?.id ?? ""} onChange={(event) => setSelectedPowerId(event.target.value)}>
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
                    onChange={(event) => setSelectedVariantId(event.target.value as CastPowerVariantId)}
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
                    onChange={(event) => setSelectedCastMode(event.target.value === "aura" ? "aura" : "self")}
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
                    onChange={(event) => setAttackOutcome(event.target.value as CastOutcomeState)}
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
                  <select value={resolvedSelectedStatId} onChange={(event) => setSelectedStatId(event.target.value)}>
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
                        targetOptions.find(({ participant }) => participant.characterId === targetId)?.participant
                          .displayName ?? targetId;

                      return (
                        <label key={targetId} className="dm-field">
                          <span>{targetLabel}</span>
                          <input
                            type="number"
                            min="0"
                            max={healingTotal}
                            value={healingAllocations[targetId] ?? "0"}
                            onChange={(event) => updateHealingAllocation(targetId, event.target.value)}
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
                <div className="dm-effect-actions" ref={openAuraEffectId === effect.id ? auraPopoverRef : null}>
                  {isAuraSourceEffect(effect) ? (
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
                  ) : null}
                  <button type="button" className="flow-secondary" onClick={() => handleRemoveEffect(effect)}>
                    Remove
                  </button>
                  {openAuraEffectId === effect.id && canSelectAuraTargets(effect) ? (
                    <AuraTargetPopover
                      effect={effect}
                      encounterParticipants={encounterParticipants}
                      isTargetSelected={(targetId) => {
                        const targetCharacter =
                          encounterParticipants.find(({ participant }) => participant.characterId === targetId)
                            ?.character ?? null;

                        return targetCharacter
                          ? isTargetAffectedByAuraSource(effect, targetCharacter)
                          : false;
                      }}
                      onToggleTarget={(targetId) => toggleAuraTarget(effect, targetId)}
                      onApplyAllAllies={() => applyAuraToAllAllies(effect)}
                    />
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
