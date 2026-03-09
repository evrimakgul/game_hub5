import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { resolveDicePool } from "../config/combat";
import {
  buildCharacterDerivedValues,
  getCurrentSkillValue,
  getSkillBreakdown,
  getStatBreakdown,
} from "../config/characterRuntime";
import {
  DAMAGE_TYPES,
  RESISTANCE_LEVELS,
} from "../config/resistances";
import {
  getPowerBenefits,
  getPowerTemplate,
  powerLibrary,
  statGroups,
  type CharacterDraft,
  type StatId,
} from "../config/characterTemplate";
import {
  getCrAndRankFromXpUsed,
  STAT_XP_BY_LEVEL,
  T1_POWER_XP_BY_LEVEL,
  T1_SKILL_XP_BY_LEVEL,
} from "../config/xpTables";
import { useAppFlow } from "../state/appFlow";

type HistoryEntry = {
  id: number;
  actualDateTime: string;
  gameDateTime: string;
  note: string;
};

type RollTarget = {
  id: string;
  label: string;
  value: number;
  category: "stat" | "skill";
};

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

function formatDateDayMonthYear(date: Date): string {
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatTimeHoursMinutes(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getIncrementCost(table: number[], currentLevel: number): number {
  if (currentLevel >= table.length - 1) {
    return 0;
  }

  return table[currentLevel + 1] - table[currentLevel];
}

function getDecrementRefund(table: number[], currentLevel: number): number {
  if (currentLevel <= 0) {
    return 0;
  }

  return table[currentLevel] - table[currentLevel - 1];
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
      <path d="M12 18h40M6 40h52M20 58l12-54 12 54" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
        10
      </text>
    </svg>
  );
}

export function PlayerCharacterPage() {
  const { characters, activePlayerCharacter, activeDmCharacter, updateCharacter } = useAppFlow();
  const navigate = useNavigate();
  const location = useLocation();
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
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

  const dragRef = useRef<{ active: boolean; moved: boolean; offsetX: number; offsetY: number }>({
    active: false,
    moved: false,
    offsetX: 0,
    offsetY: 0,
  });
  const isDmReadOnlyView = location.pathname.startsWith("/dm/character");
  const isDmEditableView = location.pathname.startsWith("/dm/npc-character");
  const isDmView = isDmReadOnlyView || isDmEditableView;
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
    setHistoryEntries([]);
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
    setEditSessionStatFloor(null);
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

  const actualDate = formatDateDayMonthYear(new Date());
  const xpLeftOver = sheetState.xpEarned - sheetState.xpUsed;
  const progression = getCrAndRankFromXpUsed(sheetState.xpUsed);

  const derived = buildCharacterDerivedValues(sheetState);
  const currentStats = derived.currentStats;

  const rollTargets: RollTarget[] = [
    ...statGroups.flatMap((group) =>
      group.ids.map((statId) => ({
        id: `stat:${statId}`,
        label: statId,
        value: currentStats[statId],
        category: "stat" as const,
      }))
    ),
    ...sheetState.skills.map((skill) => ({
        id: `skill:${skill.id}`,
        label: skill.label,
        value: getCurrentSkillValue(sheetState, skill.id),
        category: "skill" as const,
      })),
  ];

  const statRollTargets = rollTargets.filter((target) => target.category === "stat");
  const skillRollTargets = rollTargets.filter((target) => target.category === "skill");

  const selectedRollTargets = selectedRollIds
    .map((targetId) => rollTargets.find((target) => target.id === targetId))
    .filter((target): target is RollTarget => target !== undefined);
  const customRollPool = customRollModifiers.reduce((total, modifier) => total + modifier.value, 0);
  const selectedRollPool = selectedRollTargets.reduce((total, target) => total + target.value, 0) + customRollPool;

  const availablePowerOptions = powerLibrary.filter(
    (power) => !sheetState.powers.some((knownPower) => knownPower.id === power.id)
  );

  function handleAppendHistory(): void {
    const note = sessionNotes.trim();
    if (!note) {
      return;
    }

    const now = new Date();

    setHistoryEntries((entries) => [
      {
        id: entries.length + 1,
        actualDateTime: `${formatDateDayMonthYear(now)} - ${formatTimeHoursMinutes(now)}`,
        gameDateTime: sheetState.gameDateTime,
        note,
      },
      ...entries,
    ]);
    setSessionNotes("");
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
        ...customRollModifiers.map((modifier) => `Custom ${modifier.value >= 0 ? "+" : ""}${modifier.value}`),
      ],
      poolSize: selectedRollPool,
      faces,
      successes: resolution.successes,
      isBotch: resolution.isBotch,
    });
  }

  function adjustStat(statId: StatId, direction: 1 | -1): void {
    const currentLevel = sheetState.statState[statId].base;
    const floorLevel = editSessionStatFloor?.[statId] ?? currentLevel;
    const nextLevel = currentLevel + direction;
    if (nextLevel < floorLevel || nextLevel >= STAT_XP_BY_LEVEL.length) {
      return;
    }

    const xpDelta =
      direction === 1 ? getIncrementCost(STAT_XP_BY_LEVEL, currentLevel) : -getDecrementRefund(STAT_XP_BY_LEVEL, currentLevel);
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
            { name: "", category: "", note: "" },
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
            { slot: "", item: "", effect: "" },
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

    return {
      id: `dm-edit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      characterId: activeCharacter.id,
      targetOwnerRole: activeCharacter.ownerRole,
      editLayer,
      fieldPath,
      beforeValue: String(beforeValue ?? ""),
      afterValue: String(afterValue ?? ""),
      reason,
      sourceScreen,
    };
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
    if (!entry) {
      return sheet;
    }

    return {
      ...sheet,
      dmAuditLog: [...(sheet.dmAuditLog ?? []), entry],
    };
  }

  function updateRuntimeField(field: RuntimeEditableField, rawValue: number): void {
    if (!isDmView) {
      return;
    }

    setSheetState((currentSheet) => {
      const nextBaseValue = Math.max(0, Math.trunc(rawValue));
      const derivedSnapshot = buildCharacterDerivedValues(currentSheet);
      const currentValue =
        field === "currentMana" ? derivedSnapshot.currentMana : currentSheet[field];
      const maxValue =
        field === "currentHp"
          ? derivedSnapshot.maxHp
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

    setEditSessionStatFloor({
      STR: sheetState.statState.STR.base,
      DEX: sheetState.statState.DEX.base,
      STAM: sheetState.statState.STAM.base,
      CHA: sheetState.statState.CHA.base,
      APP: sheetState.statState.APP.base,
      MAN: sheetState.statState.MAN.base,
      INT: sheetState.statState.INT.base,
      WITS: sheetState.statState.WITS.base,
      PER: sheetState.statState.PER.base,
    });
    setIsEditMode(true);
  }

  function handleToggleDmEditMode(): void {
    if (!isDmView) {
      return;
    }

    setAdminOverrideMode(false);
    setAdminOverrideError(null);
    setDmEditMode((current) => !current);
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
      <button
        type="button"
        className="floating-dice"
        style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y}px` }}
        onMouseDown={handleDiceMouseDown}
        onClick={handleDiceClick}
        aria-label="Open roll helper"
      >
        <D10Icon />
        <span className="sr-only">Open roll helper</span>
      </button>

      {isDiceOpen ? (
        <aside
          className="dice-popover"
          style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y + 72}px` }}
        >
          <div className="dice-popover-head">
            <D10Icon />
            <p className="section-kicker">Roll Helper</p>
          </div>
          <h2>Dice Pool</h2>
          <div className="dice-summary">
            <span>Selected</span>
            <strong>
              {selectedRollTargets.length > 0 || customRollModifiers.length > 0
                ? [
                    ...selectedRollTargets.map((target) => target.label),
                    ...customRollModifiers.map((modifier) => `Custom ${modifier.value >= 0 ? "+" : ""}${modifier.value}`),
                  ].join(" + ")
                : "None"}
            </strong>
          </div>
          <div className="dice-summary">
            <span>Pool</span>
            <strong>{selectedRollPool}</strong>
          </div>
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
                    inputMode="numeric"
                    value={customRollInput}
                    onChange={(event) => setCustomRollInput(event.target.value)}
                    placeholder="+2"
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
            <button type="button" onClick={handleRoll} disabled={selectedRollTargets.length === 0 && customRollModifiers.length === 0}>
              Roll
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedRollIds([]);
                setCustomRollModifiers([]);
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
        </aside>
      ) : null}

      <section className="sheet-frame">
        <div className="sheet-top-nav">
          <button type="button" className="sheet-nav-button" onClick={() => navigate("/")}>
            Main Menu
          </button>
          <button
            type="button"
            className="sheet-nav-button"
            onClick={() =>
              navigate(
                isDmEditableView
                  ? "/dm/npc-creator"
                  : isDmReadOnlyView
                    ? "/dm/characters"
                    : "/player"
              )
            }
          >
            {isDmEditableView
              ? "NPC Creator"
              : isDmReadOnlyView
                ? "Player Characters"
                : "Player Menu"}
          </button>
        </div>

        <header className="sheet-header">
          <div className="sheet-header-copy">
            <p className="sheet-kicker">Convergence Character Sheet Draft</p>
            {isSheetEditMode ? (
              <div className="identity-edit-stack">
                <input
                  className="sheet-name-input"
                  value={sheetState.name}
                  onChange={(event) => updateSheetField("name", event.target.value)}
                  placeholder="Character Name"
                />
                <div className="identity-edit-row">
                  <input
                    className="sheet-meta-input"
                    value={sheetState.concept}
                    onChange={(event) => updateSheetField("concept", event.target.value)}
                    placeholder="Concept"
                  />
                  <input
                    className="sheet-meta-input"
                    value={sheetState.faction}
                    onChange={(event) => updateSheetField("faction", event.target.value)}
                    placeholder="Faction"
                  />
                </div>
              </div>
            ) : (
              <>
                <h1>{sheetState.name.trim() || "Unnamed Character"}</h1>
                <p className="sheet-concept">
                  {sheetState.concept || "No concept"} | {sheetState.faction || "No faction"}
                </p>
              </>
            )}
          </div>

          <div className="sheet-badges">
            <div>
              <span>Rank</span>
              <strong>{progression.rank}</strong>
            </div>
            <div>
              <span>CR</span>
              <strong>{progression.cr}</strong>
            </div>
            <div>
              <span>Age</span>
              {isSheetEditMode ? (
                <input
                  className="badge-input"
                  type="number"
                  min="0"
                  value={sheetState.age ?? ""}
                  onChange={(event) =>
                    updateSheetField(
                      "age",
                      event.target.value === "" ? null : Number.parseInt(event.target.value, 10)
                    )
                  }
                  placeholder="Age"
                />
              ) : (
                <strong>{sheetState.age ?? "-"}</strong>
              )}
            </div>
          </div>
        </header>

        <section className="sheet-banner">
          <div className="banner-date-block">
            <div>
              <span>Actual Date</span>
              <strong>{actualDate}</strong>
            </div>
            <div>
              <span>Game Date-Time</span>
              <strong>{sheetState.gameDateTime}</strong>
            </div>
          </div>
          <div>
            <span>XP Block</span>
            <div className="xp-block-grid">
              <span>Earned</span>
              <span>Used</span>
              <span>Left-Over</span>
              <strong>{sheetState.xpEarned}</strong>
              <strong>{sheetState.xpUsed}</strong>
              <strong>{xpLeftOver}</strong>
            </div>
          </div>
          <div className="edit-card">
            <span>Edit Sheet</span>
            {isDmView ? (
              <div className="dm-edit-controls">
                <div className="dm-edit-toggle-row">
                  <button type="button" onClick={handleToggleDmEditMode}>
                    {dmEditMode ? "DM Edit: On" : "DM Edit: Off"}
                  </button>
                  <button type="button" onClick={handleToggleAdminOverrideMode}>
                    {adminOverrideMode ? "Override: On" : "Override: Off"}
                  </button>
                </div>
                <div className="dm-edit-reasons">
                  {dmEditMode ? (
                    <input
                      className="sheet-meta-input"
                      value={dmEditReason}
                      onChange={(event) => setDmEditReason(event.target.value)}
                      placeholder="DM reason (optional)"
                    />
                  ) : null}
                  {adminOverrideMode ? (
                    <>
                      <input
                        className="sheet-meta-input"
                        value={adminOverrideReason}
                        onChange={(event) => setAdminOverrideReason(event.target.value)}
                        placeholder="Admin reason (required)"
                      />
                      {adminOverrideError ? (
                        <strong className="edit-mode-indicator">{adminOverrideError}</strong>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <button type="button" className="edit-trigger" onClick={handleToggleEditMode}>
                {isEditMode ? "Lock" : "Edit"}
              </button>
            )}
          </div>
        </section>

        <section className="sheet-grid">
          <article className="sheet-card biography-card">
            <p className="section-kicker">Identity</p>
            <h2>Biography</h2>
            {isSheetEditMode ? (
              <div className="bio-edit-stack">
                <textarea
                  className="bio-edit-input"
                  value={sheetState.biographyPrimary}
                  onChange={(event) => updateSheetField("biographyPrimary", event.target.value)}
                  placeholder="Primary bio"
                />
                <textarea
                  className="bio-edit-input"
                  value={sheetState.biographySecondary}
                  onChange={(event) => updateSheetField("biographySecondary", event.target.value)}
                  placeholder="Secondary bio"
                />
              </div>
            ) : (
              <>
                <p>{sheetState.biographyPrimary || "No primary biography yet."}</p>
                <p>{sheetState.biographySecondary || "No secondary biography yet."}</p>
              </>
            )}
          </article>

          <article className="sheet-card resource-card">
            <p className="section-kicker">Stored State</p>
            <h2>Resources</h2>
            <div className="resource-strip">
              <div>
                <span>Inspiration</span>
                {isDmRuntimeEditMode ? (
                  <input
                    className="sheet-runtime-input"
                    type="number"
                    min="0"
                    value={sheetState.inspiration}
                    onChange={(event) => handleRuntimeInput("inspiration", event.target.value)}
                  />
                ) : (
                  <strong>{sheetState.inspiration}</strong>
                )}
              </div>
              <div>
                <span>Karma</span>
                {isDmRuntimeEditMode ? (
                  <div className="runtime-split-inputs">
                    <input
                      className="sheet-runtime-input"
                      type="number"
                      min="0"
                      value={sheetState.negativeKarma}
                      onChange={(event) => handleRuntimeInput("negativeKarma", event.target.value)}
                    />
                    <input
                      className="sheet-runtime-input"
                      type="number"
                      min="0"
                      value={sheetState.positiveKarma}
                      onChange={(event) => handleRuntimeInput("positiveKarma", event.target.value)}
                    />
                  </div>
                ) : (
                  <strong>
                    -{sheetState.negativeKarma} / +{sheetState.positiveKarma}
                  </strong>
                )}
              </div>
            </div>
          </article>

          <article className="sheet-card status-card">
            <p className="section-kicker">Combat Flags</p>
            <h2>Resistances</h2>
            <div className="resistance-grid">
              {DAMAGE_TYPES.map((damageType) => {
                const level = sheetState.resistances[damageType.id];
                const rule = RESISTANCE_LEVELS[level];

                return (
                  <div key={damageType.id} className="resistance-entry">
                    <span>{damageType.label}</span>
                    <strong>{rule.label}</strong>
                    <small>(x{rule.damageMultiplier})</small>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="sheet-card combat-card">
            <p className="section-kicker">Derived Summary</p>
            <h2>Combat Summary</h2>
            <div className="combat-grid">
              <div>
                <span>HP</span>
                {isDmRuntimeEditMode ? (
                  <input
                    className="sheet-runtime-input"
                    type="number"
                    min="0"
                    max={derived.maxHp}
                    value={sheetState.currentHp}
                    onChange={(event) => handleRuntimeInput("currentHp", event.target.value)}
                  />
                ) : (
                  <strong>
                    {sheetState.currentHp} / {derived.maxHp}
                  </strong>
                )}
              </div>
              <div>
                <span>Mana</span>
                {isDmRuntimeEditMode ? (
                  <input
                    className="sheet-runtime-input"
                    type="number"
                    min="0"
                    max={derived.maxMana}
                    value={derived.currentMana}
                    onChange={(event) => handleRuntimeInput("currentMana", event.target.value)}
                  />
                ) : (
                  <strong>
                    {derived.currentMana} / {derived.maxMana}
                  </strong>
                )}
              </div>
              <div>
                <span>Initiative</span>
                <strong>{derived.initiative}</strong>
              </div>
              <div>
                <span>Movement</span>
                <strong>{derived.movement}</strong>
              </div>
              <div>
                <span>AC</span>
                <strong>{derived.armorClass}</strong>
              </div>
              <div>
                <span>DR</span>
                <strong>{derived.damageReduction}</strong>
              </div>
              <div>
                <span>Soak</span>
                <strong>{derived.soak}</strong>
              </div>
              <div>
                <span>Melee Attack</span>
                <strong>{derived.meleeAttack}</strong>
              </div>
              <div>
                <span>Ranged Attack</span>
                <strong>{derived.rangedAttack}</strong>
              </div>
              <div>
                <span>Melee Damage</span>
                <strong>{derived.meleeDamage}</strong>
              </div>
              <div>
                <span>Ranged Damage</span>
                <strong>{derived.rangedDamage}</strong>
              </div>
            </div>
            {derived.activePowerEffects.length > 0 ? (
              <div className="active-effects-panel">
                <p className="section-kicker">Active Effects</p>
                <div className="active-effects-list">
                  {derived.activePowerEffects.map((effect) => (
                    <article key={effect.id} className="active-effect-card">
                      <strong>{effect.label}</strong>
                      <small>{effect.summary}</small>
                      <small>
                        {effect.casterName} {"->"} {effect.powerName}
                      </small>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </article>

          <article className="sheet-card stat-card">
            <p className="section-kicker">Core Build</p>
            <h2>Stats</h2>
            <div className="stat-groups">
              {statGroups.map((group) => (
                <section key={group.title} className={`stat-group stat-group-${group.accent}`}>
                  <header>
                    <h3>{group.title}</h3>
                  </header>
                  <div className="stat-list">
                    {group.ids.map((statId) => {
                      const stat = sheetState.statState[statId];
                      const breakdown = getStatBreakdown(sheetState, statId);
                      const incrementCost = getIncrementCost(STAT_XP_BY_LEVEL, stat.base);
                      const canIncrease = adminOverrideMode
                        ? stat.base < STAT_XP_BY_LEVEL.length - 1
                        : isEditMode &&
                          stat.base < STAT_XP_BY_LEVEL.length - 1 &&
                          xpLeftOver >= incrementCost;
                      const floorLevel = editSessionStatFloor?.[statId] ?? stat.base;
                      const canDecrease = adminOverrideMode
                        ? stat.base > 0
                        : isEditMode && stat.base > floorLevel;

                      return (
                        <div key={statId} className="stat-row">
                          <div className="row-main">
                            <strong>{statId}</strong>
                            <small>{breakdown.detail}</small>
                          </div>
                          {isEditMode || adminOverrideMode ? (
                            <div className="row-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  adminOverrideMode
                                    ? adjustStatOverride(statId, -1)
                                    : adjustStat(statId, -1)
                                }
                                disabled={!canDecrease}
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  adminOverrideMode
                                    ? adjustStatOverride(statId, 1)
                                    : adjustStat(statId, 1)
                                }
                                disabled={!canIncrease}
                              >
                                +
                              </button>
                            </div>
                          ) : null}
                          <div className="row-side">
                            <span>{breakdown.summary}</span>
                            <em>{breakdown.value}</em>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <article className="sheet-card skill-card">
            <p className="section-kicker">Roll Inputs</p>
            <h2>Skills</h2>
            <div className="skill-table">
              {sheetState.skills.map((skill) => {
                const breakdown = getSkillBreakdown(sheetState, skill.id);
                const incrementCost = getIncrementCost(T1_SKILL_XP_BY_LEVEL, skill.base);
                const canIncrease = adminOverrideMode
                  ? skill.base < T1_SKILL_XP_BY_LEVEL.length - 1
                  : isEditMode &&
                    skill.base < T1_SKILL_XP_BY_LEVEL.length - 1 &&
                    xpLeftOver >= incrementCost;
                const canDecrease = adminOverrideMode
                  ? skill.base > 0
                  : isEditMode && skill.base > 0;

                return (
                  <div key={skill.id} className="skill-row">
                    <div className="row-main">
                      <strong>{skill.label}</strong>
                      <small>{breakdown.detail}</small>
                    </div>
                    {isEditMode || adminOverrideMode ? (
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() =>
                            adminOverrideMode
                              ? adjustSkillOverride(skill.id, -1)
                              : adjustSkill(skill.id, -1)
                          }
                          disabled={!canDecrease}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            adminOverrideMode
                              ? adjustSkillOverride(skill.id, 1)
                              : adjustSkill(skill.id, 1)
                          }
                          disabled={!canIncrease}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                    <div className="row-side">
                      <span>{breakdown.summary}</span>
                      <em>{breakdown.value}</em>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="sheet-card power-card">
            <p className="section-kicker">T1 Powers</p>
            <h2>Known Powers</h2>
            {isEditMode || adminOverrideMode ? (
              <div className="power-add-row">
                <select value={pendingPowerId} onChange={(event) => setPendingPowerId(event.target.value)}>
                  <option value="">Add Level 1 Power</option>
                  {availablePowerOptions.map((power) => (
                    <option key={power.id} value={power.id}>
                      {power.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={adminOverrideMode ? handleAddPowerOverride : handleAddPower}
                  disabled={
                    !pendingPowerId ||
                    (!adminOverrideMode && xpLeftOver < getIncrementCost(T1_POWER_XP_BY_LEVEL, 0))
                  }
                >
                  Add
                </button>
              </div>
            ) : null}
            <div className="power-list">
              {sheetState.powers.length === 0 ? (
                <p className="empty-block-copy">No powers learned yet.</p>
              ) : sheetState.powers.map((power) => {
                const incrementCost = getIncrementCost(T1_POWER_XP_BY_LEVEL, power.level);
                const canIncrease = adminOverrideMode
                  ? power.level < T1_POWER_XP_BY_LEVEL.length - 1
                  : isEditMode &&
                    power.level < T1_POWER_XP_BY_LEVEL.length - 1 &&
                    xpLeftOver >= incrementCost;
                const canDecrease = adminOverrideMode
                  ? power.level > 0
                  : isEditMode && power.level > 0;

                return (
                  <div key={power.id} className="power-row">
                    <div className="row-main">
                      <strong>
                        {power.name} Lv {power.level}
                      </strong>
                      <ul className="power-benefits">
                        {getPowerBenefits(power.id, power.level).map((benefit) => (
                          <li key={benefit}>{benefit}</li>
                        ))}
                      </ul>
                    </div>
                    {isEditMode || adminOverrideMode ? (
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() =>
                            adminOverrideMode
                              ? adjustPowerOverride(power.id, -1)
                              : adjustPower(power.id, -1)
                          }
                          disabled={!canDecrease}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            adminOverrideMode
                              ? adjustPowerOverride(power.id, 1)
                              : adjustPower(power.id, 1)
                          }
                          disabled={!canIncrease}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                    <div className="row-side">
                      <span>Base {power.level}</span>
                      <em>{power.governingStat}</em>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="sheet-card equipment-card">
            <p className="section-kicker">Equipment</p>
            <h2>Loadout</h2>
            <div className="equipment-list">
              {isSheetEditMode ? (
                <>
                  {sheetState.equipment.map((entry, index) => (
                    <div key={`${entry.slot}-${index}`} className="equipment-row">
                      <div className="row-main">
                        <input
                          className="sheet-meta-input"
                          value={entry.slot}
                          onChange={(event) => updateEquipmentEntry(index, "slot", event.target.value)}
                          placeholder="Slot"
                        />
                        <input
                          className="sheet-meta-input"
                          value={entry.item}
                          onChange={(event) => updateEquipmentEntry(index, "item", event.target.value)}
                          placeholder="Item"
                        />
                        <input
                          className="sheet-meta-input"
                          value={entry.effect}
                          onChange={(event) => updateEquipmentEntry(index, "effect", event.target.value)}
                          placeholder="Effect"
                        />
                      </div>
                      <div className="row-actions">
                        <button type="button" onClick={() => removeEquipmentEntry(index)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="flow-secondary" onClick={addEquipmentEntry}>
                    Add Equipment
                  </button>
                </>
              ) : sheetState.equipment.length === 0 ? (
                <p className="empty-block-copy">No loadout equipped.</p>
              ) : (
                sheetState.equipment.map((entry) => (
                  <div key={entry.slot} className="equipment-row">
                    <div>
                      <strong>{entry.slot}</strong>
                      <span>{entry.item}</span>
                    </div>
                    <em>{entry.effect}</em>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="sheet-card inventory-card">
            <p className="section-kicker">Owned Items</p>
            <h2>Inventory</h2>
            <div className="inventory-header">
              <span>Money</span>
              {isSheetEditMode ? (
                <input
                  className="badge-input"
                  type="number"
                  value={sheetState.money}
                  onChange={(event) =>
                    updateSheetField(
                      "money",
                      event.target.value === "" ? 0 : Number.parseInt(event.target.value, 10)
                    )
                  }
                />
              ) : (
                <strong>{sheetState.money}</strong>
              )}
            </div>
            <div className="inventory-list">
              {isSheetEditMode ? (
                <>
                  {sheetState.inventory.map((entry, index) => (
                    <div key={`${entry.name}-${index}`} className="inventory-row">
                      <div className="row-main">
                        <input
                          className="sheet-meta-input"
                          value={entry.name}
                          onChange={(event) => updateInventoryEntry(index, "name", event.target.value)}
                          placeholder="Item name"
                        />
                        <input
                          className="sheet-meta-input"
                          value={entry.category}
                          onChange={(event) => updateInventoryEntry(index, "category", event.target.value)}
                          placeholder="Category"
                        />
                        <input
                          className="sheet-meta-input"
                          value={entry.note}
                          onChange={(event) => updateInventoryEntry(index, "note", event.target.value)}
                          placeholder="Notes"
                        />
                      </div>
                      <div className="row-actions">
                        <button type="button" onClick={() => removeInventoryEntry(index)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="flow-secondary" onClick={addInventoryEntry}>
                    Add Item
                  </button>
                </>
              ) : sheetState.inventory.length === 0 ? (
                <p className="empty-block-copy">No items in inventory.</p>
              ) : (
                sheetState.inventory.map((entry) => (
                  <div key={entry.name} className="inventory-row">
                    <div>
                      <strong>{entry.name}</strong>
                      <span>{entry.category}</span>
                    </div>
                    <em>{entry.note}</em>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="sheet-card notes-card">
            <p className="section-kicker">Sheet Notes</p>
            <h2>Session Notes</h2>
            <textarea
              className="notes-input"
              value={sessionNotes}
              onChange={(event) => setSessionNotes(event.target.value)}
              readOnly={isReadOnlyView}
            />
            {!isReadOnlyView ? (
              <button type="button" className="notes-submit" onClick={handleAppendHistory}>
                Add To Game History
              </button>
            ) : null}
          </article>

          <article className="sheet-card history-card">
            <p className="section-kicker">Session Log</p>
            <h2>Game History</h2>
            {historyEntries.length === 0 ? (
              <p className="history-empty">No submitted game history yet.</p>
            ) : (
              <div className="history-list">
                {historyEntries.map((entry) => (
                  <section key={entry.id} className="history-entry">
                    <strong>
                      {entry.actualDateTime} / {entry.gameDateTime}
                    </strong>
                    <p>{entry.note}</p>
                  </section>
                ))}
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
