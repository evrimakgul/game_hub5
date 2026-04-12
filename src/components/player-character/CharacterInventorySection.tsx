import type { CharacterDraft } from "../../config/characterTemplate";
import {
  canCharacterIdentifyItem,
  canViewerSeeItemBonusDetails,
  getEquipmentSlotLabel,
  getEquipmentEntryBySlot,
  getEquipmentSlotOccupancy,
  getItemAllowedEquipSlots,
  getItemCompactHeaderSummary,
  getItemMechanicalRole,
  getWeaponHandSlotLabel,
} from "../../lib/items.ts";
import type {
  ItemBlueprintRecord,
  ItemCategoryDefinition,
  MainEquipmentSlotId,
  ItemSubcategoryDefinition,
  SharedItemRecord,
  SupplementaryEquipmentSlotId,
  WeaponHandSlotId,
} from "../../types/items.ts";
import {
  MAIN_EQUIPMENT_SLOT_IDS,
  SUPPLEMENTARY_EQUIPMENT_SLOT_IDS,
  isSupplementaryEquipmentSlotId,
  isWeaponHandSlotId,
} from "../../types/items.ts";
function sortItemsByName(items: SharedItemRecord[]): SharedItemRecord[] {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function getItemStateSummary(
  itemId: string,
  ownedItemIds: string[],
  inventoryItemIds: string[]
): string {
  return [
    ownedItemIds.includes(itemId) ? "Owned" : "Not owned",
    inventoryItemIds.includes(itemId) ? "Carried" : "Not carried",
  ].join(" | ");
}

function isShieldItem(
  item: SharedItemRecord,
  itemRulesContext: {
    itemBlueprints: ItemBlueprintRecord[];
    itemCategoryDefinitions: ItemCategoryDefinition[];
    itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  }
): boolean {
  return getItemMechanicalRole(item, itemRulesContext) === "shield";
}

function isHandEquippableItem(
  item: SharedItemRecord,
  itemRulesContext: {
    itemBlueprints: ItemBlueprintRecord[];
    itemCategoryDefinitions: ItemCategoryDefinition[];
    itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  }
): boolean {
  return getItemAllowedEquipSlots(item, itemRulesContext).some(
    (slot) => slot === "weapon_primary" || slot === "weapon_secondary"
  );
}

function canEquipIntoVisibleNonHandSlot(
  item: SharedItemRecord,
  itemRulesContext: {
    itemBlueprints: ItemBlueprintRecord[];
    itemCategoryDefinitions: ItemCategoryDefinition[];
    itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  },
  enabledSupplementarySlotIds: Set<SupplementaryEquipmentSlotId>
): boolean {
  return getItemAllowedEquipSlots(item, itemRulesContext).some(
    (slot) =>
      slot === "body" ||
      slot === "neck" ||
      slot === "head" ||
      slot === "ring_left" ||
      slot === "ring_right" ||
      (isSupplementaryEquipmentSlotId(slot) && enabledSupplementarySlotIds.has(slot))
  );
}

type CharacterInventorySectionProps = {
  characterId: string;
  sheetState: CharacterDraft;
  itemsById: Record<string, SharedItemRecord>;
  itemBlueprints: ItemBlueprintRecord[];
  itemCategoryDefinitions: ItemCategoryDefinition[];
  itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  ownedItemCardIds: Set<string>;
  revealAllItemBonusDetails: boolean;
  artifactAppraisalLevel: number;
  isSheetEditMode: boolean;
  onIdentifySharedItem: (itemId: string) => void;
  onEquipSharedItem: (itemId: string, slot?: string) => void;
  onUnequipSharedItem: (itemId: string) => void;
  onUpdateWeaponHandSlotItem: (slot: WeaponHandSlotId, itemId: string) => void;
  onUpdateMainEquipmentSlotItem: (slot: MainEquipmentSlotId, itemId: string) => void;
  onUpdateSupplementaryEquipmentSlotItem: (
    slot: SupplementaryEquipmentSlotId,
    itemId: string
  ) => void;
  onUpdateMoney: (value: number) => void;
};

export function CharacterInventorySection({
  characterId,
  sheetState,
  itemsById,
  itemBlueprints,
  itemCategoryDefinitions,
  itemSubcategoryDefinitions,
  ownedItemCardIds,
  revealAllItemBonusDetails,
  artifactAppraisalLevel,
  isSheetEditMode,
  onIdentifySharedItem,
  onEquipSharedItem,
  onUnequipSharedItem,
  onUpdateWeaponHandSlotItem,
  onUpdateMainEquipmentSlotItem,
  onUpdateSupplementaryEquipmentSlotItem,
  onUpdateMoney,
}: CharacterInventorySectionProps) {
  const itemRulesContext = {
    itemBlueprints,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
  };
  const enabledSupplementarySlotIdSet = new Set(
    sheetState.enabledSupplementarySlotIds ?? []
  );
  const visibleEquipmentSlotIds = [
    ...MAIN_EQUIPMENT_SLOT_IDS,
    ...SUPPLEMENTARY_EQUIPMENT_SLOT_IDS.filter((slotId) =>
      enabledSupplementarySlotIdSet.has(slotId)
    ),
  ];
  const referencedItemIds = [...new Set([
    ...(sheetState.ownedItemIds ?? []),
    ...(sheetState.inventoryItemIds ?? []),
    ...(sheetState.activeItemIds ?? []),
    ...(sheetState.equipment ?? [])
      .map((entry) => entry.itemId)
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
  ])];
  const referencedItems = referencedItemIds
    .map((itemId) => itemsById[itemId])
    .filter((item): item is SharedItemRecord => item !== undefined);
  const sortedReferencedItems = sortItemsByName(referencedItems);
  const mainEquipmentEntries = visibleEquipmentSlotIds.map((slotId) => ({
    slotId,
    label: getEquipmentSlotLabel(slotId),
    entry: getEquipmentEntryBySlot(sheetState, slotId),
    occupancy: getEquipmentSlotOccupancy(sheetState, slotId, itemsById, itemRulesContext),
  }));
  const equippedItemIds = new Set(
    (sheetState.equipment ?? [])
      .map((entry) => entry.itemId)
      .filter((itemId): itemId is string => typeof itemId === "string" && itemId.trim().length > 0)
  );
  const unequippedReferencedItems = sortedReferencedItems.filter((item) => !equippedItemIds.has(item.id));

  return (
    <article className="sheet-card equipment-card">
      <p className="section-kicker">Character Gear</p>
      <h2>Equipment</h2>

      <section className="equipment-subsection">
        <div className="equipment-subsection-head">
          <h3>Loadout</h3>
        </div>
        <div className="equipment-compact-list">
          {mainEquipmentEntries.map(({ slotId, label, entry, occupancy }) => {
            const item = occupancy?.item ?? (entry?.itemId ? itemsById[entry.itemId] ?? null : null);
            const followerAnchorLabel =
              occupancy && !occupancy.isAnchorSlot && occupancy.anchorSlot
                ? getEquipmentSlotLabel(occupancy.anchorSlot)
                : null;

            return isSheetEditMode ? (
              <div key={slotId} className="equipment-compact-row equipment-compact-row-edit">
                <div className="equipment-compact-main">
                  <strong>{label}</strong>
                  {occupancy && !occupancy.isAnchorSlot ? (
                    <span className="equipment-line-detail">
                      Occupied by {item?.name ?? "equipped item"} via {followerAnchorLabel ?? "anchor"}
                    </span>
                  ) : null}
                </div>
                <div className="equipment-inline-controls">
                  <select
                    className="sheet-meta-input"
                    value={entry?.itemId ?? ""}
                    onChange={(event) =>
                      isWeaponHandSlotId(slotId)
                        ? onUpdateWeaponHandSlotItem(slotId, event.target.value)
                        : isSupplementaryEquipmentSlotId(slotId)
                          ? onUpdateSupplementaryEquipmentSlotItem(slotId, event.target.value)
                          : onUpdateMainEquipmentSlotItem(slotId, event.target.value)
                    }
                  >
                    <option value="">No item</option>
                    {sortedReferencedItems.map((referencedItem) => (
                      <option key={referencedItem.id} value={referencedItem.id}>
                        {referencedItem.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div key={slotId} className="equipment-compact-row">
                <div className="equipment-compact-main">
                      <strong>{label}</strong>
                      <span className="equipment-line-detail">
                        {occupancy && !occupancy.isAnchorSlot
                          ? `Occupied by ${item?.name ?? "equipped item"}`
                          : item?.name ?? "Open Slot"}
                      </span>
                      {occupancy && !occupancy.isAnchorSlot ? (
                        <small className="equipment-state-line">
                          Locked by {followerAnchorLabel ?? "anchor slot"}.
                        </small>
                      ) : null}
                </div>
                <div className="equipment-read-meta">
                  {item && (!occupancy || occupancy.isAnchorSlot) ? (
                    (() => {
                      const hasOwnedItemCard = ownedItemCardIds.has(item.id);
                      const canShowBonusDetails = canViewerSeeItemBonusDetails(
                        item,
                        characterId,
                        hasOwnedItemCard,
                        revealAllItemBonusDetails
                      );
                      const canIdentify =
                        !hasOwnedItemCard &&
                        canCharacterIdentifyItem(item, artifactAppraisalLevel);

                      return (
                        <>
                          <em>
                            {getItemCompactHeaderSummary(item, {
                              ...itemRulesContext,
                              includeBonus: canShowBonusDetails,
                            })}
                          </em>
                          <div className="equipment-inline-actions">
                            <button
                              type="button"
                              className="equipment-inline-button"
                              onClick={() => onUnequipSharedItem(item.id)}
                            >
                              Unequip
                            </button>
                            {!revealAllItemBonusDetails && !hasOwnedItemCard ? (
                              <button
                                type="button"
                                className="equipment-inline-button"
                                disabled={!canIdentify}
                                onClick={() => onIdentifySharedItem(item.id)}
                              >
                                Identify
                              </button>
                            ) : null}
                          </div>
                        </>
                      );
                    })()
                  ) : occupancy && !occupancy.isAnchorSlot ? (
                    <em>This slot is occupied as part of a multi-slot item.</em>
                  ) : (
                    <em>No item equipped.</em>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      </section>

      <section className="equipment-subsection">
        <div className="equipment-subsection-head">
          <h3>Items</h3>
          <div className="inventory-header equipment-money-row">
            <span>Money</span>
            {isSheetEditMode ? (
              <input
                className="badge-input equipment-money-input"
                type="number"
                value={sheetState.money}
                onChange={(event) =>
                  onUpdateMoney(event.target.value === "" ? 0 : Number.parseInt(event.target.value, 10))
                }
              />
            ) : (
              <strong>{sheetState.money}</strong>
            )}
          </div>
        </div>

        {unequippedReferencedItems.length === 0 ? (
          <p className="empty-block-copy">
            No unequipped items linked to this character. Create and assign items from the DM item workflow.
          </p>
        ) : (
          <div className="equipment-compact-list">
            {unequippedReferencedItems.map((item) => {
              const hasOwnedItemCard = ownedItemCardIds.has(item.id);
              const canShowBonusDetails = canViewerSeeItemBonusDetails(
                item,
                characterId,
                hasOwnedItemCard,
                revealAllItemBonusDetails
              );
              const visibleBonusNotes = canShowBonusDetails ? [...item.bonusProfile.notes] : [];
              const canIdentify =
                !hasOwnedItemCard &&
                canCharacterIdentifyItem(item, artifactAppraisalLevel);
              const equippedSlots = (sheetState.equipment ?? [])
                .filter((entry) => entry.itemId === item.id)
                .map((entry) =>
                  isWeaponHandSlotId(entry.slot) ? getWeaponHandSlotLabel(entry.slot) : getEquipmentSlotLabel(entry.slot)
                );
              const isCarried = sheetState.inventoryItemIds.includes(item.id);
              const isEquipped = equippedSlots.length > 0;

              return (
                <div key={item.id} className="equipment-compact-row">
                  <div className="equipment-compact-main">
                    <strong>{item.name}</strong>
                    <span className="equipment-line-detail">
                      {getItemCompactHeaderSummary(item, {
                        ...itemRulesContext,
                        includeBonus: canShowBonusDetails,
                      })}
                    </span>
                    <small className="equipment-state-line">
                      {[
                        getItemStateSummary(
                          item.id,
                          sheetState.ownedItemIds,
                          sheetState.inventoryItemIds
                        ),
                        ...(equippedSlots.length > 0 ? [`Equipped: ${equippedSlots.join(", ")}`] : []),
                      ].join(" | ")}
                    </small>
                  </div>
                  <div className="equipment-read-meta">
                    {visibleBonusNotes.length > 0 ? (
                      <em>{visibleBonusNotes.join(" | ")}</em>
                    ) : item.bonusProfile.notes.length > 0 && !canShowBonusDetails ? (
                      <em>Bonus details hidden.</em>
                    ) : null}
                    <div className="equipment-inline-actions">
                      {isCarried &&
                      !isEquipped &&
                      isHandEquippableItem(item, itemRulesContext) &&
                      !isShieldItem(item, itemRulesContext) ? (
                        <>
                          <button
                            type="button"
                            className="equipment-inline-button"
                            onClick={() => onEquipSharedItem(item.id, "weapon_primary")}
                          >
                            Primary
                          </button>
                          {item.combatSpec?.handsRequired !== 2 ? (
                            <button
                              type="button"
                              className="equipment-inline-button"
                              onClick={() => onEquipSharedItem(item.id, "weapon_secondary")}
                            >
                              Secondary
                            </button>
                          ) : null}
                        </>
                      ) : null}
                      {isCarried && !isEquipped && isShieldItem(item, itemRulesContext) ? (
                        <button
                          type="button"
                          className="equipment-inline-button"
                          onClick={() => onEquipSharedItem(item.id, "weapon_secondary")}
                        >
                          Equip
                        </button>
                      ) : null}
                      {isCarried &&
                      !isEquipped &&
                      canEquipIntoVisibleNonHandSlot(
                        item,
                        itemRulesContext,
                        enabledSupplementarySlotIdSet
                      ) ? (
                        <button
                          type="button"
                          className="equipment-inline-button"
                          onClick={() => onEquipSharedItem(item.id)}
                        >
                          Equip
                        </button>
                      ) : null}
                      {!revealAllItemBonusDetails && !hasOwnedItemCard ? (
                        <div className="equipment-inline-actions">
                          <button
                            type="button"
                            className="equipment-inline-button"
                            disabled={!canIdentify}
                            onClick={() => onIdentifySharedItem(item.id)}
                          >
                            Identify
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </article>
  );
}
