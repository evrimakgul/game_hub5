import type { CharacterDraft } from "../../config/characterTemplate";
import {
  canCharacterIdentifyItem,
  getEquipmentSlotLabel,
  getEquipmentEntryBySlot,
  getItemAllowedEquipSlots,
  getItemCompactHeaderSummary,
  getItemMechanicalRole,
  getItemPropertyPoints,
  getItemTierLabel,
  getWeaponHandSlotLabel,
  getItemBlueprintId,
  getVisibleItemBonusNotes,
  hasCharacterLearnedItem,
  isItemBonusVisibleToCharacter,
} from "../../lib/items.ts";
import type {
  ItemBlueprintId,
  ItemBlueprintRecord,
  ItemCategoryDefinition,
  ItemDerivedModifierId,
  MainEquipmentSlotId,
  ItemSubcategoryDefinition,
  SharedItemRecord,
  WeaponHandSlotId,
} from "../../types/items.ts";
import { MAIN_EQUIPMENT_SLOT_IDS, isWeaponHandSlotId } from "../../types/items.ts";
import type { StatId } from "../../types/character";

const STAT_BONUS_FIELDS: StatId[] = ["STR", "DEX", "STAM", "CHA", "APP", "MAN", "INT", "WITS", "PER"];
const DERIVED_BONUS_FIELDS: Array<{ id: ItemDerivedModifierId; label: string }> = [
  { id: "max_hp", label: "Max HP" },
  { id: "max_mana", label: "Max Mana" },
  { id: "initiative", label: "Initiative" },
  { id: "inspiration", label: "Inspiration" },
  { id: "attack_dice_bonus", label: "Attack Dice" },
  { id: "melee_attack", label: "Melee Attack" },
  { id: "ranged_attack", label: "Ranged Attack" },
  { id: "armor_class", label: "AC" },
  { id: "damage_reduction", label: "DR" },
  { id: "soak", label: "Soak" },
  { id: "melee_damage", label: "Melee Damage" },
  { id: "ranged_damage", label: "Ranged Damage" },
];

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

function isMainSlotEquipItem(
  item: SharedItemRecord,
  itemRulesContext: {
    itemBlueprints: ItemBlueprintRecord[];
    itemCategoryDefinitions: ItemCategoryDefinition[];
    itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  }
): boolean {
  return getItemAllowedEquipSlots(item, itemRulesContext).some(
    (slot) =>
      slot === "body" ||
      slot === "neck" ||
      slot === "head" ||
      slot === "ring_left" ||
      slot === "ring_right"
  );
}

type CharacterInventorySectionProps = {
  characterId: string;
  sheetState: CharacterDraft;
  itemsById: Record<string, SharedItemRecord>;
  itemBlueprints: ItemBlueprintRecord[];
  itemCategoryDefinitions: ItemCategoryDefinition[];
  itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  blueprintOptions: Array<{
    id: ItemBlueprintId;
    category: string;
    subtype: string;
    categoryDefinitionId: string;
    subcategoryDefinitionId: string;
    label: string;
    isLegacy?: boolean;
  }>;
  artifactAppraisalLevel: number;
  isSheetEditMode: boolean;
  onCreateSharedItem: (blueprintId: ItemBlueprintId) => void;
  onUpdateSharedItemField: (
    itemId: string,
    field: "name" | "baseDescription",
    value: string
  ) => void;
  onUpdateSharedItemBlueprint: (itemId: string, blueprintId: ItemBlueprintId) => void;
  onUpdateSharedItemBonusNotes: (itemId: string, value: string) => void;
  onUpdateSharedItemStatBonus: (itemId: string, statId: StatId, value: string) => void;
  onUpdateSharedItemDerivedBonus: (
    itemId: string,
    targetId: ItemDerivedModifierId,
    value: string
  ) => void;
  onUpdateSharedItemOwnedState: (itemId: string, isOwned: boolean) => void;
  onUpdateSharedItemInventoryState: (itemId: string, isCarried: boolean) => void;
  onUpdateSharedItemActiveState: (itemId: string, isActive: boolean) => void;
  onIdentifySharedItem: (itemId: string) => void;
  onMaskSharedItem: (itemId: string) => void;
  onDeleteSharedItem: (itemId: string) => void;
  onEquipSharedItem: (itemId: string, slot?: string) => void;
  onUnequipSharedItem: (itemId: string) => void;
  onUpdateWeaponHandSlotItem: (slot: WeaponHandSlotId, itemId: string) => void;
  onUpdateMainEquipmentSlotItem: (slot: MainEquipmentSlotId, itemId: string) => void;
  onUpdateMoney: (value: number) => void;
};

