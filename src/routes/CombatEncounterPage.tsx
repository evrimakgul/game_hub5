import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { resolveDicePool } from "../config/combat";
import { buildCharacterEncounterSnapshot } from "../config/combatEncounter";
import { buildCharacterDerivedValues } from "../config/characterRuntime";
import {
  applyActivePowerEffect,
  buildActivePowerEffect,
  buildAuraSharedPowerEffect,
  canSelectAuraTargets,
  doesActivePowerEffectConflict,
  isAuraSharedEffect,
  isAuraSourceEffect,
  getCastPowerAllowedStats,
  getCastPowerModeOptions,
  getCastPowerTargetMode,
  getSupportedCastablePowers,
  removeActivePowerEffect,
  removeAuraSharedEffectsBySource,
  removeAuraSharedEffectsForTarget,
  spendPowerMana,
  updateAuraSourceTargets,
} from "../config/powerEffects";
import { getRuntimePowerAbbreviation } from "../config/powerData.ts";
import type { PowerEntry, StatId } from "../config/characterTemplate";
import { type CharacterRecord, useAppFlow } from "../state/appFlow";
import type { ActivePowerEffect, ActivePowerShareMode } from "../types/activePowerEffects";
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

type EncounterParticipantView = {
  participant: CombatEncounterParticipant;
  character: CharacterRecord | null;
  snapshot: CharacterEncounterSnapshot | null;
};

type CharacterSheetUpdater =
  | CharacterRecord["sheet"]
  | ((current: CharacterRecord["sheet"]) => CharacterRecord["sheet"]);

type PreparedCastRequest = {
  casterCharacterId: string;
  targetCharacterIds: string[];
  manaCost: number;
  effects: ActivePowerEffect[];
};

type PendingCastConfirmation = {
  request: PreparedCastRequest;
  warnings: string[];
};

type CastRequestPayload = {
  casterCharacter: CharacterRecord;
  casterDisplayName: string;
  selectedPower: PowerEntry;
  selectedTargetIds: string[];
  fallbackTargetIds: string[];
  selectedStatId: StatId | null;
  castMode: ActivePowerShareMode;
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

function D10Icon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="d10-icon">
      <path
        d="M32 4 52 18 58 40 44 58 20 58 6 40 12 18Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M32 4 52 18 58 40 44 58 20 58 6 40 12 18Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M12 18h40M6 40h52M20 58l12-54 12 54"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
        10
      </text>
    </svg>
  );
}

