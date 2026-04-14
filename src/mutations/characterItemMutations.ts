import type { CharacterDraft } from "../config/characterTemplate";
import { getCurrentStatValue } from "../config/characterRuntime.ts";
import {
  getEquipmentSlotOccupancy,
  getItemAllowedEquipSlots,
  getItemMechanicalRole,
  getResolvedItemOccupiedSlots,
  itemOccupiesBothWeaponHands,
} from "../lib/items.ts";
import {
  isCanonicalEquipmentSlotId,
  isSupplementaryEquipmentSlotId,
  isWeaponHandSlotId,
  type CanonicalEquipmentSlotId,
  type ItemBlueprintRecord,
  type ItemCategoryDefinition,
  type ItemSubcategoryDefinition,
  type SharedItemRecord,
  type SupplementaryEquipmentSlotId,
  type WeaponHandSlotId,
} from "../types/items.ts";

type LinkItemOptions = {
  owned?: boolean;
  carried?: boolean;
  active?: boolean;
};

export type EquipmentReferenceField = "slot" | "itemId";

type ItemRulesContext = {
  itemBlueprints?: ItemBlueprintRecord[];
  itemCategoryDefinitions?: ItemCategoryDefinition[];
  itemSubcategoryDefinitions?: ItemSubcategoryDefinition[];
};

function upsertEquipmentSlotValue(
  sheet: CharacterDraft,
  slot: string,
  itemId: string | null,
  anchorSlot: CanonicalEquipmentSlotId | null
): CharacterDraft {
  const existingIndex = sheet.equipment.findIndex((entry) => entry.slot === slot);
  const normalizedItemId = itemId && itemId.trim().length > 0 ? itemId : null;
  const normalizedAnchorSlot =
    normalizedItemId && isCanonicalEquipmentSlotId(anchorSlot) ? anchorSlot : null;

  if (existingIndex >= 0) {
    return {
      ...sheet,
      equipment: sheet.equipment.map((entry, index) =>
        index === existingIndex
          ? { ...entry, itemId: normalizedItemId, anchorSlot: normalizedAnchorSlot }
          : entry
      ),
    };
  }

  return {
    ...sheet,
    equipment: [
      ...sheet.equipment,
      { slot, itemId: normalizedItemId, anchorSlot: normalizedAnchorSlot },
    ],
  };
}

function clearCanonicalSlot(sheet: CharacterDraft, slot: CanonicalEquipmentSlotId): CharacterDraft {
  return upsertEquipmentSlotValue(sheet, slot, null, null);
}

function writeCanonicalItemGroup(
  sheet: CharacterDraft,
  itemId: string,
  anchorSlot: CanonicalEquipmentSlotId,
  occupiedSlots: CanonicalEquipmentSlotId[]
): CharacterDraft {
  return occupiedSlots.reduce(
    (currentSheet, slotId) => upsertEquipmentSlotValue(currentSheet, slotId, itemId, anchorSlot),
    sheet
  );
}

function isShieldItem(
  item: SharedItemRecord | null | undefined,
  itemRulesContext: ItemRulesContext = {}
): boolean {
  return !!item && getItemMechanicalRole(item, itemRulesContext) === "shield";
}

function removeItemFromEquipmentEntries(sheet: CharacterDraft, itemId: string): CharacterDraft {
  return {
    ...sheet,
    equipment: sheet.equipment.flatMap((entry) => {
      if (entry.itemId !== itemId) {
        return [entry];
      }

      return isCanonicalEquipmentSlotId(entry.slot)
        ? [{ ...entry, itemId: null, anchorSlot: null }]
        : [];
    }),
  };
}

function resolveRequestedAnchorSlot(
  item: SharedItemRecord,
  requestedSlot: CanonicalEquipmentSlotId,
  itemRulesContext: ItemRulesContext = {}
): CanonicalEquipmentSlotId | null {
  const allowedEquipSlots = getItemAllowedEquipSlots(item, itemRulesContext);
  if (allowedEquipSlots.length === 0) {
    return requestedSlot;
  }

  if (allowedEquipSlots.includes(requestedSlot)) {
    return requestedSlot;
  }

  return allowedEquipSlots[0] ?? null;
}

function clearEquipmentAssignment(
  sheet: CharacterDraft,
  slot: string,
  itemsById: Record<string, SharedItemRecord>,
  itemRulesContext: ItemRulesContext = {}
): CharacterDraft {
  if (!isCanonicalEquipmentSlotId(slot)) {
    return upsertEquipmentSlotValue(sheet, slot, null, null);
  }

  const occupancy = getEquipmentSlotOccupancy(sheet, slot, itemsById, itemRulesContext);
  if (!occupancy) {
    return clearCanonicalSlot(sheet, slot);
  }

  return removeItemFromEquipmentEntries(sheet, occupancy.itemId);
}