export function CharacterInventorySection({
  characterId,
  sheetState,
  itemsById,
  itemBlueprints,
  itemCategoryDefinitions,
  itemSubcategoryDefinitions,
  blueprintOptions,
  artifactAppraisalLevel,
  isSheetEditMode,
  onCreateSharedItem,
  onUpdateSharedItemField,
  onUpdateSharedItemBlueprint,
  onUpdateSharedItemBonusNotes,
  onUpdateSharedItemStatBonus,
  onUpdateSharedItemDerivedBonus,
  onUpdateSharedItemOwnedState,
  onUpdateSharedItemInventoryState,
  onUpdateSharedItemActiveState,
  onIdentifySharedItem,
  onMaskSharedItem,
  onDeleteSharedItem,
  onEquipSharedItem,
  onUnequipSharedItem,
  onUpdateWeaponHandSlotItem,
  onUpdateMainEquipmentSlotItem,
  onUpdateMoney,
}: CharacterInventorySectionProps) {
  const itemRulesContext = {
    itemBlueprints,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
  };
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
  const mainEquipmentEntries = MAIN_EQUIPMENT_SLOT_IDS.map((slotId) => ({
    slotId,
    label: getEquipmentSlotLabel(slotId),
    entry: getEquipmentEntryBySlot(sheetState, slotId),
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
          {mainEquipmentEntries.map(({ slotId, label, entry }) => {
            const item = entry?.itemId ? itemsById[entry.itemId] ?? null : null;

            return isSheetEditMode ? (
              <div key={slotId} className="equipment-compact-row equipment-compact-row-edit">
                <div className="equipment-compact-main">
                  <strong>{label}</strong>
                </div>
                <div className="equipment-inline-controls">
                  <select
                    className="sheet-meta-input"
                    value={entry?.itemId ?? ""}
                    onChange={(event) =>
                      isWeaponHandSlotId(slotId)
                        ? onUpdateWeaponHandSlotItem(slotId, event.target.value)
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
                      <span className="equipment-line-detail">{item?.name ?? "Open Slot"}</span>
                </div>
                <div className="equipment-read-meta">
                  {item ? (
                    <>
                      <em>{getItemCompactHeaderSummary(item, itemRulesContext)}</em>
                      <div className="equipment-inline-actions">
                        <button
                          type="button"
                          className="equipment-inline-button"
                          onClick={() => onUnequipSharedItem(item.id)}
                        >
                          Unequip
                        </button>
                        {isItemBonusVisibleToCharacter(item, characterId) ? (
                          <button
                            type="button"
                            className="equipment-inline-button"
                            onClick={() => onMaskSharedItem(item.id)}
                          >
                            Mask
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="equipment-inline-button"
                            disabled={
                              !(
                                hasCharacterLearnedItem(item, characterId) ||
                                canCharacterIdentifyItem(item, artifactAppraisalLevel)
                              )
                            }
                            onClick={() => onIdentifySharedItem(item.id)}
                          >
                            Identify
                          </button>
                        )}
                      </div>
                    </>
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

        {isSheetEditMode ? (
          <>
            <div className="equipment-add-row">
              {blueprintOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="flow-secondary"
                  onClick={() => onCreateSharedItem(option.id)}
                >
                  Add {option.label}
                </button>
              ))}
            </div>

            {sortedReferencedItems.length === 0 ? (
              <p className="empty-block-copy">No shared items linked to this character.</p>
            ) : (
              <div className="equipment-item-edit-list">
                {sortedReferencedItems.map((item) => (
                  <div key={item.id} className="equipment-item-edit-row">
                    <div className="equipment-item-edit-grid equipment-item-edit-grid-primary">
                      <input
                        className="sheet-meta-input"
                        value={item.name}
                        onChange={(event) => onUpdateSharedItemField(item.id, "name", event.target.value)}
                        placeholder="Item name"
                      />
                      <select
                        className="sheet-meta-input"
                        value={getItemBlueprintId(item)}
                        onChange={(event) =>
                          onUpdateSharedItemBlueprint(item.id, event.target.value as ItemBlueprintId)
                        }
                      >
                        {blueprintOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        className="sheet-meta-input"
                        value={`PP ${getItemPropertyPoints(item)}`}
                        readOnly
                        aria-label="Property points"
                      />
                      <input
                        className="sheet-meta-input"
                        value={getItemTierLabel(item)}
                        readOnly
                        aria-label="Item tier"
                      />
                    </div>
                    <div className="equipment-item-edit-grid equipment-item-edit-grid-secondary">
                      <input
                        className="sheet-meta-input"
                        value={item.baseDescription}
                        onChange={(event) =>
                          onUpdateSharedItemField(item.id, "baseDescription", event.target.value)
                        }
                        placeholder="Base description"
                      />
                      <label className="equipment-toggle">
                        <input
                          type="checkbox"
                          checked={sheetState.ownedItemIds.includes(item.id)}
                          onChange={(event) =>
                            onUpdateSharedItemOwnedState(item.id, event.target.checked)
                          }
                        />
                        Owned
                      </label>
                      <label className="equipment-toggle">
                        <input
                          type="checkbox"
                          checked={sheetState.inventoryItemIds.includes(item.id)}
                          onChange={(event) =>
                            onUpdateSharedItemInventoryState(item.id, event.target.checked)
                          }
                        />
                        Carrying
                      </label>
                      <label className="equipment-toggle">
                        <input
                          type="checkbox"
                          checked={sheetState.activeItemIds.includes(item.id)}
                          onChange={(event) =>
                            onUpdateSharedItemActiveState(item.id, event.target.checked)
                          }
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        className="equipment-inline-button"
                        onClick={() => onDeleteSharedItem(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                    <textarea
                      className="sheet-meta-input equipment-notes-input"
                      rows={2}
                      value={item.bonusProfile.notes.join("\n")}
                      onChange={(event) => onUpdateSharedItemBonusNotes(item.id, event.target.value)}
                      placeholder="Hidden bonus notes, one per line"
                    />
                    <div className="equipment-bonus-grid">
                      {STAT_BONUS_FIELDS.map((statId) => (
                        <label key={`${item.id}:${statId}`} className="equipment-bonus-field">
                          <span>{statId}</span>
                          <input
                            className="badge-input"
                            type="number"
                            value={item.bonusProfile.statBonuses[statId] ?? ""}
                            onChange={(event) =>
                              onUpdateSharedItemStatBonus(item.id, statId, event.target.value)
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="equipment-bonus-grid equipment-derived-grid">
                      {DERIVED_BONUS_FIELDS.map((field) => (
                        <label key={`${item.id}:${field.id}`} className="equipment-bonus-field">
                          <span>{field.label}</span>
                          <input
                            className="badge-input"
                            type="number"
                            value={item.bonusProfile.derivedBonuses[field.id] ?? ""}
                            onChange={(event) =>
                              onUpdateSharedItemDerivedBonus(item.id, field.id, event.target.value)
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : unequippedReferencedItems.length === 0 ? (
          <p className="empty-block-copy">No unequipped items linked to this character.</p>
        ) : (
          <div className="equipment-compact-list">
            {unequippedReferencedItems.map((item) => {
              const visibleBonusNotes = getVisibleItemBonusNotes(item, characterId);
              const hasLearned = hasCharacterLearnedItem(item, characterId);
              const isVisible = isItemBonusVisibleToCharacter(item, characterId);
              const canIdentify = hasLearned || canCharacterIdentifyItem(item, artifactAppraisalLevel);
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
                      {getItemCompactHeaderSummary(item, itemRulesContext)}
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
                    ) : item.bonusProfile.notes.length > 0 ? (
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
                      {isCarried && !isEquipped && isMainSlotEquipItem(item, itemRulesContext) ? (
                        <button
                          type="button"
                          className="equipment-inline-button"
                          onClick={() => onEquipSharedItem(item.id)}
                        >
                          Equip
                        </button>
                      ) : null}
                      {isVisible ? (
                        <button
                          type="button"
                          className="equipment-inline-button"
                          onClick={() => onMaskSharedItem(item.id)}
                        >
                          Mask
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="equipment-inline-button"
                          disabled={!canIdentify}
                          onClick={() => onIdentifySharedItem(item.id)}
                        >
                          Identify
                        </button>
                      )}
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
