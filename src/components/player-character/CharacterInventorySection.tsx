import type { CharacterDraft } from "../../config/characterTemplate";
import {
  ITEM_BLUEPRINT_OPTIONS,
  canCharacterIdentifyItem,
  getEquipmentEntryBySlot,
  getItemBaseVisibleStats,
  getItemPropertyPoints,
  getItemTierLabel,
  getOtherEquipmentEntries,
  getWeaponHandSlotLabel,
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
  WeaponHandSlotId,
} from "../../types/items.ts";
import { WEAPON_HAND_SLOT_IDS, isWeaponHandSlotId } from "../../types/items.ts";
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
  inventoryItemIds: string[],
  activeItemIds: string[]
): string {
  return [
    ownedItemIds.includes(itemId) ? "Owned" : "Not owned",
    inventoryItemIds.includes(itemId) ? "Carried" : "Not carried",
    activeItemIds.includes(itemId) ? "Active" : "Inactive",
  ].join(" | ");
}

type CharacterInventorySectionProps = {
  characterId: string;
  sheetState: CharacterDraft;
  itemsById: Record<string, SharedItemRecord>;
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
  onEquipSharedItem,
  onUnequipSharedItem,
  onUpdateWeaponHandSlotItem,
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
  const sortedReferencedItems = sortItemsByName(referencedItems);
  const weaponHandEntries = WEAPON_HAND_SLOT_IDS.map((slotId) => ({
    slotId,
    label: getWeaponHandSlotLabel(slotId),
    entry: getEquipmentEntryBySlot(sheetState, slotId),
  }));
  const otherEquipmentEntries = getOtherEquipmentEntries(sheetState);

  return (
    <article className="sheet-card equipment-card">
      <p className="section-kicker">Character Gear</p>
      <h2>Equipment</h2>

      <section className="equipment-subsection">
        <div className="equipment-subsection-head">
          <h3>Loadout</h3>
        </div>
        <div className="equipment-compact-list">
          {weaponHandEntries.map(({ slotId, label, entry }) => {
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
                    onChange={(event) => onUpdateWeaponHandSlotItem(slotId, event.target.value)}
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
                  <em>{item ? getItemBaseVisibleStats(item).join(" | ") : "No item equipped."}</em>
                </div>
              </div>
            );
          })}

          {isSheetEditMode ? (
            <>
              {otherEquipmentEntries.map((entry) => {
                const index = sheetState.equipment.indexOf(entry);
                return (
                  <div
                    key={`${entry.slot}-${index}`}
                    className="equipment-compact-row equipment-compact-row-edit"
                  >
                    <div className="equipment-inline-controls equipment-inline-controls-wide">
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
                        {sortedReferencedItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="equipment-inline-actions">
                      <button
                        type="button"
                        className="equipment-inline-button"
                        onClick={() => onRemoveEquipmentEntry(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="equipment-inline-actions">
                <button type="button" className="flow-secondary" onClick={onAddEquipmentEntry}>
                  Add Other Slot
                </button>
              </div>
            </>
          ) : otherEquipmentEntries.length === 0 &&
            weaponHandEntries.every(({ entry }) => !entry?.itemId) ? (
            <p className="empty-block-copy">No loadout equipped.</p>
          ) : (
            otherEquipmentEntries.map((entry, index) => {
              const item =
                entry.itemId && itemsById[entry.itemId] ? itemsById[entry.itemId] : null;

              return (
                <div key={`${entry.slot}-${index}`} className="equipment-compact-row">
                  <div className="equipment-compact-main">
                    <strong>{entry.slot || "Open Slot"}</strong>
                    <span className="equipment-line-detail">{item?.name ?? "Unassigned Item"}</span>
                  </div>
                  <div className="equipment-read-meta">
                    <em>{item ? getItemBaseVisibleStats(item).join(" | ") : "No item assigned."}</em>
                  </div>
                </div>
              );
            })
          )}
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
                        {ITEM_BLUEPRINT_OPTIONS.map((option) => (
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
        ) : sortedReferencedItems.length === 0 ? (
          <p className="empty-block-copy">No shared items linked to this character.</p>
        ) : (
          <div className="equipment-compact-list">
            {sortedReferencedItems.map((item) => {
              const visibleBonusNotes = getVisibleItemBonusNotes(item, characterId);
              const hasLearned = hasCharacterLearnedItem(item, characterId);
              const isVisible = isItemBonusVisibleToCharacter(item, characterId);
              const canIdentify = hasLearned || canCharacterIdentifyItem(item, artifactAppraisalLevel);
              const baseSummary = getItemBaseVisibleStats(item).join(" | ") || "No base stats listed.";
              const equippedSlots = (sheetState.equipment ?? [])
                .filter((entry) => entry.itemId === item.id)
                .map((entry) =>
                  isWeaponHandSlotId(entry.slot) ? getWeaponHandSlotLabel(entry.slot) : entry.slot
                );
              const isCarried = sheetState.inventoryItemIds.includes(item.id);
              const isEquipped = equippedSlots.length > 0;

              return (
                <div key={item.id} className="equipment-compact-row">
                  <div className="equipment-compact-main">
                    <strong>{item.name}</strong>
                    <span className="equipment-line-detail">{baseSummary}</span>
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
                    <em>
                      {visibleBonusNotes.length > 0
                        ? visibleBonusNotes.join(" | ")
                        : item.bonusProfile.notes.length > 0
                          ? "Bonus details hidden."
                          : "No bonus properties."}
                    </em>
                    <div className="equipment-inline-actions">
                      {isCarried && !isEquipped && item.category === "weapon" ? (
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
                      {isCarried && !isEquipped && item.category !== "weapon" ? (
                        <button
                          type="button"
                          className="equipment-inline-button"
                          onClick={() => onEquipSharedItem(item.id)}
                        >
                          Equip
                        </button>
                      ) : null}
                      {isEquipped ? (
                        <button
                          type="button"
                          className="equipment-inline-button"
                          onClick={() => onUnequipSharedItem(item.id)}
                        >
                          Unequip
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
