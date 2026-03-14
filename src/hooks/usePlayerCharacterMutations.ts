import type { Dispatch, SetStateAction } from "react";

import { buildCharacterDerivedValues } from "../config/characterRuntime";
import { resetCharacterPowerUsageScope } from "../lib/powerUsage";
import {
  type CharacterDraft,
  getPowerTemplate,
} from "../config/characterTemplate";
import {
  appendDmAuditEntry as appendDmAuditEntryToSheet,
  createDmAuditEntry as createDmAuditLogEntry,
} from "../lib/dmAudit";
import {
  addEquipmentEntry,
  addInventoryEntry,
  addPowerAtLevelOne,
  addPowerAtLevelOneOverride,
  adjustPowerProgression,
  adjustSkillProgression,
  adjustStatProgression,
  appendHistoryNote,
  removeEquipmentEntry,
  removeInventoryEntry,
  setPowerLevel,
  setSkillBaseLevel,
  setStatBaseLevel,
  type EquipmentEntryField,
  type InventoryEntryField,
  type RuntimeEditableField,
  updateEquipmentEntryField,
  updateInventoryEntryField,
  updateRuntimeFieldValue,
  updateSheetFieldValue,
} from "../mutations/characterSheetMutations";
import type { CharacterRecord, StatId } from "../types/character";
import type { PowerUsageResetScope } from "../types/powerUsage";

type CharacterSheetUpdater =
  | CharacterDraft
  | ((current: CharacterDraft) => CharacterDraft);

type UsePlayerCharacterMutationsParams = {
  activeCharacter: CharacterRecord | null;
  sheetState: CharacterDraft;
  xpLeftOver: number;
  isReadOnlyView: boolean;
  isDmView: boolean;
  isDmEditableView: boolean;
  dmEditMode: boolean;
  adminOverrideMode: boolean;
  dmEditReason: string;
  adminOverrideReason: string;
  editSessionStatFloor: Record<StatId, number> | null;
  pendingPowerId: string;
  sessionNotes: string;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
  setPendingPowerId: Dispatch<SetStateAction<string>>;
  setSessionNotes: Dispatch<SetStateAction<string>>;
  setAdminOverrideError: Dispatch<SetStateAction<string | null>>;
};

export type PlayerCharacterMutations = {
  handleAppendHistory: () => void;
  adjustStat: (statId: StatId, direction: 1 | -1) => void;
  adjustSkill: (skillId: string, direction: 1 | -1) => void;
  adjustPower: (powerId: string, direction: 1 | -1) => void;
  adjustStatOverride: (statId: StatId, direction: 1 | -1) => void;
  adjustSkillOverride: (skillId: string, direction: 1 | -1) => void;
  adjustPowerOverride: (powerId: string, direction: 1 | -1) => void;
  handleAddPowerOverride: () => void;
  updateInventoryEntry: (index: number, field: InventoryEntryField, value: string) => void;
  addInventoryEntry: () => void;
  removeInventoryEntry: (index: number) => void;
  updateEquipmentEntry: (index: number, field: EquipmentEntryField, value: string) => void;
  addEquipmentEntry: () => void;
  removeEquipmentEntry: (index: number) => void;
  handleAddPower: () => void;
  resetPowerUsage: (scope: PowerUsageResetScope) => void;
  handleRuntimeInput: (field: RuntimeEditableField, value: string) => void;
  updateSheetField: <K extends keyof CharacterDraft>(field: K, value: CharacterDraft[K]) => void;
};

