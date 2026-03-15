import type { CharacterDraft } from "../../config/characterTemplate";
import {
  ITEM_BLUEPRINT_OPTIONS,
  canCharacterIdentifyItem,
  getItemBaseVisibleStats,
  getItemBlueprintId,
  getVisibleItemBonusNotes,
  hasCharacterLearnedItem,
  isItemBonusVisibleToCharacter,
} from "../../lib/items.ts";
import type {
  EquipmentReferenceField,
} from "../../mutations/characterItemMutations.ts";
import type {
  ItemBlueprintId,
  ItemDerivedModifierId,
  SharedItemRecord,
} from "../../types/items.ts";
import type { StatId } from "../../types/character";

const STAT_BONUS_FIELDS: StatId[] = ["STR", "DEX", "STAM", "CHA", "APP", "MAN", "INT", "WITS", "PER"];
const DERIVED_BONUS_FIELDS: Array<{ id: ItemDerivedModifierId; label: string }> = [
  { id: "max_hp", label: "Max HP" },
  { id: "max_mana", label: "Max Mana" },
  { id: "initiative", label: "Initiative" },
  { id: "attack_dice_bonus", label: "Attack Dice" },
  { id: "melee_attack", label: "Melee Attack" },
  { id: "ranged_attack", label: "Ranged Attack" },
  { id: "armor_class", label: "AC" },
  { id: "damage_reduction", label: "DR" },
  { id: "soak", label: "Soak" },
  { id: "melee_damage", label: "Melee Damage" },
  { id: "ranged_damage", label: "Ranged Damage" },
];

