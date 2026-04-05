import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { resolveDicePool } from "../rules/combat";
import { buildCharacterEncounterSnapshot } from "../rules/combatEncounter";
import {
  prepareCastRequest,
} from "../lib/combatEncounterCasting";
import {
  preparePhysicalAttackRequest,
} from "../lib/combatEncounterPhysicalAttacks";
import {
  isControlledByCaster,
} from "../powers/runtimeSupport.ts";
import { rollD10Faces } from "../lib/dice";
import { buildItemIndex } from "../lib/items.ts";
import { buildEncounterRollTargets, getEncounterPartyMembers } from "../selectors/encounterViewModel";
import { useAppFlow } from "../state/appFlow";
import { EncounterExecutionEngine, type EncounterExecutionResult } from "../engine/encounterExecutionEngine.ts";
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

export function CombatEncounterPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    activeCombatEncounter,
    characters,
    items,
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
    updateCharacter,
    replaceCharacters,
    updateKnowledgeState,
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

  function buildExecutionEngine(): EncounterExecutionEngine | null {
    if (!activeCombatEncounter) {
      return null;
    }

    return new EncounterExecutionEngine({
      characters,
      encounter: activeCombatEncounter,
      knowledgeState: {
        knowledgeEntities,
        knowledgeRevisions,
        knowledgeOwnerships,
      },
      itemsById,
    });
  }

  function commitExecutionResult(result: EncounterExecutionResult): void {
    replaceCharacters(result.characters);
    updateKnowledgeState(result.knowledgeState);
    updateCombatEncounter(result.encounter);
  }

  function advanceEncounterTurn(): void {
    const engine = buildExecutionEngine();
    if (!engine) {
      return;
    }

    commitExecutionResult(engine.advanceTurn());
  }

  function executePreparedCast(request: PreparedCastRequest): string | null {
    const engine = buildExecutionEngine();
    if (!engine) {
      return "The active encounter is no longer available.";
    }

    const execution = engine.executePreparedRequest(request);
    if ("error" in execution) {
      return execution.error;
    }

    commitExecutionResult(execution.result);
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

  function requestControlRelease(payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
  }): string | null {
    const casterCharacter = payload.casterView.character;
    const targetCharacter = payload.targetView.character;
    const selectedPower =
      casterCharacter?.sheet.powers.find((power) => power.id === "crowd_control") ?? null;

    if (!casterCharacter || !targetCharacter || !selectedPower) {
      return "Crowd Control release is no longer available for this combatant.";
    }

    if (!isControlledByCaster(payload.targetView, casterCharacter.id)) {
      return "That target is not currently controlled by this caster.";
    }

    return requestCast({
      casterCharacter,
      casterDisplayName: payload.casterView.participant.displayName,
      selectedPower,
      selectedVariantId: "release_control",
      attackOutcome: "unresolved",
      selectedTargetIds: [targetCharacter.id],
      fallbackTargetIds: [targetCharacter.id],
      healingAllocations: {},
      selectedStatId: null,
      castMode: "self",
      selectedDamageType: null,
      bonusManaSpend: 0,
      selectedSummonOptionId: null,
      encounterParticipants,
      itemsById,
    });
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
              requestControlRelease={requestControlRelease}
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