export function usePlayerCharacterMutations({
  activeCharacter,
  sheetState,
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
  setPendingPowerId,
  setSessionNotes,
  setAdminOverrideError,
}: UsePlayerCharacterMutationsParams): PlayerCharacterMutations {
  function setSheetState(updater: CharacterSheetUpdater): void {
    if (!activeCharacter) {
      return;
    }

    if (isReadOnlyView && !dmEditMode && !adminOverrideMode && !isDmEditableView) {
      return;
    }

    updateCharacter(activeCharacter.id, updater);
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

  function appendDmAuditEntry(
    sheet: CharacterDraft,
    entry: ReturnType<typeof createDmAuditEntry>
  ): CharacterDraft {
    return appendDmAuditEntryToSheet(sheet, entry);
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

  function handleAppendHistory(): void {
    const note = sessionNotes.trim();
    if (!note) {
      return;
    }

    setSheetState((currentSheet) => appendHistoryNote(currentSheet, note, new Date()));
    setSessionNotes("");
  }

  function adjustStat(statId: StatId, direction: 1 | -1): void {
    const floorLevel = editSessionStatFloor?.[statId] ?? sheetState.statState[statId].base;
    setSheetState((currentSheet) =>
      adjustStatProgression(currentSheet, statId, direction, xpLeftOver, floorLevel)
    );
  }

  function adjustSkill(skillId: string, direction: 1 | -1): void {
    setSheetState((currentSheet) =>
      adjustSkillProgression(currentSheet, skillId, direction, xpLeftOver)
    );
  }

  function adjustPower(powerId: string, direction: 1 | -1): void {
    setSheetState((currentSheet) =>
      adjustPowerProgression(currentSheet, powerId, direction, xpLeftOver)
    );
  }

  function adjustStatOverride(statId: StatId, direction: 1 | -1): void {
    const reason = requireAdminReason();
    if (!reason) {
      return;
    }

    setSheetState((currentSheet) => {
      const currentValue = currentSheet.statState[statId].base;
      const nextLevel = currentValue + direction;
      const nextSheet = setStatBaseLevel(currentSheet, statId, nextLevel);

      if (nextSheet === currentSheet) {
        return currentSheet;
      }

      return appendDmAuditEntry(
        nextSheet,
        createDmAuditEntry(
          "admin_override",
          `statState.${statId}.base`,
          currentValue,
          nextLevel,
          reason,
          "dm-character-sheet"
        )
      );
    });
  }

  function adjustSkillOverride(skillId: string, direction: 1 | -1): void {
    const reason = requireAdminReason();
    if (!reason) {
      return;
    }

    setSheetState((currentSheet) => {
      const currentSkill = currentSheet.skills.find((skill) => skill.id === skillId);
      if (!currentSkill) {
        return currentSheet;
      }

      const nextLevel = currentSkill.base + direction;
      const nextSheet = setSkillBaseLevel(currentSheet, skillId, nextLevel);
      if (nextSheet === currentSheet) {
        return currentSheet;
      }

      return appendDmAuditEntry(
        nextSheet,
        createDmAuditEntry(
          "admin_override",
          `skills.${skillId}.base`,
          currentSkill.base,
          nextLevel,
          reason,
          "dm-character-sheet"
        )
      );
    });
  }

  function adjustPowerOverride(powerId: string, direction: 1 | -1): void {
    const reason = requireAdminReason();
    if (!reason) {
      return;
    }

    setSheetState((currentSheet) => {
      const currentPower = currentSheet.powers.find((power) => power.id === powerId);
      if (!currentPower) {
        return currentSheet;
      }

      const nextLevel = currentPower.level + direction;
      const nextSheet = setPowerLevel(currentSheet, powerId, nextLevel);
      if (nextSheet === currentSheet) {
        return currentSheet;
      }

      return appendDmAuditEntry(
        nextSheet,
        createDmAuditEntry(
          "admin_override",
          `powers.${powerId}.level`,
          currentPower.level,
          nextLevel,
          reason,
          "dm-character-sheet"
        )
      );
    });
  }

  function handleAddPowerOverride(): void {
    const reason = requireAdminReason();
    if (!reason || !pendingPowerId) {
      return;
    }

    const template = getPowerTemplate(pendingPowerId);
    if (!template) {
      return;
    }

    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        addPowerAtLevelOneOverride(currentSheet, template),
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

  function updateInventoryEntry(index: number, field: InventoryEntryField, value: string): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        updateInventoryEntryField(currentSheet, index, field, value),
        createDmAuditEntry(
          "sheet",
          `inventory[${index}].${field}`,
          currentSheet.inventory[index]?.[field] ?? "",
          value,
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      )
    );
  }

  function addInventoryEntryHandler(): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        addInventoryEntry(currentSheet),
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

  function removeInventoryEntryHandler(index: number): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        removeInventoryEntry(currentSheet, index),
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

  function updateEquipmentEntry(index: number, field: EquipmentEntryField, value: string): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        updateEquipmentEntryField(currentSheet, index, field, value),
        createDmAuditEntry(
          "sheet",
          `equipment[${index}].${field}`,
          currentSheet.equipment[index]?.[field] ?? "",
          value,
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      )
    );
  }

  function addEquipmentEntryHandler(): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        addEquipmentEntry(currentSheet),
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

  function removeEquipmentEntryHandler(index: number): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        removeEquipmentEntry(currentSheet, index),
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
    if (!template) {
      return;
    }

    setSheetState((currentSheet) => addPowerAtLevelOne(currentSheet, template, xpLeftOver));
    setPendingPowerId("");
  }

  function resetPowerUsage(scope: PowerUsageResetScope): void {
    setSheetState((currentSheet) => {
      const nextSheet = resetCharacterPowerUsageScope(currentSheet, scope);
      if (nextSheet === currentSheet) {
        return currentSheet;
      }

      if (!isDmView) {
        return nextSheet;
      }

      return appendDmAuditEntry(
        nextSheet,
        createDmAuditEntry(
          "runtime",
          `powerUsageState.${scope}`,
          currentSheet.powerUsageState[scope],
          {},
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      );
    });
  }

  function updateRuntimeField(field: RuntimeEditableField, rawValue: number): void {
    if (!isDmView) {
      return;
    }

    setSheetState((currentSheet) => {
      const derivedSnapshot = buildCharacterDerivedValues(currentSheet);
      const currentValue =
        field === "currentMana" ? derivedSnapshot.currentMana : currentSheet[field];
      const nextSheet = updateRuntimeFieldValue(currentSheet, field, rawValue);
      if (nextSheet === currentSheet) {
        return currentSheet;
      }

      const nextValue = field === "currentMana" ? nextSheet.currentMana : nextSheet[field];
      return appendDmAuditEntry(
        nextSheet,
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
      const nextSheet = updateSheetFieldValue(currentSheet, field, value);
      const shouldLog = isDmView && (dmEditMode || adminOverrideMode || isDmEditableView);

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

  return {
    handleAppendHistory,
    adjustStat,
    adjustSkill,
    adjustPower,
    adjustStatOverride,
    adjustSkillOverride,
    adjustPowerOverride,
    handleAddPowerOverride,
    updateInventoryEntry,
    addInventoryEntry: addInventoryEntryHandler,
    removeInventoryEntry: removeInventoryEntryHandler,
    updateEquipmentEntry,
    addEquipmentEntry: addEquipmentEntryHandler,
    removeEquipmentEntry: removeEquipmentEntryHandler,
    handleAddPower,
    resetPowerUsage,
    handleRuntimeInput,
    updateSheetField,
  };
}
