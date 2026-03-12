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
import { resolveDicePool } from "../rules/combat";
import { buildCharacterDerivedValues } from "../config/characterRuntime";
import { getPowerTemplate, type CharacterDraft } from "../config/characterTemplate";
import {
  STAT_XP_BY_LEVEL,
  T1_POWER_XP_BY_LEVEL,
  T1_SKILL_XP_BY_LEVEL,
} from "../rules/xpTables";
import { formatDateDayMonthYear } from "../lib/dateTime";
import {
  appendDmAuditEntry as appendDmAuditEntryToSheet,
  createDmAuditEntry as createDmAuditLogEntry,
} from "../lib/dmAudit";
import { rollD10Faces } from "../lib/dice";
import { buildGameHistoryNoteEntry, prependGameHistoryEntry } from "../lib/historyEntries";
import { getDecrementRefund, getIncrementCost } from "../lib/progressionCosts";
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

type RuntimeEditableField =
  | "currentHp"
  | "currentMana"
  | "inspiration"
  | "positiveKarma"
  | "negativeKarma";

export type PlayerCharacterPageViewMode = "player" | "dm-readonly" | "dm-editable";

export function PlayerCharacterPage({
  viewMode,
}: {
  viewMode: PlayerCharacterPageViewMode;
}) {
  const { characters, activePlayerCharacter, activeDmCharacter, updateCharacter } = useAppFlow();
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

  const activeSheet = activeCharacter?.sheet ?? null;

  function setSheetState(
    updater: CharacterDraft | ((current: CharacterDraft) => CharacterDraft)
  ): void {
    if (!activeCharacter) {
      return;
    }

    if (isReadOnlyView && !dmEditMode && !adminOverrideMode && !isDmEditableView) {
      return;
    }

    updateCharacter(activeCharacter.id, updater);
  }

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

  if (!activeCharacter || !activeSheet) {
    return (
      <Navigate
        to={isDmEditableView ? "/dm/npc-creator" : isDmReadOnlyView ? "/dm/characters" : "/player"}
        replace
      />
    );
  }

  const sheetState = activeSheet;
  const isSheetEditMode = isEditMode || dmEditMode;
  const isDmRuntimeEditMode = isDmView && dmEditMode;
  const isProgressionEditMode = isEditMode || (isDmEditableView && dmEditMode);
  const actualDate = formatDateDayMonthYear(new Date());
  const {
    derived,
    progression,
    xpLeftOver,
    rollTargets,
    statRollTargets,
    skillRollTargets,
    availablePowerOptions,
  } = buildPlayerCharacterViewModel(sheetState);
  const selectedRollTargets = selectedRollIds
    .map((targetId) => rollTargets.find((target) => target.id === targetId))
    .filter((target): target is PlayerRollTarget => target !== undefined);
  const customRollPool = customRollModifiers.reduce((total, modifier) => total + modifier.value, 0);
  const selectedRollPool =
    selectedRollTargets.reduce((total, target) => total + target.value, 0) + customRollPool;

  function handleAppendHistory(): void {
    const note = sessionNotes.trim();
    if (!note) {
      return;
    }

    const entry = buildGameHistoryNoteEntry(note, sheetState.gameDateTime, new Date());

    setSheetState((currentSheet) => ({
      ...currentSheet,
      gameHistory: prependGameHistoryEntry(currentSheet.gameHistory ?? [], entry),
    }));
    setSessionNotes("");
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

  function adjustStat(statId: StatId, direction: 1 | -1): void {
    const currentLevel = sheetState.statState[statId].base;
    const floorLevel = editSessionStatFloor?.[statId] ?? currentLevel;
    const nextLevel = currentLevel + direction;
    if (nextLevel < floorLevel || nextLevel >= STAT_XP_BY_LEVEL.length) {
      return;
    }

    const xpDelta =
      direction === 1
        ? getIncrementCost(STAT_XP_BY_LEVEL, currentLevel)
        : -getDecrementRefund(STAT_XP_BY_LEVEL, currentLevel);
    if (direction === 1 && xpLeftOver < xpDelta) {
      return;
    }

    setSheetState((currentSheet) => ({
      ...currentSheet,
      xpUsed: currentSheet.xpUsed + xpDelta,
      statState: {
        ...currentSheet.statState,
        [statId]: {
          ...currentSheet.statState[statId],
          base: nextLevel,
        },
      },
    }));
  }

  function adjustSkill(skillId: string, direction: 1 | -1): void {
    const currentSkill = sheetState.skills.find((skill) => skill.id === skillId);
    if (!currentSkill) {
      return;
    }

    const nextLevel = currentSkill.base + direction;
    if (nextLevel < 0 || nextLevel >= T1_SKILL_XP_BY_LEVEL.length) {
      return;
    }

    const xpDelta =
      direction === 1
        ? getIncrementCost(T1_SKILL_XP_BY_LEVEL, currentSkill.base)
        : -getDecrementRefund(T1_SKILL_XP_BY_LEVEL, currentSkill.base);
    if (direction === 1 && xpLeftOver < xpDelta) {
      return;
    }

    setSheetState((currentSheet) => ({
      ...currentSheet,
      xpUsed: currentSheet.xpUsed + xpDelta,
      skills: currentSheet.skills.map((skill) =>
        skill.id === skillId
          ? {
              ...skill,
              base: nextLevel,
            }
          : skill
      ),
    }));
  }

  function adjustPower(powerId: string, direction: 1 | -1): void {
    const currentPower = sheetState.powers.find((power) => power.id === powerId);
    if (!currentPower) {
      return;
    }

    const nextLevel = currentPower.level + direction;
    if (nextLevel < 0 || nextLevel >= T1_POWER_XP_BY_LEVEL.length) {
      return;
    }

    const xpDelta =
      direction === 1
        ? getIncrementCost(T1_POWER_XP_BY_LEVEL, currentPower.level)
        : -getDecrementRefund(T1_POWER_XP_BY_LEVEL, currentPower.level);
    if (direction === 1 && xpLeftOver < xpDelta) {
      return;
    }

    setSheetState((currentSheet) => ({
      ...currentSheet,
      xpUsed: currentSheet.xpUsed + xpDelta,
      powers:
        nextLevel === 0
          ? currentSheet.powers.filter((power) => power.id !== powerId)
          : currentSheet.powers.map((power) =>
              power.id === powerId
                ? {
                    ...power,
                    level: nextLevel,
                  }
                : power
            ),
    }));
  }

  function adjustStatOverride(statId: StatId, direction: 1 | -1): void {
    const reason = requireAdminReason();
    if (!reason) {
      return;
    }

    const stat = sheetState.statState[statId];
    const nextLevel = stat.base + direction;
    if (nextLevel < 0 || nextLevel >= STAT_XP_BY_LEVEL.length) {
      return;
    }

    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        {
          ...currentSheet,
          statState: {
            ...currentSheet.statState,
            [statId]: {
              ...currentSheet.statState[statId],
              base: nextLevel,
            },
          },
        },
        createDmAuditEntry(
          "admin_override",
          `statState.${statId}.base`,
          currentSheet.statState[statId].base,
          nextLevel,
          reason,
          "dm-character-sheet"
        )
      )
    );
  }

  function adjustSkillOverride(skillId: string, direction: 1 | -1): void {
    const reason = requireAdminReason();
    if (!reason) {
      return;
    }

    const currentSkill = sheetState.skills.find((skill) => skill.id === skillId);
    if (!currentSkill) {
      return;
    }

    const nextLevel = currentSkill.base + direction;
    if (nextLevel < 0 || nextLevel >= T1_SKILL_XP_BY_LEVEL.length) {
      return;
    }

    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        {
          ...currentSheet,
          skills: currentSheet.skills.map((skill) =>
            skill.id === skillId
              ? {
                  ...skill,
                  base: nextLevel,
                }
              : skill
          ),
        },
        createDmAuditEntry(
          "admin_override",
          `skills.${skillId}.base`,
          currentSkill.base,
          nextLevel,
          reason,
          "dm-character-sheet"
        )
      )
    );
  }

  function adjustPowerOverride(powerId: string, direction: 1 | -1): void {
    const reason = requireAdminReason();
    if (!reason) {
      return;
    }

    const currentPower = sheetState.powers.find((power) => power.id === powerId);
    if (!currentPower) {
      return;
    }

    const nextLevel = currentPower.level + direction;
    if (nextLevel < 0 || nextLevel >= T1_POWER_XP_BY_LEVEL.length) {
      return;
    }

    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        {
          ...currentSheet,
          powers:
            nextLevel === 0
              ? currentSheet.powers.filter((power) => power.id !== powerId)
              : currentSheet.powers.map((power) =>
                  power.id === powerId
                    ? {
                        ...power,
                        level: nextLevel,
                      }
                    : power
                ),
        },
        createDmAuditEntry(
          "admin_override",
          `powers.${powerId}.level`,
          currentPower.level,
          nextLevel,
          reason,
          "dm-character-sheet"
        )
      )
    );
  }

  function handleAddPowerOverride(): void {
    const reason = requireAdminReason();
    if (!reason) {
      return;
    }

    if (!pendingPowerId) {
      return;
    }

    const template = getPowerTemplate(pendingPowerId);
    if (!template) {
      return;
    }

    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        {
          ...currentSheet,
          powers: [
            ...currentSheet.powers,
            {
              id: template.id,
              name: template.name,
              level: 1,
              governingStat: template.governingStat,
            },
          ],
        },
        createDmAuditEntry(
          "admin_override",
          `powers.${template.id}.level`,
          0,
          1,
          reason,
          "dm-character-sheet"
        )
      )
    );
    setPendingPowerId("");
  }

  function updateInventoryEntry(
    index: number,
    field: "name" | "category" | "note",
    value: string
  ): void {
    setSheetState((currentSheet) => {
      const nextInventory = currentSheet.inventory.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      );

      return appendDmAuditEntry(
        {
          ...currentSheet,
          inventory: nextInventory,
        },
        createDmAuditEntry(
          "sheet",
          `inventory[${index}].${field}`,
          currentSheet.inventory[index]?.[field] ?? "",
          value,
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      );
    });
  }

  function addInventoryEntry(): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        {
          ...currentSheet,
          inventory: [
            ...currentSheet.inventory,
            {
              name: "",
              category: "",
              note: "",
              qualityTier: null,
              hiddenSpec: null,
              revealedSpec: null,
              identified: false,
              identifiedAtAwarenessLevel: null,
            },
          ],
        },
        createDmAuditEntry(
          "sheet",
          "inventory",
          currentSheet.inventory.length,
          currentSheet.inventory.length + 1,
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      )
    );
  }

  function removeInventoryEntry(index: number): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        {
          ...currentSheet,
          inventory: currentSheet.inventory.filter((_, entryIndex) => entryIndex !== index),
        },
        createDmAuditEntry(
          "sheet",
          `inventory[${index}]`,
          currentSheet.inventory[index]?.name ?? "",
          "",
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      )
    );
  }

  function updateEquipmentEntry(
    index: number,
    field: "slot" | "item" | "effect",
    value: string
  ): void {
    setSheetState((currentSheet) => {
      const nextEquipment = currentSheet.equipment.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      );

      return appendDmAuditEntry(
        {
          ...currentSheet,
          equipment: nextEquipment,
        },
        createDmAuditEntry(
          "sheet",
          `equipment[${index}].${field}`,
          currentSheet.equipment[index]?.[field] ?? "",
          value,
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      );
    });
  }

  function addEquipmentEntry(): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        {
          ...currentSheet,
          equipment: [
            ...currentSheet.equipment,
            {
              slot: "",
              item: "",
              effect: "",
              qualityTier: null,
              hiddenSpec: null,
              revealedSpec: null,
              identified: false,
              identifiedAtAwarenessLevel: null,
            },
          ],
        },
        createDmAuditEntry(
          "sheet",
          "equipment",
          currentSheet.equipment.length,
          currentSheet.equipment.length + 1,
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      )
    );
  }

  function removeEquipmentEntry(index: number): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        {
          ...currentSheet,
          equipment: currentSheet.equipment.filter((_, entryIndex) => entryIndex !== index),
        },
        createDmAuditEntry(
          "sheet",
          `equipment[${index}]`,
          currentSheet.equipment[index]?.slot ?? "",
          "",
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      )
    );
  }

  function handleAddPower(): void {
    if (!pendingPowerId) {
      return;
    }

    const template = getPowerTemplate(pendingPowerId);
    const levelOneCost = getIncrementCost(T1_POWER_XP_BY_LEVEL, 0);
    if (!template || xpLeftOver < levelOneCost) {
      return;
    }

    setSheetState((currentSheet) => ({
      ...currentSheet,
      xpUsed: currentSheet.xpUsed + levelOneCost,
      powers: [
        ...currentSheet.powers,
        {
          id: template.id,
          name: template.name,
          level: 1,
          governingStat: template.governingStat,
        },
      ],
    }));
    setPendingPowerId("");
  }

  function createDmAuditEntry(
    editLayer: "runtime" | "sheet" | "admin_override",
    fieldPath: string,
    beforeValue: unknown,
    afterValue: unknown,
    reason: string,
    sourceScreen: string
  ) {
    if (!activeCharacter) {
      return null;
    }

    return createDmAuditLogEntry({
      characterId: activeCharacter.id,
      targetOwnerRole: activeCharacter.ownerRole,
      editLayer,
      fieldPath,
      beforeValue,
      afterValue,
      reason,
      sourceScreen,
    });
  }

  function requireAdminReason(): string | null {
    const reason = adminOverrideReason.trim();
    if (!reason) {
      setAdminOverrideError("Admin override requires a reason.");
      return null;
    }

    setAdminOverrideError(null);
    return reason;
  }

  function appendDmAuditEntry(
    sheet: CharacterDraft,
    entry: ReturnType<typeof createDmAuditEntry>
  ): CharacterDraft {
    return appendDmAuditEntryToSheet(sheet, entry);
  }

  function updateRuntimeField(field: RuntimeEditableField, rawValue: number): void {
    if (!isDmView) {
      return;
    }

    setSheetState((currentSheet) => {
      const nextBaseValue =
        field === "currentHp" ? Math.trunc(rawValue) : Math.max(0, Math.trunc(rawValue));
      const derivedSnapshot = buildCharacterDerivedValues(currentSheet);
      const currentValue =
        field === "currentMana" ? derivedSnapshot.currentMana : currentSheet[field];
      const maxValue =
        field === "currentHp"
          ? null
          : field === "currentMana"
            ? derivedSnapshot.maxMana
            : null;
      const nextValue = maxValue === null ? nextBaseValue : Math.min(nextBaseValue, maxValue);

      if (nextValue === currentValue) {
        return currentSheet;
      }

      return appendDmAuditEntry(
        {
          ...currentSheet,
          [field]: nextValue,
          ...(field === "currentMana" ? { manaInitialized: true } : null),
        },
        createDmAuditEntry(
          "runtime",
          field,
          currentValue,
          nextValue,
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      );
    });
  }

  function handleRuntimeInput(field: RuntimeEditableField, value: string): void {
    if (value.trim() === "") {
      return;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return;
    }

    updateRuntimeField(field, parsed);
  }

  function updateSheetField<K extends keyof CharacterDraft>(
    field: K,
    value: CharacterDraft[K]
  ): void {
    setSheetState((currentSheet) => {
      const shouldLog = isDmView && (dmEditMode || adminOverrideMode || isDmEditableView);
      const nextSheet = {
        ...currentSheet,
        [field]: value,
      };

      if (!shouldLog) {
        return nextSheet;
      }

      return appendDmAuditEntry(
        nextSheet,
        createDmAuditEntry(
          adminOverrideMode ? "admin_override" : "sheet",
          String(field),
          currentSheet[field],
          value,
          adminOverrideMode ? adminOverrideReason.trim() : dmEditReason.trim(),
          "dm-character-sheet"
        )
      );
    });
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
          onUpdateField={updateSheetField}
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
            onUpdateField={updateSheetField}
          />

          <CharacterResources
            sheetState={sheetState}
            derived={derived}
            isDmRuntimeEditMode={isDmRuntimeEditMode}
            onRuntimeInput={handleRuntimeInput}
          />

          <CharacterCombatSummary
            sheetState={sheetState}
            derived={derived}
            isDmRuntimeEditMode={isDmRuntimeEditMode}
            onRuntimeInput={handleRuntimeInput}
          />

          <CharacterStatsSection
            sheetState={sheetState}
            isProgressionEditMode={isProgressionEditMode}
            adminOverrideMode={adminOverrideMode}
            editSessionStatFloor={editSessionStatFloor}
            xpLeftOver={xpLeftOver}
            onAdjustStat={adjustStat}
            onAdjustStatOverride={adjustStatOverride}
          />

          <CharacterSkillsSection
            sheetState={sheetState}
            isProgressionEditMode={isProgressionEditMode}
            adminOverrideMode={adminOverrideMode}
            xpLeftOver={xpLeftOver}
            onAdjustSkill={adjustSkill}
            onAdjustSkillOverride={adjustSkillOverride}
          />

          <CharacterPowersSection
            sheetState={sheetState}
            availablePowerOptions={availablePowerOptions}
            pendingPowerId={pendingPowerId}
            xpLeftOver={xpLeftOver}
            isProgressionEditMode={isProgressionEditMode}
            adminOverrideMode={adminOverrideMode}
            onPendingPowerIdChange={setPendingPowerId}
            onAddPower={handleAddPower}
            onAddPowerOverride={handleAddPowerOverride}
            onAdjustPower={adjustPower}
            onAdjustPowerOverride={adjustPowerOverride}
          />

          <CharacterInventorySection
            sheetState={sheetState}
            isSheetEditMode={isSheetEditMode}
            onUpdateEquipmentEntry={updateEquipmentEntry}
            onAddEquipmentEntry={addEquipmentEntry}
            onRemoveEquipmentEntry={removeEquipmentEntry}
            onUpdateInventoryEntry={updateInventoryEntry}
            onAddInventoryEntry={addInventoryEntry}
            onRemoveInventoryEntry={removeInventoryEntry}
            onUpdateMoney={(value) => updateSheetField("money", value)}
          />

          <CharacterHistorySection
            sessionNotes={sessionNotes}
            isReadOnlyView={isReadOnlyView}
            gameHistory={sheetState.gameHistory}
            onSessionNotesChange={setSessionNotes}
            onAppendHistory={handleAppendHistory}
          />
        </section>
      </section>
    </main>
  );
}


