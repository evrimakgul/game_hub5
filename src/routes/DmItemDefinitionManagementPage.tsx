import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { getEquipmentSlotLabel } from "../lib/items.ts";
import { useAppFlow } from "../state/appFlow";
import {
  CANONICAL_EQUIPMENT_SLOT_IDS,
  ITEM_MECHANICAL_ROLES,
  type ItemSubcategoryDefinition,
} from "../types/items.ts";

function sortByName<T extends { id: string; name: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.id.localeCompare(right.id);
  });
}

function formatSlotSummary(definition: ItemSubcategoryDefinition): string {
  const occupiedSlots = [...new Set(definition.occupiedSlots)];
  const allowedSlots = [...new Set(definition.allowedEquipSlots)];
  const slotIds = occupiedSlots.length > 0 ? occupiedSlots : allowedSlots;
  if (slotIds.length === 0) {
    return "Anchor only / none";
  }

  if (
    slotIds.length === 2 &&
    slotIds.includes("weapon_primary") &&
    slotIds.includes("weapon_secondary")
  ) {
    return occupiedSlots.length > 0 ? "Primary Hand + Secondary Hand" : "Hand";
  }

  if (
    slotIds.length === 2 &&
    slotIds.includes("ring_left") &&
    slotIds.includes("ring_right")
  ) {
    return "Left / Right Ring";
  }

  return slotIds.map((slotId) => getEquipmentSlotLabel(slotId)).join(occupiedSlots.length > 0 ? " + " : " / ");
}

