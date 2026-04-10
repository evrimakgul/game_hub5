import type { CharacterDraft } from "../config/characterTemplate";
import { isWeaponHandSlotId, type SharedItemRecord, type WeaponHandSlotId } from "../types/items.ts";

type LinkItemOptions = {
  owned?: boolean;
  carried?: boolean;
  active?: boolean;
};

export type EquipmentReferenceField = "slot" | "itemId";

function upsertEquipmentSlotValue(
  sheet: CharacterDraft,
  slot: string,
  itemId: string | null
): CharacterDraft {
  const existingIndex = sheet.equipment.findIndex((entry) => entry.slot === slot);
  const normalizedItemId = itemId && itemId.trim().length > 0 ? itemId : null;

  if (existingIndex >= 0) {
    return {
      ...sheet,
      equipment: sheet.equipment.map((entry, index) =>
        index === existingIndex ? { ...entry, itemId: normalizedItemId } : entry
      ),
    };
  }

  return {
    ...sheet,
    equipment: [...sheet.equipment, { slot, itemId: normalizedItemId }],
  };
}

export function setCharacterEquipmentSlotItem(
  sheet: CharacterDraft,
  slot: string,
  itemId: string
): CharacterDraft {
  return upsertEquipmentSlotValue(sheet, slot, itemId);
}

function clearWeaponHandSlot(sheet: CharacterDraft, slot: WeaponHandSlotId): CharacterDraft {
  return upsertEquipmentSlotValue(sheet, slot, null);
}

function itemOccupiesBothWeaponHands(item: SharedItemRecord | null | undefined): boolean {
  return !!item && item.category === "weapon" && item.combatSpec?.handsRequired === 2;
}

export function setCharacterWeaponHandSlotItem(
  sheet: CharacterDraft,
  slot: WeaponHandSlotId,
  itemId: string,
  itemsById: Record<string, SharedItemRecord>
): CharacterDraft {
  const normalizedItemId = itemId.trim().length > 0 ? itemId : null;
  const oppositeSlot = slot === "weapon_primary" ? "weapon_secondary" : "weapon_primary";
  const nextItem = normalizedItemId ? itemsById[normalizedItemId] ?? null : null;
  const currentSlotItemId =
    sheet.equipment.find((entry) => entry.slot === slot)?.itemId ?? null;
  const currentSlotItem = currentSlotItemId ? itemsById[currentSlotItemId] ?? null : null;
  const oppositeSlotItemId =
    sheet.equipment.find((entry) => entry.slot === oppositeSlot)?.itemId ?? null;
  const oppositeSlotItem = oppositeSlotItemId ? itemsById[oppositeSlotItemId] ?? null : null;

  if (!normalizedItemId) {
    const cleared = clearWeaponHandSlot(sheet, slot);
    return itemOccupiesBothWeaponHands(currentSlotItem) && currentSlotItemId === oppositeSlotItemId
      ? clearWeaponHandSlot(cleared, oppositeSlot)
      : cleared;
  }

  let nextSheet = upsertEquipmentSlotValue(sheet, slot, normalizedItemId);

  if (itemOccupiesBothWeaponHands(nextItem)) {
    return upsertEquipmentSlotValue(nextSheet, oppositeSlot, normalizedItemId);
  }

  if (itemOccupiesBothWeaponHands(oppositeSlotItem) || oppositeSlotItemId === currentSlotItemId) {
    nextSheet = clearWeaponHandSlot(nextSheet, oppositeSlot);
  }

  return nextSheet;
}

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

export function removeCharacterItemFromEquipment(
  sheet: CharacterDraft,
  itemId: string
): CharacterDraft {
  return {
    ...sheet,
    equipment: sheet.equipment.flatMap((entry) => {
      if (entry.itemId !== itemId) {
        return [entry];
      }

      return isWeaponHandSlotId(entry.slot) ? [{ ...entry, itemId: null }] : [];
    }),
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