type CombatantRuntimeAdjustmentsProps = {
  view: EncounterParticipantView;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

function CombatantRuntimeAdjustments({
  view,
  updateCharacter,
}: CombatantRuntimeAdjustmentsProps) {
  const character = view.character;
  const derived = character ? buildCharacterDerivedValues(character.sheet) : null;
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverPanelRef = useRef<HTMLDivElement | null>(null);
  const [hpSet, setHpSet] = useState("");
  const [manaSet, setManaSet] = useState("");
  const [inspirationSet, setInspirationSet] = useState("");
  const [reason, setReason] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState<"below" | "above">("below");

  if (!character) {
    return null;
  }

  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsPopoverOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isPopoverOpen]);

  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }

    function updatePlacement(): void {
      const anchor = popoverRef.current;
      const panel = popoverPanelRef.current;
      if (!anchor || !panel) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const panelHeight = panel.offsetHeight;
      const spaceBelow = window.innerHeight - anchorRect.bottom;
      const spaceAbove = anchorRect.top;

      setPopoverPlacement(
        spaceBelow < panelHeight + 16 && spaceAbove > spaceBelow ? "above" : "below"
      );
    }

    const frameId = window.requestAnimationFrame(updatePlacement);
    window.addEventListener("resize", updatePlacement);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePlacement);
    };
  }, [isPopoverOpen]);

  function appendDmAuditEntry(
    sheet: CharacterRecord["sheet"],
    fieldPath: string,
    beforeValue: number,
    afterValue: number
  ): CharacterRecord["sheet"] {
    const entry = {
      id: `dm-edit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      characterId: character.id,
      targetOwnerRole: view.participant.ownerRole,
      editLayer: "runtime" as const,
      fieldPath,
      beforeValue: String(beforeValue),
      afterValue: String(afterValue),
      reason: reason.trim(),
      sourceScreen: "dm-combat-encounter",
    };

    return {
      ...sheet,
      dmAuditLog: [...(sheet.dmAuditLog ?? []), entry],
    };
  }

  function applyRuntimeValue(
    field: "currentHp" | "currentMana" | "inspiration",
    value: number
  ): void {
    updateCharacter(character.id, (currentSheet) => {
      const derivedSnapshot = buildCharacterDerivedValues(currentSheet);
      const nextBaseValue = Math.max(0, Math.trunc(value));
      const before =
        field === "currentMana" ? derivedSnapshot.currentMana : currentSheet[field] ?? 0;
      const maxValue =
        field === "currentHp"
          ? derivedSnapshot.maxHp
          : field === "currentMana"
            ? derivedSnapshot.maxMana
            : null;
      const nextValue = maxValue === null ? nextBaseValue : Math.min(nextBaseValue, maxValue);
      if (before === nextValue) {
        return currentSheet;
      }

      return appendDmAuditEntry(
        {
          ...currentSheet,
          [field]: nextValue,
          ...(field === "currentMana" ? { manaInitialized: true } : null),
        },
        field,
        before,
        nextValue
      );
    });
  }

  function adjustRuntimeValue(
    field: "currentHp" | "currentMana" | "inspiration",
    delta: number
  ): void {
    const currentValue =
      field === "currentMana" ? derived?.currentMana ?? 0 : character.sheet[field];
    applyRuntimeValue(field, currentValue + delta);
  }

  function handleSet(
    field: "currentHp" | "currentMana" | "inspiration",
    inputValue: string,
    clear: () => void
  ): void {
    const parsed = Number.parseInt(inputValue.trim(), 10);
    if (!Number.isFinite(parsed)) {
      return;
    }

    applyRuntimeValue(field, parsed);
    clear();
  }

  function renderRuntimeStepper(
    label: string,
    field: "currentHp" | "currentMana" | "inspiration",
    value: number
  ) {
    return (
      <div className="dm-runtime-stepper-row">
        <span>{label}</span>
        <div className="dm-runtime-stepper">
          <button type="button" onClick={() => adjustRuntimeValue(field, -1)}>
            -
          </button>
          <strong>{value}</strong>
          <button type="button" onClick={() => adjustRuntimeValue(field, 1)}>
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-combatant-tool-subsection">
      <p className="section-kicker">Edit Character</p>
      <div className="dm-runtime-popover-anchor" ref={popoverRef}>
        <button
          type="button"
          className="flow-secondary"
          onClick={() => setIsPopoverOpen((current) => !current)}
        >
          Edit Character
        </button>
        {isPopoverOpen ? (
          <div
            ref={popoverPanelRef}
            className={`dm-runtime-popover ${
              popoverPlacement === "above" ? "is-above" : "is-below"
            }`}
          >
            <div className="dm-runtime-popover-head">
              <div>
                <p className="section-kicker">Runtime Adjustments</p>
                <strong>{character.sheet.name.trim() || "Unnamed Character"}</strong>
              </div>
            </div>

            <div className="dm-runtime-stepper-list">
              {renderRuntimeStepper("HP", "currentHp", character.sheet.currentHp)}
              {renderRuntimeStepper("Mana", "currentMana", derived?.currentMana ?? 0)}
              {renderRuntimeStepper("Inspiration", "inspiration", character.sheet.inspiration)}
            </div>
            <div className="dm-runtime-set-grid">
              <label>
                <span>Set HP</span>
                <input
                  type="number"
                  value={hpSet}
                  onChange={(event) => setHpSet(event.target.value)}
                  placeholder="HP"
                />
              </label>
              <button
                type="button"
                onClick={() => handleSet("currentHp", hpSet, () => setHpSet(""))}
              >
                Set
              </button>
            </div>
            <div className="dm-runtime-set-grid">
              <label>
                <span>Set Mana</span>
                <input
                  type="number"
                  value={manaSet}
                  onChange={(event) => setManaSet(event.target.value)}
                  placeholder="Mana"
                />
              </label>
              <button
                type="button"
                onClick={() => handleSet("currentMana", manaSet, () => setManaSet(""))}
              >
                Set
              </button>
            </div>
            <div className="dm-runtime-set-grid">
              <label>
                <span>Set Inspiration</span>
                <input
                  type="number"
                  value={inspirationSet}
                  onChange={(event) => setInspirationSet(event.target.value)}
                  placeholder="Inspiration"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  handleSet("inspiration", inspirationSet, () => setInspirationSet(""))
                }
              >
                Set
              </button>
            </div>
            <label className="dm-field">
              <span>Reason (optional)</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why this change?"
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
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

  const builtEffects = finalTargets.map((targetCharacter) =>
    buildActivePowerEffect({
      casterCharacterId: payload.casterCharacter.id,
      casterName: payload.casterCharacter.sheet.name.trim() || payload.casterDisplayName,
      targetCharacterId: targetCharacter.id,
      targetName: targetCharacter.sheet.name.trim() || targetCharacter.id,
      power: payload.selectedPower,
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
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [selectedStatId, setSelectedStatId] = useState("");
  const [selectedCastMode, setSelectedCastMode] = useState<ActivePowerShareMode>("self");
  const [castError, setCastError] = useState<string | null>(null);
  const [openAuraEffectId, setOpenAuraEffectId] = useState<string | null>(null);
  const character = view.character;
  const auraPopoverRef = useRef<HTMLDivElement | null>(null);
  const castablePowers = character ? getSupportedCastablePowers(character.sheet) : [];
  const selectedPower =
    castablePowers.find((power) => power.id === selectedPowerId) ?? castablePowers[0] ?? null;
  const targetMode = selectedPower ? getCastPowerTargetMode(selectedPower) : "self";
  const modeOptions = selectedPower ? getCastPowerModeOptions(selectedPower) : ["self"];
  const allowedStats = selectedPower ? getCastPowerAllowedStats(selectedPower) : [];
  const targetOptions =
    targetMode === "self"
      ? encounterParticipants.filter(
          ({ participant }) => participant.characterId === view.participant.characterId
        )
      : encounterParticipants.filter(({ character: candidateCharacter }) => candidateCharacter !== null);
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
  const resolvedCastMode = modeOptions.includes(selectedCastMode === "aura" ? "aura" : "self")
    ? selectedCastMode
    : modeOptions[0];
  const allowedStatsKey = allowedStats.join("|");
  const targetOptionIdsKey = targetOptions.map(({ participant }) => participant.characterId).join("|");

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
    if (!selectedPower) {
      setSelectedCastMode("self");
      return;
    }

    if (!modeOptions.includes(selectedCastMode === "aura" ? "aura" : "self")) {
      setSelectedCastMode(modeOptions[0]);
    }
  }, [modeOptions, selectedCastMode, selectedPower]);

  useEffect(() => {
    if (!selectedPower) {
      if (selectedTargetIds.length > 0) {
        setSelectedTargetIds([]);
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
      } else if (validTargetIds.length !== selectedTargetIds.length) {
        setSelectedTargetIds(validTargetIds);
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
    targetMode,
    targetOptionIdsKey,
    view.participant.characterId,
  ]);

  if (!character) {
    return null;
  }
  const casterCharacter = character;
  const shouldShowTargetField = selectedPower?.id === "body_reinforcement";
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
        : [...currentIds, targetId]
    );
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
      selectedTargetIds,
      fallbackTargetIds: resolvedTargetIds,
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
      updateCharacter(character.id, (currentSheet) => removeActivePowerEffect(currentSheet, effect.id));
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

        return updateAuraSourceTargets(
          currentSheet,
          effect.sourceEffectId,
          getAuraSelectedTargetIds(sourceEffect).filter((targetId) => targetId !== character.id)
        );
      });
    }

    updateCharacter(character.id, (currentSheet) => removeActivePowerEffect(currentSheet, effect.id));
  }

  function toggleAuraTarget(sourceEffect: ActivePowerEffect, targetId: string): void {
    const latestSourceEffect =
      (character.sheet.activePowerEffects ?? []).find((effect) => effect.id === sourceEffect.id) ??
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
      (character.sheet.activePowerEffects ?? []).find((effect) => effect.id === sourceEffect.id) ??
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

          return updateAuraSourceTargets(
            currentSheet,
            conflictingAura.sourceEffectId,
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
      (character.sheet.activePowerEffects ?? []).find((effect) => effect.id === sourceEffect.id) ??
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

              {shouldShowTargetField ? (
                <label className="dm-field">
                  <span>Target</span>
                  {targetMode === "multiple" ? (
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
                  ) : (
                    <select
                      value={resolvedSingleTargetId}
                      onChange={(event) => setSelectedTargetIds([event.target.value])}
                      disabled={targetMode === "self"}
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

    const faces = Array.from({ length: selectedRollPool }, () => Math.floor(Math.random() * 10) + 1);
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