export function DmItemDefinitionManagementPage() {
  const navigate = useNavigate();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);
  const [pendingDeleteSubcategoryId, setPendingDeleteSubcategoryId] = useState<string | null>(null);
  const {
    roleChoice,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
    itemBlueprints,
    createItemCategoryDefinition,
    updateItemCategoryDefinition,
    deleteItemCategoryDefinition,
    createItemSubcategoryDefinition,
    updateItemSubcategoryDefinition,
    deleteItemSubcategoryDefinition,
  } = useAppFlow();

  const sortedCategories = useMemo(
    () => sortByName(itemCategoryDefinitions),
    [itemCategoryDefinitions]
  );
  const selectedCategory =
    sortedCategories.find((definition) => definition.id === selectedCategoryId) ??
    sortedCategories[0] ??
    null;
  const categorySubcategories = useMemo(
    () =>
      sortByName(
        itemSubcategoryDefinitions.filter(
          (definition) => definition.categoryId === selectedCategory?.id
        )
      ),
    [itemSubcategoryDefinitions, selectedCategory?.id]
  );
  const selectedSubcategory =
    categorySubcategories.find((definition) => definition.id === selectedSubcategoryId) ??
    categorySubcategories[0] ??
    null;

  useEffect(() => {
    if (selectedCategory && selectedCategory.id !== selectedCategoryId) {
      setSelectedCategoryId(selectedCategory.id);
    }
  }, [selectedCategory, selectedCategoryId]);

  useEffect(() => {
    if (selectedSubcategory && selectedSubcategory.id !== selectedSubcategoryId) {
      setSelectedSubcategoryId(selectedSubcategory.id);
    }
    if (!selectedSubcategory) {
      setSelectedSubcategoryId(null);
    }
  }, [selectedSubcategory, selectedSubcategoryId]);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  const selectedCategoryBlueprintCount = selectedCategory
    ? itemBlueprints.filter(
        (blueprint) => blueprint.categoryDefinitionId === selectedCategory.id
      ).length
    : 0;
  const selectedCategorySubcategoryCount = selectedCategory
    ? itemSubcategoryDefinitions.filter(
        (definition) => definition.categoryId === selectedCategory.id
      ).length
    : 0;
  const selectedSubcategoryBlueprintCount = selectedSubcategory
    ? itemBlueprints.filter(
        (blueprint) => blueprint.subcategoryDefinitionId === selectedSubcategory.id
      ).length
    : 0;

  function handleCreateCategory(): void {
    const categoryId = createItemCategoryDefinition({
      name: "Custom Category",
    });
    setSelectedCategoryId(categoryId);
    setPendingDeleteCategoryId(null);
  }

  function handleCreateSubcategory(): void {
    const categoryId = selectedCategory?.id ?? sortedCategories[0]?.id ?? "melee";
    const subcategoryId = createItemSubcategoryDefinition({
      categoryId,
      name: "Custom Subcategory",
      mechanicalRole: "accessory",
      allowedEquipSlots: [],
      occupiedSlots: [],
    });
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId(subcategoryId);
    setPendingDeleteSubcategoryId(null);
  }

  function toggleAllowedSlot(slotId: (typeof CANONICAL_EQUIPMENT_SLOT_IDS)[number]): void {
    if (!selectedSubcategory) {
      return;
    }

    updateItemSubcategoryDefinition(selectedSubcategory.id, (current) => {
      const hasSlot = current.allowedEquipSlots.includes(slotId);
      const allowedEquipSlots = hasSlot
        ? current.allowedEquipSlots.filter((entry) => entry !== slotId)
        : [...current.allowedEquipSlots, slotId];

      return {
        ...current,
        allowedEquipSlots,
      };
    });
  }

  function toggleOccupiedSlot(slotId: (typeof CANONICAL_EQUIPMENT_SLOT_IDS)[number]): void {
    if (!selectedSubcategory) {
      return;
    }

    updateItemSubcategoryDefinition(selectedSubcategory.id, (current) => {
      const hasSlot = current.occupiedSlots.includes(slotId);
      const occupiedSlots = hasSlot
        ? current.occupiedSlots.filter((entry) => entry !== slotId)
        : [...current.occupiedSlots, slotId];

      return {
        ...current,
        occupiedSlots,
      };
    });
  }

  return (
    <main className="sheet-page">
      <section className="sheet-frame">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Definition Management</h1>
            <p className="dm-summary-line">
              Manage persisted item categories and subcategories that drive blueprint equip behavior.
            </p>
          </div>
          <div className="dm-nav-actions dm-nav-actions-wrap">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm/items")}>
              Items List
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm/items/edit")}>
              Item Editting
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm/items/blueprints")}>
              Blueprints
            </button>
          </div>
        </header>

        <div className="dm-item-edit-actions">
          <button type="button" className="flow-primary" onClick={handleCreateCategory}>
            Create New Category
          </button>
          <button type="button" className="flow-secondary" onClick={handleCreateSubcategory}>
            Create New Subcategory
          </button>
        </div>

        <section className="dm-item-edit-layout">
          <article className="sheet-card dm-item-picker-card">
            <p className="section-kicker">Categories</p>
            <h2>Category Picker</h2>
            <div className="dm-item-picker-list">
              {sortedCategories.map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  className={`dm-item-picker-button${definition.id === selectedCategory?.id ? " is-active" : ""}`}
                  onClick={() => {
                    setSelectedCategoryId(definition.id);
                    setPendingDeleteCategoryId(null);
                  }}
                >
                  <strong>{definition.name}</strong>
                  <small>{definition.id}</small>
                </button>
              ))}
            </div>
          </article>

          <article className="sheet-card dm-item-editor-card">
            {!selectedCategory ? (
              <>
                <p className="section-kicker">Category</p>
                <h2>No Category Selected</h2>
                <p className="empty-block-copy">Create a new category or choose one from the picker.</p>
              </>
            ) : (
              <>
                <p className="section-kicker">Category</p>
                <h2>{selectedCategory.name}</h2>
                <div className="dm-item-editor-stack">
                  <section className="dm-item-editor-section">
                    <h3>Identity</h3>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Name</span>
                        <input
                          value={selectedCategory.name}
                          onChange={(event) =>
                            updateItemCategoryDefinition(selectedCategory.id, (current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Category Id</span>
                        <input value={selectedCategory.id} readOnly className="dm-readonly-input" />
                      </label>
                    </div>
                    <p className="dm-summary-line">
                      Subcategories: {selectedCategorySubcategoryCount} | Referencing Blueprints: {selectedCategoryBlueprintCount}
                    </p>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Delete</h3>
                    {pendingDeleteCategoryId === selectedCategory.id ? (
                      <div className="delete-confirm-wrap">
                        <button
                          type="button"
                          className="flow-danger is-confirm"
                          disabled={
                            selectedCategorySubcategoryCount > 0 ||
                            selectedCategoryBlueprintCount > 0
                          }
                          onClick={() => {
                            deleteItemCategoryDefinition(selectedCategory.id);
                            setPendingDeleteCategoryId(null);
                            setSelectedCategoryId(null);
                          }}
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          className="flow-cancel"
                          onClick={() => setPendingDeleteCategoryId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flow-danger"
                        onClick={() => setPendingDeleteCategoryId(selectedCategory.id)}
                      >
                        Delete Selected Category
                      </button>
                    )}
                    {selectedCategorySubcategoryCount > 0 || selectedCategoryBlueprintCount > 0 ? (
                      <p className="dm-summary-line">
                        Category deletion is blocked while subcategories or blueprints still reference it.
                      </p>
                    ) : null}
                  </section>
                </div>
              </>
            )}
          </article>
        </section>

        <section className="dm-item-edit-layout">
          <article className="sheet-card dm-item-picker-card">
            <p className="section-kicker">Subcategories</p>
            <h2>Subcategory Picker</h2>
            <div className="dm-item-picker-list">
              {categorySubcategories.length === 0 ? (
                <p className="empty-block-copy">No subcategories exist for the selected category.</p>
              ) : (
                categorySubcategories.map((definition) => (
                  <button
                    key={definition.id}
                    type="button"
                    className={`dm-item-picker-button${definition.id === selectedSubcategory?.id ? " is-active" : ""}`}
                    onClick={() => {
                      setSelectedSubcategoryId(definition.id);
                      setPendingDeleteSubcategoryId(null);
                    }}
                  >
                    <strong>{definition.name}</strong>
                    <span>{definition.mechanicalRole}</span>
                    <small>{definition.id}</small>
                  </button>
                ))
              )}
            </div>
          </article>

          <article className="sheet-card dm-item-editor-card">
            {!selectedSubcategory ? (
              <>
                <p className="section-kicker">Subcategory</p>
                <h2>No Subcategory Selected</h2>
                <p className="empty-block-copy">Create a subcategory or choose one from the picker.</p>
              </>
            ) : (
              <>
                <p className="section-kicker">Subcategory</p>
                <h2>{selectedSubcategory.name}</h2>
                <div className="dm-item-editor-stack">
                  <section className="dm-item-editor-section">
                    <h3>Identity And Rules</h3>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Name</span>
                        <input
                          value={selectedSubcategory.name}
                          onChange={(event) =>
                            updateItemSubcategoryDefinition(selectedSubcategory.id, (current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Parent Category</span>
                        <select
                          value={selectedSubcategory.categoryId}
                          onChange={(event) =>
                            updateItemSubcategoryDefinition(selectedSubcategory.id, (current) => ({
                              ...current,
                              categoryId: event.target.value,
                            }))
                          }
                        >
                          {sortedCategories.map((definition) => (
                            <option key={definition.id} value={definition.id}>
                              {definition.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="dm-field">
                        <span>Mechanical Role</span>
                        <select
                          value={selectedSubcategory.mechanicalRole}
                          onChange={(event) =>
                            updateItemSubcategoryDefinition(selectedSubcategory.id, (current) => ({
                              ...current,
                              mechanicalRole: event.target.value as ItemSubcategoryDefinition["mechanicalRole"],
                            }))
                          }
                        >
                          {ITEM_MECHANICAL_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="dm-field">
                        <span>Subcategory Id</span>
                        <input value={selectedSubcategory.id} readOnly className="dm-readonly-input" />
                      </label>
                    </div>
                    <p className="dm-summary-line">
                      Referencing Blueprints: {selectedSubcategoryBlueprintCount}
                    </p>
                    <p className="dm-summary-line">
                      Slot Summary: {formatSlotSummary(selectedSubcategory)}
                    </p>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Allowed Equip Slots</h3>
                    <p className="dm-summary-line">
                      These are the valid anchor slots for the item.
                    </p>
                    <div className="dm-pill-list">
                      {CANONICAL_EQUIPMENT_SLOT_IDS.map((slotId) => (
                        <label key={`allowed:${slotId}`} className="equipment-toggle">
                          <input
                            type="checkbox"
                            checked={selectedSubcategory.allowedEquipSlots.includes(slotId)}
                            onChange={() => toggleAllowedSlot(slotId)}
                          />
                          {getEquipmentSlotLabel(slotId)}
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Occupied Slots</h3>
                    <p className="dm-summary-line">
                      Leave this empty when the item should occupy only its chosen anchor slot. Fill it only when the item always occupies a fixed slot set from that anchor.
                    </p>
                    <p className="dm-summary-line">
                      When this list is not empty, every allowed anchor must also be part of the occupied set.
                    </p>
                    <div className="dm-pill-list">
                      {CANONICAL_EQUIPMENT_SLOT_IDS.map((slotId) => (
                        <label key={`occupied:${slotId}`} className="equipment-toggle">
                          <input
                            type="checkbox"
                            checked={selectedSubcategory.occupiedSlots.includes(slotId)}
                            onChange={() => toggleOccupiedSlot(slotId)}
                          />
                          {getEquipmentSlotLabel(slotId)}
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Delete</h3>
                    {pendingDeleteSubcategoryId === selectedSubcategory.id ? (
                      <div className="delete-confirm-wrap">
                        <button
                          type="button"
                          className="flow-danger is-confirm"
                          disabled={selectedSubcategoryBlueprintCount > 0}
                          onClick={() => {
                            deleteItemSubcategoryDefinition(selectedSubcategory.id);
                            setPendingDeleteSubcategoryId(null);
                            setSelectedSubcategoryId(null);
                          }}
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          className="flow-cancel"
                          onClick={() => setPendingDeleteSubcategoryId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flow-danger"
                        onClick={() => setPendingDeleteSubcategoryId(selectedSubcategory.id)}
                      >
                        Delete Selected Subcategory
                      </button>
                    )}
                    {selectedSubcategoryBlueprintCount > 0 ? (
                      <p className="dm-summary-line">
                        Subcategory deletion is blocked while blueprints still reference it.
                      </p>
                    ) : null}
                  </section>
                </div>
              </>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
