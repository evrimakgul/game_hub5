import type { CharacterDraft } from "../config/characterTemplate";

type LinkItemOptions = {
  owned?: boolean;
  carried?: boolean;
  active?: boolean;
};

export type EquipmentReferenceField = "slot" | "itemId";

function appendUnique(values: string[], nextValue: string): string[] {
  if (!nextValue.trim()) {
    return values;
  }

  return values.includes(nextValue) ? values : [...values, nextValue];
}

function removeValue(values: string[], targetValue: string): string[] {
  return values.filter((entry) => entry !== targetValue);
}

export function linkSharedItemToCharacter(
  sheet: CharacterDraft,
  itemId: string,
  options: LinkItemOptions = {}
): CharacterDraft {
  const { owned = true, carried = true, active = false } = options;

  return {
    ...sheet,
    ownedItemIds: owned ? appendUnique(sheet.ownedItemIds, itemId) : sheet.ownedItemIds,
    inventoryItemIds: carried
      ? appendUnique(sheet.inventoryItemIds, itemId)
      : sheet.inventoryItemIds,
    activeItemIds: active ? appendUnique(sheet.activeItemIds, itemId) : sheet.activeItemIds,
  };
}

export function removeSharedItemFromCharacter(
  sheet: CharacterDraft,
  itemId: string
): CharacterDraft {
  return {
    ...sheet,
    ownedItemIds: removeValue(sheet.ownedItemIds, itemId),
    inventoryItemIds: removeValue(sheet.inventoryItemIds, itemId),
    activeItemIds: removeValue(sheet.activeItemIds, itemId),
    equipment: sheet.equipment.map((entry) =>
      entry.itemId === itemId ? { ...entry, itemId: null } : entry
    ),
  };
}

export function setCharacterOwnedItemState(
  sheet: CharacterDraft,
  itemId: string,
  isOwned: boolean
): CharacterDraft {
  return {
    ...sheet,
    ownedItemIds: isOwned ? appendUnique(sheet.ownedItemIds, itemId) : removeValue(sheet.ownedItemIds, itemId),
  };
}

export function setCharacterInventoryItemState(
  sheet: CharacterDraft,
  itemId: string,
  isCarried: boolean
): CharacterDraft {
  return {
    ...sheet,
    inventoryItemIds: isCarried
      ? appendUnique(sheet.inventoryItemIds, itemId)
      : removeValue(sheet.inventoryItemIds, itemId),
    activeItemIds: isCarried ? sheet.activeItemIds : removeValue(sheet.activeItemIds, itemId),
    equipment: isCarried
      ? sheet.equipment
      : sheet.equipment.map((entry) =>
          entry.itemId === itemId ? { ...entry, itemId: null } : entry
        ),
  };
}

export function setCharacterActiveItemState(
  sheet: CharacterDraft,
  itemId: string,
  isActive: boolean
): CharacterDraft {
  return {
    ...sheet,
    activeItemIds: isActive ? appendUnique(sheet.activeItemIds, itemId) : removeValue(sheet.activeItemIds, itemId),
  };
}

export function updateEquipmentReferenceField(
  sheet: CharacterDraft,
  index: number,
  field: EquipmentReferenceField,
  value: string
): CharacterDraft {
  return {
    ...sheet,
    equipment: sheet.equipment.map((entry, entryIndex) =>
      entryIndex === index
        ? {
            ...entry,
            [field]: field === "itemId" ? (value.trim() ? value : null) : value,
          }
        : entry
    ),
  };
}

export function addEquipmentReference(sheet: CharacterDraft): CharacterDraft {
  return {
    ...sheet,
    equipment: [...sheet.equipment, { slot: "", itemId: null }],
  };
}

export function removeEquipmentReference(sheet: CharacterDraft, index: number): CharacterDraft {
  return {
    ...sheet,
    equipment: sheet.equipment.filter((_, entryIndex) => entryIndex !== index),
  };
}
