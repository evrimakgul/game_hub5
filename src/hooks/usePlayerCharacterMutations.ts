import type { Dispatch, SetStateAction } from "react";

import { buildCharacterDerivedValues } from "../config/characterRuntime";
import {
  buildItemIndex,
  canCharacterIdentifyItem,
  getCharacterArtifactAppraisalLevel,
  identifyItemForCharacter,
  maskItemForCharacter,
  retypeSharedItemRecord,
} from "../lib/items.ts";
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
  addPowerAtLevelOne,
  addPowerAtLevelOneOverride,
  adjustPowerProgression,
  adjustSkillProgression,
  adjustStatProgression,
  appendHistoryNote,
  setPowerLevel,
  setSkillBaseLevel,
  setStatBaseLevel,
  type RuntimeEditableField,
  updateRuntimeFieldValue,
  updateSheetFieldValue,
} from "../mutations/characterSheetMutations";
import {
  addEquipmentReference,
  linkSharedItemToCharacter,
  removeEquipmentReference,
  setCharacterActiveItemState,
  setCharacterInventoryItemState,
  setCharacterOwnedItemState,
  setCharacterWeaponHandSlotItem,
  type EquipmentReferenceField,
  updateEquipmentReferenceField,
} from "../mutations/characterItemMutations.ts";
import type { CharacterRecord, StatId } from "../types/character";
import type {
  ItemBlueprintId,
  ItemDerivedModifierId,
  SharedItemRecord,
  WeaponHandSlotId,
} from "../types/items.ts";
import type { PowerUsageResetScope } from "../types/powerUsage";

type CharacterSheetUpdater =
  | CharacterDraft
  | ((current: CharacterDraft) => CharacterDraft);

type SharedItemUpdater =
  | SharedItemRecord
  | ((current: SharedItemRecord) => SharedItemRecord);