function canCharacterEquipItemByStats(
  sheet: CharacterDraft,
  item: SharedItemRecord,
  itemsById: Record<string, SharedItemRecord>
): boolean {
  const minimumStrength = item.combatSpec?.minimumStrength;
  if (typeof minimumStrength !== "number") {
    return true;
  }

  return getCurrentStatValue(sheet, "STR", itemsById) >= minimumStrength;
}

function equipCharacterItemToSlot(
  sheet: CharacterDraft,
  requestedSlot: string,
  itemId: string,
  itemsById: Record<string, SharedItemRecord>,
  itemRulesContext: ItemRulesContext = {}
): CharacterDraft {
  const normalizedItemId = itemId.trim().length > 0 ? itemId : null;
  if (!normalizedItemId) {
    return clearEquipmentAssignment(sheet, requestedSlot, itemsById, itemRulesContext);
  }

  if (!isCanonicalEquipmentSlotId(requestedSlot)) {
    return upsertEquipmentSlotValue(sheet, requestedSlot, normalizedItemId, null);
  }

  const nextItem = itemsById[normalizedItemId] ?? null;
  if (!nextItem) {
    return upsertEquipmentSlotValue(sheet, requestedSlot, normalizedItemId, requestedSlot);
  }

  if (!canCharacterEquipItemByStats(sheet, nextItem, itemsById)) {
    return sheet;
  }

  const anchorSlot = resolveRequestedAnchorSlot(nextItem, requestedSlot, itemRulesContext);
  if (!anchorSlot) {
    return sheet;
  }

  const occupiedSlots = getResolvedItemOccupiedSlots(nextItem, anchorSlot, itemRulesContext);
  const conflictingOccupancies = occupiedSlots.flatMap((slotId) => {
    const occupancy = getEquipmentSlotOccupancy(sheet, slotId, itemsById, itemRulesContext);
    return occupancy ? [occupancy] : [];
  });
  const conflictingItemIds = [
    ...new Set(
      conflictingOccupancies
        .map((occupancy) => occupancy.itemId)
        .filter((entry) => entry !== normalizedItemId)
    ),
  ];

  if (
    isShieldItem(nextItem, itemRulesContext) &&
    conflictingOccupancies.some((occupancy) => itemOccupiesBothWeaponHands(occupancy.item, itemRulesContext))
  ) {
    return sheet;
  }

  let nextSheet = removeItemFromEquipmentEntries(sheet, normalizedItemId);
  conflictingItemIds.forEach((conflictingItemId) => {
    nextSheet = removeItemFromEquipmentEntries(nextSheet, conflictingItemId);
  });

  return writeCanonicalItemGroup(nextSheet, normalizedItemId, anchorSlot, occupiedSlots);
}

export function setCharacterEquipmentSlotItem(
  sheet: CharacterDraft,
  slot: string,
  itemId: string,
  itemsById: Record<string, SharedItemRecord> = {},
  itemRulesContext: ItemRulesContext = {}
): CharacterDraft {
  return equipCharacterItemToSlot(sheet, slot, itemId, itemsById, itemRulesContext);
}

export function setCharacterWeaponHandSlotItem(
  sheet: CharacterDraft,
  slot: WeaponHandSlotId,
  itemId: string,
  itemsById: Record<string, SharedItemRecord>,
  itemRulesContext: ItemRulesContext = {}
): CharacterDraft {
  return equipCharacterItemToSlot(sheet, slot, itemId, itemsById, itemRulesContext);
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
      entry.itemId === itemId ? { ...entry, itemId: null, anchorSlot: null } : entry
    ),
  };
}

export function removeCharacterItemFromEquipment(
  sheet: CharacterDraft,
  itemId: string
): CharacterDraft {
  return removeItemFromEquipmentEntries(sheet, itemId);
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
          entry.itemId === itemId ? { ...entry, itemId: null, anchorSlot: null } : entry
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

export function setCharacterSupplementarySlotEnabled(
  sheet: CharacterDraft,
  slot: SupplementaryEquipmentSlotId,
  isEnabled: boolean
): CharacterDraft {
  const nextEnabledSlots = isEnabled
    ? appendUnique(sheet.enabledSupplementarySlotIds, slot).filter(isSupplementaryEquipmentSlotId)
    : removeValue(sheet.enabledSupplementarySlotIds, slot).filter(isSupplementaryEquipmentSlotId);

  const nextSheet = {
    ...sheet,
    enabledSupplementarySlotIds: nextEnabledSlots,
  };

  return isEnabled ? nextSheet : clearCanonicalSlot(nextSheet, slot);
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
            anchorSlot:
              field === "itemId" && value.trim().length === 0
                ? null
                : entry.anchorSlot,
          }
        : entry
    ),
  };
}

export function addEquipmentReference(sheet: CharacterDraft): CharacterDraft {
  return {
    ...sheet,
    equipment: [...sheet.equipment, { slot: "", itemId: null, anchorSlot: null }],
  };
}

export function removeEquipmentReference(sheet: CharacterDraft, index: number): CharacterDraft {
  return {
    ...sheet,
    equipment: sheet.equipment.filter((_, entryIndex) => entryIndex !== index),
  };
}
