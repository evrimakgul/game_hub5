import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { CharacterCombatSummary } from "../components/player-character/CharacterCombatSummary";
import { CharacterHeader } from "../components/player-character/CharacterHeader";
import { CharacterHistorySection } from "../components/player-character/CharacterHistorySection";
import { CharacterIdentitySection } from "../components/player-character/CharacterIdentitySection";
import { CharacterInventorySection } from "../components/player-character/CharacterInventorySection";
import { CharacterPowersSection } from "../components/player-character/CharacterPowersSection";
import { CharacterResources } from "../components/player-character/CharacterResources";
import { CharacterSkillsSection } from "../components/player-character/CharacterSkillsSection";
import { CharacterStatsSection } from "../components/player-character/CharacterStatsSection";
import { RollHelperPopover } from "../components/player-character/RollHelperPopover";
import { PLAYER_CHARACTER_TEMPLATE } from "../config/characterTemplate";
import { formatDateDayMonthYear } from "../lib/dateTime";
import { rollD10Faces } from "../lib/dice";
import { usePlayerCharacterMutations } from "../hooks/usePlayerCharacterMutations";
import { buildItemIndex, getCharacterArtifactAppraisalLevel } from "../lib/items.ts";
import { buildPowerUsageSummary } from "../lib/powerUsage";
import { resolveDicePool } from "../rules/combat";
import {
  buildEditSessionStatFloor,
  buildPlayerCharacterViewModel,
  type PlayerRollTarget,
} from "../selectors/playerCharacterViewModel";
import { useAppFlow } from "../state/appFlow";
import type { StatId } from "../types/character";

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

export type PlayerCharacterPageViewMode = "player" | "dm-readonly" | "dm-editable";

