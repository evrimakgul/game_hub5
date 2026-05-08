import type { CharacterDraft } from "../../config/characterTemplate";
import { getCurrentStatValue } from "../../config/characterRuntime.ts";
import {
  canCharacterIdentifyItem,
  canViewerSeeItemBonusDetails,
  getEquipmentEntryBySlot,
  getEquipmentSlotLabel,
  getEquipmentSlotOccupancy,
  getItemAllowedEquipSlots,
  getItemCompactHeaderSummary,
  getItemMechanicalRole,
  getViewerFacingItemRecord,
  getWeaponHandSlotLabel,
} from "../../lib/items.ts";
import type {
  CanonicalEquipmentSlotId,
  ItemBlueprintRecord,
  ItemCategoryDefinition,
  ItemSubcategoryDefinition,
  MainEquipmentSlotId,
  SharedItemRecord,
  SupplementaryEquipmentSlotId,
  WeaponHandSlotId,
} from "../../types/items.ts";
import {
  CHARACTER_LOADOUT_SLOT_IDS,
  isMainEquipmentSlotId,
  isSupplementaryEquipmentSlotId,
  isWeaponHandSlotId,
} from "../../types/items.ts";

function sortItemsByName(items: SharedItemRecord[]): SharedItemRecord[] {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function getItemStateSummary(
  itemId: string,
  ownedItemIds: string[],
  inventoryItemIds: string[],
  activeItemIds: string[]
): string {
  return [
    ownedItemIds.includes(itemId) ? "Owned" : "Not owned",
    inventoryItemIds.includes(itemId) ? "Carried" : "Not carried",
    activeItemIds.includes(itemId) ? "Active" : "Inactive",
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

function isCharmInventoryBuffItem(item: SharedItemRecord): boolean {
  return item.category === "charm" || item.subtype === "talisman" || item.blueprintId === "charm:talisman";
}

function canEquipItemIntoSlot(
  item: SharedItemRecord,
  slotId: CanonicalEquipmentSlotId,
  itemRulesContext: {
    itemBlueprints: ItemBlueprintRecord[];
    itemCategoryDefinitions: ItemCategoryDefinition[];
    itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  }
): boolean {
  return getItemAllowedEquipSlots(item, itemRulesContext).includes(slotId);
}

function canCharacterMeetItemStrengthRequirement(
  sheetState: CharacterDraft,
  item: SharedItemRecord,
  itemsById: Record<string, SharedItemRecord>
): boolean {
  const minimumStrength = item.combatSpec?.minimumStrength;
  if (typeof minimumStrength !== "number") {
    return true;
  }

  return getCurrentStatValue(sheetState, "STR", itemsById) >= minimumStrength;
}

type CharacterInventorySectionProps = {
  characterId: string;
  sheetState: CharacterDraft;
  itemsById: Record<string, SharedItemRecord>;
  itemBlueprints: ItemBlueprintRecord[];
  itemCategoryDefinitions: ItemCategoryDefinition[];
  itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  ownedCurrentItemCardIds: Set<string>;
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
  onUpdateSharedItemActiveState: (itemId: string, isActive: boolean) => void;
  onUpdateMoney: (value: number) => void;
  onOpenAuctionHouse?: (() => void) | null;
};

export function CharacterInventorySection({
  characterId,
  sheetState,
  itemsById,
  itemBlueprints,
  itemCategoryDefinitions,
  itemSubcategoryDefinitions,
  ownedCurrentItemCardIds,
  revealAllItemBonusDetails,
  artifactAppraisalLevel,
  isSheetEditMode,
  onIdentifySharedItem,
  onEquipSharedItem,
  onUnequipSharedItem,
  onUpdateWeaponHandSlotItem,
  onUpdateMainEquipmentSlotItem,
  onUpdateSupplementaryEquipmentSlotItem,
  onUpdateSharedItemActiveState,
  onUpdateMoney,
  onOpenAuctionHouse,
}: CharacterInventorySectionProps) {
  const itemRulesContext = {
    itemBlueprints,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
  };
  const referencedItemIds = [
    ...new Set([
      ...(sheetState.ownedItemIds ?? []),
      ...(sheetState.inventoryItemIds ?? []),
      ...(sheetState.activeItemIds ?? []),
      ...(sheetState.equipment ?? [])
        .map((entry) => entry.itemId)
        .filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
    ]),
  ];
  const referencedItems = referencedItemIds
    .map((itemId) => itemsById[itemId])
    .filter((item): item is SharedItemRecord => item !== undefined);
  const sortedReferencedItems = sortItemsByName(referencedItems);
  const equippedItemIds = new Set(
    (sheetState.equipment ?? [])
      .map((entry) => entry.itemId)
      .filter((itemId): itemId is string => typeof itemId === "string" && itemId.trim().length > 0)
  );
  const inventoryItemIdSet = new Set(sheetState.inventoryItemIds ?? []);
  const activeItemIdSet = new Set(sheetState.activeItemIds ?? []);
  const loadoutEntries = CHARACTER_LOADOUT_SLOT_IDS.map((slotId) => ({
    slotId,
    label: getEquipmentSlotLabel(slotId),
    entry: getEquipmentEntryBySlot(sheetState, slotId),
    occupancy: getEquipmentSlotOccupancy(sheetState, slotId, itemsById, itemRulesContext),
  }));
  const displayedItems = sortedReferencedItems.filter(
    (item) => inventoryItemIdSet.has(item.id) && !equippedItemIds.has(item.id)
  );
  const currentStrength = getCurrentStatValue(sheetState, "STR", itemsById);

  function updateEquipmentSlotItem(slotId: CanonicalEquipmentSlotId, itemId: string): void {
    if (isWeaponHandSlotId(slotId)) {
      onUpdateWeaponHandSlotItem(slotId, itemId);
      return;
    }

    if (isMainEquipmentSlotId(slotId)) {
      onUpdateMainEquipmentSlotItem(slotId, itemId);
      return;
    }

    if (isSupplementaryEquipmentSlotId(slotId)) {
      onUpdateSupplementaryEquipmentSlotItem(slotId, itemId);
    }
  }

  function getSlotOptions(
    slotId: CanonicalEquipmentSlotId,
    currentItem: SharedItemRecord | null
  ): SharedItemRecord[] {
    const options = sortedReferencedItems.filter(
      (item) => inventoryItemIdSet.has(item.id) && canEquipItemIntoSlot(item, slotId, itemRulesContext)
    );
    const withCurrent = currentItem && !options.some((item) => item.id === currentItem.id)
      ? [currentItem, ...options]
      : options;

    return [...withCurrent].sort((left, right) => {
      if (currentItem?.id === left.id) return -1;
      if (currentItem?.id === right.id) return 1;
      return left.name.localeCompare(right.name);
    });
  }

  function renderLoadoutSection() {
    return (
      <section className="equipment-subsection character-loadout-detail" key="loadout">
        <div className="equipment-subsection-head">
          <h3>Loadout</h3>
          <span className="equipment-line-detail">Equipped items stay at the top of each slot selector.</span>
        </div>
        <div className="equipment-compact-list loadout-detail-list">
          {loadoutEntries.map(({ slotId, label, entry, occupancy }) => {
            const item = occupancy?.item ?? (entry?.itemId ? itemsById[entry.itemId] ?? null : null);
            const followerAnchorLabel =
              occupancy && !occupancy.isAnchorSlot && occupancy.anchorSlot
                ? getEquipmentSlotLabel(occupancy.anchorSlot)
                : null;
            const hasOwnedCurrentItemCard = item ? ownedCurrentItemCardIds.has(item.id) : false;
            const visibleItem = item
              ? getViewerFacingItemRecord(item, {
                  ...itemRulesContext,
                  hasOwnedItemCard: hasOwnedCurrentItemCard,
                  revealAll: revealAllItemBonusDetails,
                })
              : null;
            const slotOptions = getSlotOptions(slotId, item);
            const canUpdateSlot = !occupancy || occupancy.isAnchorSlot;

            return (
              <div
                key={slotId}
                className={`equipment-compact-row loadout-slot-row ${item ? "is-equipped" : "is-open"}`}
              >
                <div className="equipment-compact-main">
                  <strong>{label}</strong>
                  <span className="equipment-line-detail">
                    {occupancy && !occupancy.isAnchorSlot
                      ? `Occupied by ${visibleItem?.name ?? "equipped item"}`
                      : visibleItem?.name ?? "Open Slot"}
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
                      const displayItem = visibleItem ?? item;
                      const canShowBonusDetails = canViewerSeeItemBonusDetails(
                        item,
                        characterId,
                        hasOwnedCurrentItemCard,
                        revealAllItemBonusDetails
                      );
                      const canIdentify = canCharacterIdentifyItem(item, artifactAppraisalLevel);

                      return (
                        <>
                          <em>
                            {getItemCompactHeaderSummary(displayItem, {
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
                            {!revealAllItemBonusDetails &&
                            !hasOwnedCurrentItemCard &&
                            canIdentify ? (
                              <button
                                type="button"
                                className="equipment-inline-button"
                                onClick={() => onIdentifySharedItem(item.id)}
                              >
                                Artifact Appraisal
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
                  {canUpdateSlot ? (
                    <label className="equipment-slot-select">
                      <span>Equip to {label}</span>
                      <select
                        value={item?.id ?? ""}
                        onChange={(event) => updateEquipmentSlotItem(slotId, event.target.value)}
                      >
                        <option value="">Open Slot</option>
                        {slotOptions.map((optionItem) => {
                          const optionKnown = ownedCurrentItemCardIds.has(optionItem.id);
                          const optionVisibleItem = getViewerFacingItemRecord(optionItem, {
                            ...itemRulesContext,
                            hasOwnedItemCard: optionKnown,
                            revealAll: revealAllItemBonusDetails,
                          });
                          return (
                            <option key={optionItem.id} value={optionItem.id}>
                              {optionVisibleItem.name}
                              {optionItem.id === item?.id ? " (equipped)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  function renderItemsSection() {
    return (
      <section className="equipment-subsection" key="items">
        <div className="equipment-subsection-head">
          <h3>Inventory</h3>
          <div className="inventory-header equipment-money-row">
            {onOpenAuctionHouse ? (
              <button type="button" className="flow-secondary" onClick={onOpenAuctionHouse}>
                Auction House
              </button>
            ) : null}
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

        {displayedItems.length === 0 ? (
          <p className="empty-block-copy">
            No linked inventory items. Create and assign items from the DM item workflow.
          </p>
        ) : (
          <div className="equipment-compact-list inventory-detail-list">
            {displayedItems.map((item) => {
              const hasOwnedCurrentItemCard = ownedCurrentItemCardIds.has(item.id);
              const visibleItem = getViewerFacingItemRecord(item, {
                ...itemRulesContext,
                hasOwnedItemCard: hasOwnedCurrentItemCard,
                revealAll: revealAllItemBonusDetails,
              });
              const canShowBonusDetails = canViewerSeeItemBonusDetails(
                item,
                characterId,
                hasOwnedCurrentItemCard,
                revealAllItemBonusDetails
              );
              const visibleBonusNotes = canShowBonusDetails ? [...item.bonusProfile.notes] : [];
              const canIdentify = canCharacterIdentifyItem(item, artifactAppraisalLevel);
              const equippedSlots = (sheetState.equipment ?? [])
                .filter((entry) => entry.itemId === item.id)
                .map((entry) =>
                  isWeaponHandSlotId(entry.slot)
                    ? getWeaponHandSlotLabel(entry.slot)
                    : getEquipmentSlotLabel(entry.slot)
                );
              const isCarried = inventoryItemIdSet.has(item.id);
              const isEquipped = equippedSlots.length > 0;
              const isActive = activeItemIdSet.has(item.id);
              const meetsStrengthRequirement = canCharacterMeetItemStrengthRequirement(
                sheetState,
                item,
                itemsById
              );
              const strengthRequirementHint =
                typeof item.combatSpec?.minimumStrength === "number" && !meetsStrengthRequirement
                  ? `Requires STR ${item.combatSpec.minimumStrength}. Current STR ${currentStrength}.`
                  : undefined;
              const allowedSlots = getItemAllowedEquipSlots(item, itemRulesContext);
              const nonHandAllowedSlots = allowedSlots.filter(
                (slot): slot is CanonicalEquipmentSlotId => !isWeaponHandSlotId(slot)
              );

              return (
                <div
                  key={item.id}
                  className={`equipment-compact-row inventory-item-row ${isEquipped ? "is-equipped" : ""}`}
                >
                  <div className="equipment-compact-main">
                    <strong>{visibleItem.name}</strong>
                    <span className="equipment-line-detail">
                      {getItemCompactHeaderSummary(visibleItem, {
                        ...itemRulesContext,
                        includeBonus: canShowBonusDetails,
                      })}
                    </span>
                    <small className="equipment-state-line">
                      {[
                        getItemStateSummary(
                          item.id,
                          sheetState.ownedItemIds,
                          sheetState.inventoryItemIds,
                          sheetState.activeItemIds
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
                      {isEquipped ? (
                        <button
                          type="button"
                          className="equipment-inline-button"
                          onClick={() => onUnequipSharedItem(item.id)}
                        >
                          Unequip
                        </button>
                      ) : null}
                      {isCarried &&
                      !isEquipped &&
                      isHandEquippableItem(item, itemRulesContext) &&
                      !isShieldItem(item, itemRulesContext) ? (
                        <>
                          {allowedSlots.includes("weapon_primary") ? (
                            <button
                              type="button"
                              className="equipment-inline-button"
                              disabled={!meetsStrengthRequirement}
                              title={strengthRequirementHint}
                              onClick={() => onEquipSharedItem(item.id, "weapon_primary")}
                            >
                              Primary
                            </button>
                          ) : null}
                          {allowedSlots.includes("weapon_secondary") &&
                          item.combatSpec?.handsRequired !== 2 ? (
                            <button
                              type="button"
                              className="equipment-inline-button"
                              disabled={!meetsStrengthRequirement}
                              title={strengthRequirementHint}
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
                          disabled={!meetsStrengthRequirement}
                          title={strengthRequirementHint}
                          onClick={() => onEquipSharedItem(item.id, "weapon_secondary")}
                        >
                          Equip
                        </button>
                      ) : null}
                      {isCarried && !isEquipped
                        ? nonHandAllowedSlots.map((slotId) => (
                            <button
                              key={slotId}
                              type="button"
                              className="equipment-inline-button"
                              disabled={!meetsStrengthRequirement}
                              title={strengthRequirementHint}
                              onClick={() => onEquipSharedItem(item.id, slotId)}
                            >
                              {getEquipmentSlotLabel(slotId)}
                            </button>
                          ))
                        : null}
                      {isCarried && isCharmInventoryBuffItem(item) ? (
                        <button
                          type="button"
                          className={`equipment-inline-button ${isActive ? "is-active" : ""}`}
                          onClick={() => onUpdateSharedItemActiveState(item.id, !isActive)}
                        >
                          {isActive ? "Deactivate" : "Activate"}
                        </button>
                      ) : null}
                      {!revealAllItemBonusDetails && !hasOwnedCurrentItemCard && canIdentify ? (
                        <button
                          type="button"
                          className="equipment-inline-button"
                          onClick={() => onIdentifySharedItem(item.id)}
                        >
                          Artifact Appraisal
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <article className="sheet-card equipment-card equipment-card-inventory">
      <p className="section-kicker">Loadout / Inventory</p>
      <h2>Inventory</h2>
      {renderLoadoutSection()}
      {renderItemsSection()}
    </article>
  );
}
