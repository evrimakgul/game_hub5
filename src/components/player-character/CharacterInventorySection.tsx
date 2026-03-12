import type { CharacterDraft } from "../../config/characterTemplate";

type CharacterInventorySectionProps = {
  sheetState: CharacterDraft;
  isSheetEditMode: boolean;
  onUpdateEquipmentEntry: (index: number, field: "slot" | "item" | "effect", value: string) => void;
  onAddEquipmentEntry: () => void;
  onRemoveEquipmentEntry: (index: number) => void;
  onUpdateInventoryEntry: (index: number, field: "name" | "category" | "note", value: string) => void;
  onAddInventoryEntry: () => void;
  onRemoveInventoryEntry: (index: number) => void;
  onUpdateMoney: (value: number) => void;
};

export function CharacterInventorySection({
  sheetState,
  isSheetEditMode,
  onUpdateEquipmentEntry,
  onAddEquipmentEntry,
  onRemoveEquipmentEntry,
  onUpdateInventoryEntry,
  onAddInventoryEntry,
  onRemoveInventoryEntry,
  onUpdateMoney,
}: CharacterInventorySectionProps) {
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
                    <input
                      className="sheet-meta-input"
                      value={entry.item}
                      onChange={(event) => onUpdateEquipmentEntry(index, "item", event.target.value)}
                      placeholder="Item"
                    />
                    <input
                      className="sheet-meta-input"
                      value={entry.effect}
                      onChange={(event) => onUpdateEquipmentEntry(index, "effect", event.target.value)}
                      placeholder="Effect"
                    />
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
            sheetState.equipment.map((entry) => (
              <div key={entry.slot} className="equipment-row">
                <div>
                  <strong>{entry.slot}</strong>
                  <span>{entry.item}</span>
                </div>
                <em>{entry.effect}</em>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="sheet-card inventory-card">
        <p className="section-kicker">Owned Items</p>
        <h2>Inventory</h2>
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
        <div className="inventory-list">
          {isSheetEditMode ? (
            <>
              {sheetState.inventory.map((entry, index) => (
                <div key={`${entry.name}-${index}`} className="inventory-row">
                  <div className="row-main">
                    <input
                      className="sheet-meta-input"
                      value={entry.name}
                      onChange={(event) => onUpdateInventoryEntry(index, "name", event.target.value)}
                      placeholder="Item name"
                    />
                    <input
                      className="sheet-meta-input"
                      value={entry.category}
                      onChange={(event) => onUpdateInventoryEntry(index, "category", event.target.value)}
                      placeholder="Category"
                    />
                    <input
                      className="sheet-meta-input"
                      value={entry.note}
                      onChange={(event) => onUpdateInventoryEntry(index, "note", event.target.value)}
                      placeholder="Notes"
                    />
                  </div>
                  <div className="row-actions">
                    <button type="button" onClick={() => onRemoveInventoryEntry(index)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="flow-secondary" onClick={onAddInventoryEntry}>
                Add Item
              </button>
            </>
          ) : sheetState.inventory.length === 0 ? (
            <p className="empty-block-copy">No items in inventory.</p>
          ) : (
            sheetState.inventory.map((entry) => (
              <div key={entry.name} className="inventory-row">
                <div>
                  <strong>{entry.name}</strong>
                  <span>{entry.category}</span>
                </div>
                <em>{entry.note}</em>
              </div>
            ))
          )}
        </div>
      </article>
    </>
  );
}