export function PlayerCharacterPage({
  viewMode,
}: {
  viewMode: PlayerCharacterPageViewMode;
}) {
  const {
    characters,
    items,
    activePlayerCharacter,
    activeDmCharacter,
    updateCharacter,
    createItem,
    updateItem,
    deleteItem,
  } = useAppFlow();
  const navigate = useNavigate();
  const location = useLocation();
  const [isEditMode, setIsEditMode] = useState(false);
  const [dmEditMode, setDmEditMode] = useState(false);
  const [adminOverrideMode, setAdminOverrideMode] = useState(false);
  const [dmEditReason, setDmEditReason] = useState("");
  const [adminOverrideReason, setAdminOverrideReason] = useState("");
  const [adminOverrideError, setAdminOverrideError] = useState<string | null>(null);
  const [editSessionStatFloor, setEditSessionStatFloor] = useState<Record<StatId, number> | null>(
    null
  );
  const [pendingPowerId, setPendingPowerId] = useState("");
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [dicePosition, setDicePosition] = useState({ x: 24, y: 24 });
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [customRollInput, setCustomRollInput] = useState("");
  const [customRollModifiers, setCustomRollModifiers] = useState<CustomRollModifier[]>([]);
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const dragRef = useRef<{ active: boolean; moved: boolean; offsetX: number; offsetY: number }>(
    {
      active: false,
      moved: false,
      offsetX: 0,
      offsetY: 0,
    }
  );
  const isDmReadOnlyView = viewMode === "dm-readonly";
  const isDmEditableView = viewMode === "dm-editable";
  const isDmView = viewMode !== "player";
  const characterIdFromQuery = new URLSearchParams(location.search).get("characterId");
  const queriedCharacter =
    characterIdFromQuery
      ? characters.find((character) => character.id === characterIdFromQuery) ?? null
      : null;
  const isReadOnlyView = isDmReadOnlyView;
  const activeCharacter =
    queriedCharacter ?? (isDmEditableView ? activeDmCharacter : activePlayerCharacter);
  const activeSheet = activeCharacter?.sheet ?? null;
  const sheetState = activeSheet ?? PLAYER_CHARACTER_TEMPLATE.createInstance();

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
    if (!activeSheet || !activeCharacter) {
      return;
    }

    setSessionNotes(activeSheet.effects.join("\n"));
  }, [activeCharacter?.id]);

  useEffect(() => {
    if (!activeCharacter) {
      return;
    }

    setIsEditMode(false);
    setDmEditMode(isDmEditableView);
    setAdminOverrideMode(false);
    setDmEditReason("");
    setAdminOverrideReason("");
    setAdminOverrideError(null);
    setEditSessionStatFloor(
      isDmEditableView ? buildEditSessionStatFloor(activeCharacter.sheet) : null
    );
  }, [activeCharacter?.id, isDmEditableView, isDmReadOnlyView]);

  const isSheetEditMode = isEditMode || dmEditMode;
  const isDmRuntimeEditMode = isDmView && dmEditMode;
  const isProgressionEditMode = isEditMode || (isDmEditableView && dmEditMode);
  const actualDate = formatDateDayMonthYear(new Date());
  const itemsById = buildItemIndex(items);
  const {
    derived,
    progression,
    xpLeftOver,
    rollTargets,
    statRollTargets,
    skillRollTargets,
    availablePowerOptions,
  } = buildPlayerCharacterViewModel(sheetState, itemsById);
  const powerUsageSummary = buildPowerUsageSummary(sheetState);
  const artifactAppraisalLevel = getCharacterArtifactAppraisalLevel(sheetState);
  const selectedRollTargets = selectedRollIds
    .map((targetId) => rollTargets.find((target) => target.id === targetId))
    .filter((target): target is PlayerRollTarget => target !== undefined);
  const customRollPool = customRollModifiers.reduce((total, modifier) => total + modifier.value, 0);
  const selectedRollPool =
    selectedRollTargets.reduce((total, target) => total + target.value, 0) + customRollPool;
  const mutations = usePlayerCharacterMutations({
    activeCharacter,
    sheetState,
    items,
    xpLeftOver,
    isReadOnlyView,
    isDmView,
    isDmEditableView,
    dmEditMode,
    adminOverrideMode,
    dmEditReason,
    adminOverrideReason,
    editSessionStatFloor,
    pendingPowerId,
    sessionNotes,
    updateCharacter,
    createItem,
    updateItem,
    deleteItem,
    setPendingPowerId,
    setSessionNotes,
    setAdminOverrideError,
  });

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
    if (selectedRollPool <= 0) {
      return;
    }

    const faces = rollD10Faces(selectedRollPool);
    const resolution = resolveDicePool(faces, selectedRollPool);
    setLastRoll({
      labels: [
        ...selectedRollTargets.map((target) => `${target.label} +${target.value}`),
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

  function handleToggleEditMode(): void {
    if (isReadOnlyView) {
      return;
    }

    if (isEditMode) {
      setIsEditMode(false);
      setEditSessionStatFloor(null);
      return;
    }

    setEditSessionStatFloor(buildEditSessionStatFloor(sheetState));
    setIsEditMode(true);
  }

  function handleToggleDmEditMode(): void {
    if (!isDmView) {
      return;
    }

    setAdminOverrideMode(false);
    setAdminOverrideError(null);
    setDmEditMode((current) => {
      const next = !current;
      setEditSessionStatFloor(next ? buildEditSessionStatFloor(sheetState) : null);
      return next;
    });
  }

  function handleToggleAdminOverrideMode(): void {
    if (!isDmView) {
      return;
    }

    setDmEditMode(false);
    setAdminOverrideMode((current) => !current);
    setAdminOverrideError(null);
  }

  if (!activeCharacter || !activeSheet) {
    return (
      <Navigate
        to={isDmEditableView ? "/dm/npc-creator" : isDmReadOnlyView ? "/dm/characters" : "/player"}
        replace
      />
    );
  }

  return (
    <main className="sheet-page">
      <RollHelperPopover
        isDiceOpen={isDiceOpen}
        dicePosition={dicePosition}
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
        onToggleRollTarget={toggleRollTarget}
        onCustomRollInputChange={setCustomRollInput}
        onAddCustomRollModifier={handleAddCustomRollModifier}
        onRemoveCustomRollModifier={removeCustomRollModifier}
        onRoll={handleRoll}
        onClear={clearRollHelper}
      />

      <section className="sheet-frame">
        <CharacterHeader
          sheetState={sheetState}
          actualDate={actualDate}
          progression={progression}
          xpLeftOver={xpLeftOver}
          isSheetEditMode={isSheetEditMode}
          isDmView={isDmView}
          isDmEditableView={isDmEditableView}
          isDmReadOnlyView={isDmReadOnlyView}
          isEditMode={isEditMode}
          dmEditMode={dmEditMode}
          adminOverrideMode={adminOverrideMode}
          dmEditReason={dmEditReason}
          adminOverrideReason={adminOverrideReason}
          adminOverrideError={adminOverrideError}
          onNavigateMainMenu={() => navigate("/")}
          onNavigateBack={() =>
            navigate(
              isDmEditableView ? "/dm/npc-creator" : isDmReadOnlyView ? "/dm/characters" : "/player"
            )
          }
          onUpdateField={mutations.updateSheetField}
          onToggleEditMode={handleToggleEditMode}
          onToggleDmEditMode={handleToggleDmEditMode}
          onToggleAdminOverrideMode={handleToggleAdminOverrideMode}
          onDmEditReasonChange={setDmEditReason}
          onAdminOverrideReasonChange={setAdminOverrideReason}
        />

        <section className="sheet-grid">
          <CharacterIdentitySection
            sheetState={sheetState}
            isSheetEditMode={isSheetEditMode}
            onUpdateField={mutations.updateSheetField}
          />

          <CharacterResources
            sheetState={sheetState}
            derived={derived}
            isDmRuntimeEditMode={isDmRuntimeEditMode}
            onRuntimeInput={mutations.handleRuntimeInput}
          />

          <CharacterCombatSummary
            sheetState={sheetState}
            derived={derived}
            isDmRuntimeEditMode={isDmRuntimeEditMode}
            canManagePowerUsage={!isReadOnlyView}
            powerUsageSummary={powerUsageSummary}
            onResetPowerUsage={mutations.resetPowerUsage}
            onRuntimeInput={mutations.handleRuntimeInput}
          />

          <CharacterStatsSection
            sheetState={sheetState}
            itemsById={itemsById}
            isProgressionEditMode={isProgressionEditMode}
            adminOverrideMode={adminOverrideMode}
            editSessionStatFloor={editSessionStatFloor}
            xpLeftOver={xpLeftOver}
            onAdjustStat={mutations.adjustStat}
            onAdjustStatOverride={mutations.adjustStatOverride}
          />

          <CharacterSkillsSection
            sheetState={sheetState}
            itemsById={itemsById}
            isProgressionEditMode={isProgressionEditMode}
            adminOverrideMode={adminOverrideMode}
            xpLeftOver={xpLeftOver}
            onAdjustSkill={mutations.adjustSkill}
            onAdjustSkillOverride={mutations.adjustSkillOverride}
          />

          <CharacterPowersSection
            sheetState={sheetState}
            availablePowerOptions={availablePowerOptions}
            pendingPowerId={pendingPowerId}
            xpLeftOver={xpLeftOver}
            isProgressionEditMode={isProgressionEditMode}
            adminOverrideMode={adminOverrideMode}
            onPendingPowerIdChange={setPendingPowerId}
            onAddPower={mutations.handleAddPower}
            onAddPowerOverride={mutations.handleAddPowerOverride}
            onAdjustPower={mutations.adjustPower}
            onAdjustPowerOverride={mutations.adjustPowerOverride}
          />

          <CharacterInventorySection
            characterId={activeCharacter.id}
            sheetState={sheetState}
            itemsById={itemsById}
            artifactAppraisalLevel={artifactAppraisalLevel}
            isSheetEditMode={isSheetEditMode}
            onCreateSharedItem={mutations.createSharedItem}
            onUpdateSharedItemField={mutations.updateSharedItemField}
            onUpdateSharedItemBlueprint={mutations.updateSharedItemBlueprint}
            onUpdateSharedItemBonusNotes={mutations.updateSharedItemBonusNotes}
            onUpdateSharedItemStatBonus={mutations.updateSharedItemStatBonus}
            onUpdateSharedItemDerivedBonus={mutations.updateSharedItemDerivedBonus}
            onUpdateSharedItemOwnedState={mutations.updateSharedItemOwnedState}
            onUpdateSharedItemInventoryState={mutations.updateSharedItemInventoryState}
            onUpdateSharedItemActiveState={mutations.updateSharedItemActiveState}
            onIdentifySharedItem={mutations.identifySharedItem}
            onMaskSharedItem={mutations.maskSharedItem}
            onDeleteSharedItem={mutations.deleteSharedItem}
            onUpdateWeaponHandSlotItem={mutations.updateWeaponHandSlotItem}
            onUpdateEquipmentEntry={mutations.updateEquipmentEntry}
            onAddEquipmentEntry={mutations.addEquipmentEntry}
            onRemoveEquipmentEntry={mutations.removeEquipmentEntry}
            onUpdateMoney={(value) => mutations.updateSheetField("money", value)}
          />

          <CharacterHistorySection
            sessionNotes={sessionNotes}
            isReadOnlyView={isReadOnlyView}
            gameHistory={sheetState.gameHistory}
            onSessionNotesChange={setSessionNotes}
            onAppendHistory={mutations.handleAppendHistory}
          />
        </section>
      </section>
    </main>
  );
}