type CharacterInventorySectionProps = {
  characterId: string;
  sheetState: CharacterDraft;
  itemsById: Record<string, SharedItemRecord>;
  artifactAppraisalLevel: number;
  isSheetEditMode: boolean;
  onCreateSharedItem: (blueprintId: ItemBlueprintId) => void;
  onUpdateSharedItemField: (
    itemId: string,
    field: "name" | "itemLevel" | "qualityTier" | "baseDescription",
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
  onUpdateEquipmentEntry: (index: number, field: EquipmentReferenceField, value: string) => void;
  onAddEquipmentEntry: () => void;
  onRemoveEquipmentEntry: (index: number) => void;
  onUpdateMoney: (value: number) => void;
};

export function CharacterInventorySection({
  characterId,
  sheetState,
  itemsById,
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
  onUpdateEquipmentEntry,
  onAddEquipmentEntry,
  onRemoveEquipmentEntry,
  onUpdateMoney,
}: CharacterInventorySectionProps) {
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

  return (
    <>
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
                      onChange={(event) => onUpdateEquipmentEntry(index, "slot", event.target.value)}
                      placeholder="Slot"
                    />
                    <select
                      className="sheet-meta-input"
                      value={entry.itemId ?? ""}
                      onChange={(event) => onUpdateEquipmentEntry(index, "itemId", event.target.value)}
                    >
                      <option value="">No item</option>
                      {referencedItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="row-actions">
                    <button type="button" onClick={() => onRemoveEquipmentEntry(index)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="flow-secondary" onClick={onAddEquipmentEntry}>
                Add Equipment
              </button>
            </>
          ) : sheetState.equipment.length === 0 ? (
            <p className="empty-block-copy">No loadout equipped.</p>
          ) : (
            sheetState.equipment.map((entry, index) => {
              const item =
                entry.itemId && itemsById[entry.itemId] ? itemsById[entry.itemId] : null;

              return (
                <div key={`${entry.slot}-${index}`} className="equipment-row">
                  <div>
                    <strong>{entry.slot || "Open Slot"}</strong>
                    <span>{item?.name ?? "Unassigned Item"}</span>
                  </div>
                  <em>{item ? getItemBaseVisibleStats(item).join(" | ") : ""}</em>
                </div>
              );
            })
          )}
        </div>
      </article>

      <article className="sheet-card inventory-card">
        <p className="section-kicker">Shared Item Records</p>
        <h2>Items</h2>
        <div className="inventory-header">
          <span>Money</span>
          {isSheetEditMode ? (
            <input
              className="badge-input"
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

        {isSheetEditMode ? (
          <div className="inventory-list">
            <div className="row-actions">
              {ITEM_BLUEPRINT_OPTIONS.map((option) => (
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

            {referencedItems.length === 0 ? (
              <p className="empty-block-copy">No shared items linked to this character.</p>
            ) : (
              referencedItems.map((item) => (
                <div key={item.id} className="inventory-row">
                  <div className="row-main">
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
                      {ITEM_BLUEPRINT_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="sheet-meta-input"
                      type="number"
                      min="1"
                      value={item.itemLevel}
                      onChange={(event) =>
                        onUpdateSharedItemField(item.id, "itemLevel", event.target.value)
                      }
                      placeholder="Item level"
                    />
                    <input
                      className="sheet-meta-input"
                      value={item.qualityTier ?? ""}
                      onChange={(event) =>
                        onUpdateSharedItemField(item.id, "qualityTier", event.target.value)
                      }
                      placeholder="Quality tier"
                    />
                    <input
                      className="sheet-meta-input"
                      value={item.baseDescription}
                      onChange={(event) =>
                        onUpdateSharedItemField(item.id, "baseDescription", event.target.value)
                      }
                      placeholder="Base description"
                    />
                  </div>
                  <div className="row-main">
                    <label>
                      <input
                        type="checkbox"
                        checked={sheetState.ownedItemIds.includes(item.id)}
                        onChange={(event) =>
                          onUpdateSharedItemOwnedState(item.id, event.target.checked)
                        }
                      />
                      Owned
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={sheetState.inventoryItemIds.includes(item.id)}
                        onChange={(event) =>
                          onUpdateSharedItemInventoryState(item.id, event.target.checked)
                        }
                      />
                      Carrying
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={sheetState.activeItemIds.includes(item.id)}
                        onChange={(event) =>
                          onUpdateSharedItemActiveState(item.id, event.target.checked)
                        }
                      />
                      Active
                    </label>
                  </div>
                  <textarea
                    className="sheet-meta-input"
                    value={item.bonusProfile.notes.join("\n")}
                    onChange={(event) => onUpdateSharedItemBonusNotes(item.id, event.target.value)}
                    placeholder="Hidden bonus notes, one per line"
                  />
                  <div className="inventory-row">
                    <div className="row-main">
                      {STAT_BONUS_FIELDS.map((statId) => (
                        <label key={`${item.id}:${statId}`}>
                          {statId}
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
                  </div>
                  <div className="inventory-row">
                    <div className="row-main">
                      {DERIVED_BONUS_FIELDS.map((field) => (
                        <label key={`${item.id}:${field.id}`}>
                          {field.label}
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
                  <div className="row-actions">
                    <button type="button" onClick={() => onDeleteSharedItem(item.id)}>
                      Delete Item
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : referencedItems.length === 0 ? (
          <p className="empty-block-copy">No shared items linked to this character.</p>
        ) : (
          <div className="inventory-list">
            {referencedItems.map((item) => {
              const visibleBonusNotes = getVisibleItemBonusNotes(item, characterId);
              const hasLearned = hasCharacterLearnedItem(item, characterId);
              const isVisible = isItemBonusVisibleToCharacter(item, characterId);
              const canIdentify = hasLearned || canCharacterIdentifyItem(item, artifactAppraisalLevel);

              return (
                <div key={item.id} className="inventory-row">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{getItemBaseVisibleStats(item).join(" | ") || "No base stats listed."}</span>
                  </div>
                  <em>
                    {visibleBonusNotes.length > 0
                      ? visibleBonusNotes.join(" | ")
                      : item.bonusProfile.notes.length > 0
                        ? "Bonus details hidden."
                        : "No bonus properties."}
                  </em>
                  <small>
                    {sheetState.ownedItemIds.includes(item.id) ? "Owned" : "Not owned"} |{" "}
                    {sheetState.inventoryItemIds.includes(item.id) ? "Carried" : "Not carried"} |{" "}
                    {sheetState.activeItemIds.includes(item.id) ? "Active" : "Inactive"}
                  </small>
                  <div className="row-actions">
                    {isVisible ? (
                      <button type="button" onClick={() => onMaskSharedItem(item.id)}>
                        Mask
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canIdentify}
                        onClick={() => onIdentifySharedItem(item.id)}
                      >
                        Identify
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </>
  );
}