type UsePlayerCharacterMutationsParams = {
  activeCharacter: CharacterRecord | null;
  sheetState: CharacterDraft;
  items: SharedItemRecord[];
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
  createItem: (
    blueprintId: ItemBlueprintId,
    overrides?: Partial<
      Pick<
        SharedItemRecord,
        "name" | "itemLevel" | "qualityTier" | "baseDescription" | "bonusProfile" | "knowledge"
      >
    >
  ) => string;
  updateItem: (itemId: string, updater: SharedItemUpdater) => void;
  deleteItem: (itemId: string) => void;
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
  createSharedItem: (blueprintId: ItemBlueprintId) => void;
  updateSharedItemField: (
    itemId: string,
    field: "name" | "itemLevel" | "qualityTier" | "baseDescription",
    value: string
  ) => void;
  updateSharedItemBlueprint: (itemId: string, blueprintId: ItemBlueprintId) => void;
  updateSharedItemBonusNotes: (itemId: string, value: string) => void;
  updateSharedItemStatBonus: (itemId: string, statId: StatId, value: string) => void;
  updateSharedItemDerivedBonus: (
    itemId: string,
    targetId: ItemDerivedModifierId,
    value: string
  ) => void;
  updateSharedItemOwnedState: (itemId: string, isOwned: boolean) => void;
  updateSharedItemInventoryState: (itemId: string, isCarried: boolean) => void;
  updateSharedItemActiveState: (itemId: string, isActive: boolean) => void;
  identifySharedItem: (itemId: string) => void;
  maskSharedItem: (itemId: string) => void;
  deleteSharedItem: (itemId: string) => void;
  updateWeaponHandSlotItem: (slot: WeaponHandSlotId, itemId: string) => void;
  updateEquipmentEntry: (index: number, field: EquipmentReferenceField, value: string) => void;
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
}: UsePlayerCharacterMutationsParams): PlayerCharacterMutations {
  const itemsById = buildItemIndex(items);

  function setSheetState(updater: CharacterSheetUpdater): void {
    if (!activeCharacter) {
      return;
    }

    if (isReadOnlyView && !dmEditMode && !adminOverrideMode && !isDmEditableView) {
      return;
    }

    updateCharacter(activeCharacter.id, updater);
  }

  function setItemState(itemId: string, updater: SharedItemUpdater): void {
    if (!items.some((item) => item.id === itemId)) {
      return;
    }

    updateItem(itemId, updater);
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

  function createSharedItemHandler(blueprintId: ItemBlueprintId): void {
    const itemId = createItem(blueprintId);
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        linkSharedItemToCharacter(currentSheet, itemId),
        createDmAuditEntry(
          "sheet",
          "ownedItemIds",
          currentSheet.ownedItemIds.length,
          currentSheet.ownedItemIds.length + 1,
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      )
    );
  }

  function updateSharedItemField(
    itemId: string,
    field: "name" | "itemLevel" | "qualityTier" | "baseDescription",
    value: string
  ): void {
    setItemState(itemId, (currentItem) => ({
      ...currentItem,
      [field]:
        field === "itemLevel"
          ? Math.max(1, Number.parseInt(value, 10) || currentItem.itemLevel)
          : field === "qualityTier"
            ? value.trim() || null
            : value,
    }));
  }

  function updateSharedItemBlueprint(itemId: string, blueprintId: ItemBlueprintId): void {
    setItemState(itemId, (currentItem) => retypeSharedItemRecord(currentItem, blueprintId));
  }

  function updateSharedItemBonusNotes(itemId: string, value: string): void {
    const notes = value
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    setItemState(itemId, (currentItem) => ({
      ...currentItem,
      bonusProfile: {
        ...currentItem.bonusProfile,
        notes,
      },
    }));
  }

  function updateSharedItemStatBonus(itemId: string, statId: StatId, value: string): void {
    const parsed = Number.parseInt(value, 10);

    setItemState(itemId, (currentItem) => {
      const nextBonuses = { ...currentItem.bonusProfile.statBonuses };
      if (Number.isNaN(parsed) || parsed === 0) {
        delete nextBonuses[statId];
      } else {
        nextBonuses[statId] = parsed;
      }

      return {
        ...currentItem,
        bonusProfile: {
          ...currentItem.bonusProfile,
          statBonuses: nextBonuses,
        },
      };
    });
  }

  function updateSharedItemDerivedBonus(
    itemId: string,
    targetId: ItemDerivedModifierId,
    value: string
  ): void {
    const parsed = Number.parseInt(value, 10);

    setItemState(itemId, (currentItem) => {
      const nextBonuses = { ...currentItem.bonusProfile.derivedBonuses };
      if (Number.isNaN(parsed) || parsed === 0) {
        delete nextBonuses[targetId];
      } else {
        nextBonuses[targetId] = parsed;
      }

      return {
        ...currentItem,
        bonusProfile: {
          ...currentItem.bonusProfile,
          derivedBonuses: nextBonuses,
        },
      };
    });
  }

  function updateSharedItemOwnedState(itemId: string, isOwned: boolean): void {
    setSheetState((currentSheet) => setCharacterOwnedItemState(currentSheet, itemId, isOwned));
  }

  function updateSharedItemInventoryState(itemId: string, isCarried: boolean): void {
    setSheetState((currentSheet) => setCharacterInventoryItemState(currentSheet, itemId, isCarried));
  }

  function updateSharedItemActiveState(itemId: string, isActive: boolean): void {
    setSheetState((currentSheet) => setCharacterActiveItemState(currentSheet, itemId, isActive));
  }

  function identifySharedItem(itemId: string): void {
    if (!activeCharacter) {
      return;
    }

    const currentItem = items.find((item) => item.id === itemId);
    if (!currentItem) {
      return;
    }

    const artifactAppraisalLevel = getCharacterArtifactAppraisalLevel(sheetState);
    if (
      !currentItem.knowledge.learnedCharacterIds.includes(activeCharacter.id) &&
      !canCharacterIdentifyItem(currentItem, artifactAppraisalLevel)
    ) {
      return;
    }

    setItemState(itemId, (item) => identifyItemForCharacter(item, activeCharacter.id));
  }

  function maskSharedItem(itemId: string): void {
    if (!activeCharacter) {
      return;
    }

    setItemState(itemId, (item) => maskItemForCharacter(item, activeCharacter.id));
  }

  function deleteSharedItemHandler(itemId: string): void {
    deleteItem(itemId);
  }

  function updateWeaponHandSlotItem(slot: WeaponHandSlotId, itemId: string): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        setCharacterWeaponHandSlotItem(currentSheet, slot, itemId, itemsById),
        createDmAuditEntry(
          "sheet",
          `equipment.${slot}.itemId`,
          currentSheet.equipment.find((entry) => entry.slot === slot)?.itemId ?? "",
          itemId,
          dmEditReason.trim(),
          "dm-character-sheet"
        )
      )
    );
  }

  function updateEquipmentEntry(index: number, field: EquipmentReferenceField, value: string): void {
    setSheetState((currentSheet) =>
      appendDmAuditEntry(
        updateEquipmentReferenceField(currentSheet, index, field, value),
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
        addEquipmentReference(currentSheet),
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
        removeEquipmentReference(currentSheet, index),
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
      const derivedSnapshot = buildCharacterDerivedValues(currentSheet, itemsById);
      const currentValue =
        field === "currentMana" ? derivedSnapshot.currentMana : currentSheet[field];
      const nextSheet = updateRuntimeFieldValue(currentSheet, field, rawValue, itemsById);
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
    createSharedItem: createSharedItemHandler,
    updateSharedItemField,
    updateSharedItemBlueprint,
    updateSharedItemBonusNotes,
    updateSharedItemStatBonus,
    updateSharedItemDerivedBonus,
    updateSharedItemOwnedState,
    updateSharedItemInventoryState,
    updateSharedItemActiveState,
    identifySharedItem,
    maskSharedItem,
    deleteSharedItem: deleteSharedItemHandler,
    updateWeaponHandSlotItem,
    updateEquipmentEntry,
    addEquipmentEntry: addEquipmentEntryHandler,
    removeEquipmentEntry: removeEquipmentEntryHandler,
    handleAddPower,
    resetPowerUsage,
    handleRuntimeInput,
    updateSheetField,
  };
}
