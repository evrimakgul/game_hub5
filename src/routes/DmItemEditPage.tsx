import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { PLAYER_CHARACTER_TEMPLATE } from "../config/characterTemplate.ts";
import {
  cloneBonusProfile,
  createEmptyBonusProfile,
  createItemCustomPropertyRecord,
  getItemBaseVisibleStats,
  getItemBlueprintLabel,
  getItemBlueprintOptions,
  getItemCustomPropertySummary,
  getItemPropertyPoints,
  getItemBlueprintRecord,
  getItemPowerBonusOptions,
  getItemSpellBonusOptions,
  getItemTierLabel,
  retypeSharedItemRecord,
  setBlueprintBaseProfile,
  setItemBaseProfileFromBlueprintComparison,
  setProfileDerivedValue,
  setProfileNotes,
  setProfilePowerValue,
  setProfileResistanceValue,
  setProfileSkillValue,
  setProfileSpellValue,
  setProfileStatValue,
  setProfileUtilityTraits,
  setSharedItemDerivedBonus,
  setSharedItemNotes,
  setSharedItemPowerBonus,
  setSharedItemResistanceBonus,
  setSharedItemSkillBonus,
  setSharedItemSpellBonus,
  setSharedItemStatBonus,
  setSharedItemUtilityTraits,
} from "../lib/items.ts";
import { DAMAGE_TYPES } from "../rules/resistances.ts";
import { useAppFlow } from "../state/appFlow";
import { STAT_IDS, type StatId } from "../types/character.ts";
import type {
  ItemCustomPropertyRecord,
  ItemCustomPropertyTarget,
  ItemCustomPropertyTargetType,
  ItemDerivedModifierId,
  SharedItemRecord,
} from "../types/items.ts";

const SKILL_OPTIONS = PLAYER_CHARACTER_TEMPLATE.createInstance().skills.map((skill) => ({
  id: skill.id,
  label: skill.label,
}));

const DERIVED_BONUS_FIELDS: Array<{ id: ItemDerivedModifierId; label: string }> = [
  { id: "max_hp", label: "Max HP" },
  { id: "max_mana", label: "Max Mana" },
  { id: "initiative", label: "Initiative" },
  { id: "inspiration", label: "Inspiration" },
  { id: "attack_dice_bonus", label: "Attack Dice" },
  { id: "melee_attack", label: "Melee Attack" },
  { id: "ranged_attack", label: "Ranged Attack" },
  { id: "armor_class", label: "Armor Class" },
  { id: "damage_reduction", label: "Damage Reduction" },
  { id: "soak", label: "Soak" },
  { id: "melee_damage", label: "Melee Damage" },
  { id: "ranged_damage", label: "Ranged Damage" },
];

function parseNumericInput(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function createFreshBonusProfile() {
  return createEmptyBonusProfile();
}

function hasCustomPropertyTarget(
  property: ItemCustomPropertyRecord,
  target: ItemCustomPropertyTarget
): boolean {
  return property.targets.some(
    (entry) => entry.type === target.type && entry.id === target.id
  );
}

function sortItems(items: SharedItemRecord[]): SharedItemRecord[] {
  return [...items].sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.id.localeCompare(right.id);
  });
}

export function DmItemEditPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [baseEditEnabled, setBaseEditEnabled] = useState(false);
  const [saveModeOpen, setSaveModeOpen] = useState(false);
  const {
    roleChoice,
    itemBlueprints,
    items,
    createItem,
    updateItem,
    deleteItem,
    updateItemBlueprint,
  } = useAppFlow();

  const sortedItems = useMemo(() => sortItems(items), [items]);
  const blueprintOptions = useMemo(() => getItemBlueprintOptions(itemBlueprints), [itemBlueprints]);
  const powerBonusOptions = useMemo(() => getItemPowerBonusOptions(), []);
  const spellBonusOptions = useMemo(() => getItemSpellBonusOptions(), []);
  const customPropertyTargetGroups = useMemo(
    () => [
      { type: "stat" as const, label: "Stats", options: STAT_IDS.map((id) => ({ id, label: id })) },
      { type: "skill" as const, label: "Skills", options: SKILL_OPTIONS },
      { type: "derived" as const, label: "Derived", options: DERIVED_BONUS_FIELDS },
      { type: "resistance" as const, label: "Resistances", options: DAMAGE_TYPES.map((entry) => ({ id: entry.id, label: entry.label })) },
      { type: "power" as const, label: "Powers", options: powerBonusOptions },
      { type: "spell" as const, label: "Spells", options: spellBonusOptions },
    ],
    [powerBonusOptions, spellBonusOptions]
  );
  const requestedItemId = searchParams.get("itemId");
  const selectedItem =
    sortedItems.find((item) => item.id === requestedItemId) ?? sortedItems[0] ?? null;
  const [baseDraft, setBaseDraft] = useState(() =>
    selectedItem ? cloneBonusProfile(selectedItem.baseProfile) : cloneBonusProfile(createFreshBonusProfile())
  );

  useEffect(() => {
    if (roleChoice !== "dm") {
      return;
    }

    if (searchParams.get("create") !== "1") {
      return;
    }

    const defaultBlueprintId = blueprintOptions.find((option) => option.isLegacy !== true)?.id ?? "mystic:focus";
    const itemId = createItem(defaultBlueprintId, {
      name: "New Item",
      baseDescription: "",
    });
    setSearchParams({ itemId });
  }, [blueprintOptions, createItem, roleChoice, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    setBaseDraft(cloneBonusProfile(selectedItem.baseProfile));
    setBaseEditEnabled(false);
    setSaveModeOpen(false);
    setPendingDeleteId(null);
  }, [selectedItem?.id]);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function selectItem(itemId: string): void {
    setSearchParams({ itemId });
  }

  function updateSelectedItem(
    updater: SharedItemRecord | ((current: SharedItemRecord) => SharedItemRecord)
  ): void {
    if (!selectedItem) {
      return;
    }

    updateItem(selectedItem.id, updater);
  }

  function updateSelectedCustomProperty(
    propertyId: string,
    updater: (current: ItemCustomPropertyRecord) => ItemCustomPropertyRecord
  ): void {
    updateSelectedItem((currentItem) => ({
      ...currentItem,
      customProperties: currentItem.customProperties.map((property) =>
        property.id === propertyId ? updater(property) : property
      ),
    }));
  }

  function handleAddCustomProperty(): void {
    updateSelectedItem((currentItem) => ({
      ...currentItem,
      customProperties: [
        ...currentItem.customProperties,
        createItemCustomPropertyRecord({
          label: `Custom Property ${currentItem.customProperties.length + 1}`,
        }),
      ],
    }));
  }

  function handleRemoveCustomProperty(propertyId: string): void {
    updateSelectedItem((currentItem) => ({
      ...currentItem,
      customProperties: currentItem.customProperties.filter((property) => property.id !== propertyId),
    }));
  }

  function toggleCustomPropertyTarget(
    propertyId: string,
    targetType: ItemCustomPropertyTargetType,
    targetId: string
  ): void {
    updateSelectedCustomProperty(propertyId, (currentProperty) => {
      const target = { type: targetType, id: targetId } as ItemCustomPropertyTarget;
      const targets = hasCustomPropertyTarget(currentProperty, target)
        ? currentProperty.targets.filter(
            (entry) => !(entry.type === targetType && entry.id === targetId)
          )
        : [...currentProperty.targets, target];

      return {
        ...currentProperty,
        targets,
      };
    });
  }

  function handleCreateNewItem(): void {
    const defaultBlueprintId = blueprintOptions.find((option) => option.isLegacy !== true)?.id ?? "mystic:focus";
    const itemId = createItem(defaultBlueprintId, {
      name: "New Item",
      baseDescription: "",
    });
    setSearchParams({ itemId });
  }

  function handleDeleteSelectedItem(): void {
    if (!selectedItem) {
      return;
    }

    const nextItemId = sortedItems.find((item) => item.id !== selectedItem.id)?.id ?? null;
    deleteItem(selectedItem.id);
    setSearchParams(nextItemId ? { itemId: nextItemId } : {});
  }

  function saveBaseToBlueprint(): void {
    if (!selectedItem) {
      return;
    }

    const blueprint = getItemBlueprintRecord(selectedItem, itemBlueprints);
    if (!blueprint) {
      return;
    }

    updateItemBlueprint(blueprint.id, (currentBlueprint) =>
      setBlueprintBaseProfile(currentBlueprint, baseDraft)
    );
    setBaseEditEnabled(false);
    setSaveModeOpen(false);
  }

  function saveBaseToItemOnly(): void {
    if (!selectedItem) {
      return;
    }

    const blueprint = getItemBlueprintRecord(selectedItem, itemBlueprints);
    if (!blueprint) {
      return;
    }

    updateItem(selectedItem.id, (currentItem) =>
      setItemBaseProfileFromBlueprintComparison(currentItem, blueprint, baseDraft)
    );
    setBaseEditEnabled(false);
    setSaveModeOpen(false);
  }

  return (
    <main className="sheet-page">
      <section className="sheet-frame">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Item Editting</h1>
            <p className="dm-summary-line">
              Edit blueprint-backed item instances against the current character-sheet and power surfaces.
            </p>
          </div>
          <div className="dm-nav-actions dm-nav-actions-wrap">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm/items")}>
              Items List
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm/items/blueprints")}>
              Blueprints
            </button>
          </div>
        </header>

        <div className="dm-item-edit-actions">
          <button type="button" className="flow-primary" onClick={handleCreateNewItem}>
            Create New Item
          </button>
          {selectedItem ? (
            pendingDeleteId === selectedItem.id ? (
              <div className="delete-confirm-wrap">
                <button type="button" className="flow-danger is-confirm" onClick={handleDeleteSelectedItem}>
                  Confirm Delete
                </button>
                <button type="button" className="flow-cancel" onClick={() => setPendingDeleteId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="flow-danger" onClick={() => setPendingDeleteId(selectedItem.id)}>
                Delete Selected Item
              </button>
            )
          ) : null}
        </div>

        <section className="dm-item-edit-layout">
          <article className="sheet-card dm-item-picker-card">
            <p className="section-kicker">Item Instances</p>
            <h2>Item Picker</h2>
            <div className="dm-item-picker-list">
              {sortedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`dm-item-picker-button${item.id === selectedItem?.id ? " is-active" : ""}`}
                  onClick={() => selectItem(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span>{getItemBlueprintLabel(item, itemBlueprints)}</span>
                  <small>
                    {`PP ${getItemPropertyPoints(item)} | ${getItemTierLabel(item)} | ${
                      getItemBaseVisibleStats(item).join(" | ") || "No base stats listed."
                    }`}
                  </small>
                </button>
              ))}
            </div>
          </article>

          <article className="sheet-card dm-item-editor-card">
            {!selectedItem ? (
              <>
                <p className="section-kicker">Item Instance</p>
                <h2>No Item Selected</h2>
                <p className="empty-block-copy">Create a new item or choose one from the picker.</p>
              </>
            ) : (
              <>
                <p className="section-kicker">Item Instance</p>
                <h2>{selectedItem.name}</h2>

                <div className="dm-item-editor-stack">
                  <section className="dm-item-editor-section">
                    <h3>Item Identity And Base Template</h3>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Name</span>
                        <input
                          value={selectedItem.name}
                          onChange={(event) =>
                            updateSelectedItem((currentItem) => ({ ...currentItem, name: event.target.value }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Blueprint</span>
                        <select
                          value={selectedItem.blueprintId}
                          onChange={(event) =>
                            updateSelectedItem((currentItem) =>
                              retypeSharedItemRecord(currentItem, event.target.value, itemBlueprints)
                            )
                          }
                        >
                          {blueprintOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="dm-field">
                        <span>PP</span>
                        <input value={String(getItemPropertyPoints(selectedItem))} readOnly className="dm-readonly-input" />
                      </label>
                      <label className="dm-field">
                        <span>Item Tier</span>
                        <input value={getItemTierLabel(selectedItem)} readOnly className="dm-readonly-input" />
                      </label>
                    </div>

                    <label className="dm-field">
                      <span>Visible Instance Note</span>
                      <input
                        value={selectedItem.baseDescription}
                        onChange={(event) =>
                          updateSelectedItem((currentItem) => ({
                            ...currentItem,
                            baseDescription: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <p className="dm-summary-line">
                      Blueprint: {getItemBlueprintLabel(selectedItem, itemBlueprints)}
                    </p>
                    <label className="dm-field dm-inline-toggle">
                      <span>Artifact Classification</span>
                      <input
                        type="checkbox"
                        checked={selectedItem.isArtifact}
                        onChange={(event) =>
                          updateSelectedItem((currentItem) => ({
                            ...currentItem,
                            isArtifact: event.target.checked,
                          }))
                        }
                      />
                    </label>
                    <p className="dm-summary-line">
                      Base Visible Stats: {getItemBaseVisibleStats(selectedItem).join(" | ") || "None"}
                    </p>
                    {selectedItem.customProperties.length > 0 ? (
                      <p className="dm-summary-line">
                        Custom Properties: {getItemCustomPropertySummary(selectedItem).join(" | ")}
                      </p>
                    ) : null}

                    <div className="flow-actions dm-item-base-actions">
                      <button type="button" className="flow-secondary" onClick={() => setBaseEditEnabled(true)}>
                        Update Base Specs
                      </button>
                      {baseEditEnabled ? (
                        <>
                          <button type="button" className="flow-primary" onClick={() => setSaveModeOpen((current) => !current)}>
                            Save
                          </button>
                          {saveModeOpen ? (
                            <>
                              <button type="button" className="flow-secondary" onClick={saveBaseToBlueprint}>
                                Update Blueprint Base Values
                              </button>
                              <button type="button" className="flow-secondary" onClick={saveBaseToItemOnly}>
                                Update Base Values Of Only This Item
                              </button>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Character-Sheet Effects</h3>
                    <div className="dm-item-edit-group">
                      <h4>Stat Values</h4>
                      <div className="dm-item-edit-grid dm-item-edit-grid-paired dm-item-edit-grid-paired-stats">
                        {STAT_IDS.map((statId) => (
                          <div key={statId} className="dm-field-pair">
                            <label className="dm-field">
                              <span>{statId} Base</span>
                              <input
                                type="number"
                                className={!baseEditEnabled ? "dm-readonly-input" : ""}
                                disabled={!baseEditEnabled}
                                value={baseDraft.statBonuses[statId] ?? ""}
                                onChange={(event) =>
                                  setBaseDraft((current) =>
                                    setProfileStatValue(current, statId as StatId, parseNumericInput(event.target.value))
                                  )
                                }
                              />
                            </label>
                            <label className="dm-field">
                              <span>{statId} Bonus</span>
                              <input
                                type="number"
                                value={selectedItem.bonusProfile.statBonuses[statId] ?? ""}
                                onChange={(event) =>
                                  updateSelectedItem((currentItem) =>
                                    setSharedItemStatBonus(currentItem, statId as StatId, parseNumericInput(event.target.value))
                                  )
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="dm-item-edit-group">
                      <h4>Skill Values</h4>
                      <div className="dm-item-edit-grid dm-item-edit-grid-paired">
                        {SKILL_OPTIONS.map((skill) => (
                          <div key={skill.id} className="dm-field-pair">
                            <label className="dm-field">
                              <span>{skill.label} Base</span>
                              <input
                                type="number"
                                className={!baseEditEnabled ? "dm-readonly-input" : ""}
                                disabled={!baseEditEnabled}
                                value={baseDraft.skillBonuses[skill.id] ?? ""}
                                onChange={(event) =>
                                  setBaseDraft((current) =>
                                    setProfileSkillValue(current, skill.id, parseNumericInput(event.target.value))
                                  )
                                }
                              />
                            </label>
                            <label className="dm-field">
                              <span>{skill.label} Bonus</span>
                              <input
                                type="number"
                                value={selectedItem.bonusProfile.skillBonuses[skill.id] ?? ""}
                                onChange={(event) =>
                                  updateSelectedItem((currentItem) =>
                                    setSharedItemSkillBonus(currentItem, skill.id, parseNumericInput(event.target.value))
                                  )
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="dm-item-edit-group">
                      <h4>Derived Values</h4>
                      <div className="dm-item-edit-grid dm-item-edit-grid-paired">
                        {DERIVED_BONUS_FIELDS.map((field) => (
                          <div key={field.id} className="dm-field-pair">
                            <label className="dm-field">
                              <span>{field.label} Base</span>
                              <input
                                type="number"
                                className={!baseEditEnabled ? "dm-readonly-input" : ""}
                                disabled={!baseEditEnabled}
                                value={baseDraft.derivedBonuses[field.id] ?? ""}
                                onChange={(event) =>
                                  setBaseDraft((current) =>
                                    setProfileDerivedValue(current, field.id, parseNumericInput(event.target.value))
                                  )
                                }
                              />
                            </label>
                            <label className="dm-field">
                              <span>{field.label} Bonus</span>
                              <input
                                type="number"
                                value={selectedItem.bonusProfile.derivedBonuses[field.id] ?? ""}
                                onChange={(event) =>
                                  updateSelectedItem((currentItem) =>
                                    setSharedItemDerivedBonus(currentItem, field.id, parseNumericInput(event.target.value))
                                  )
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="dm-item-edit-group">
                      <h4>Resistance Values</h4>
                      <div className="dm-item-edit-grid dm-item-edit-grid-paired">
                        {DAMAGE_TYPES.map((damageType) => (
                          <div key={damageType.id} className="dm-field-pair">
                            <label className="dm-field">
                              <span>{damageType.label} Base</span>
                              <input
                                type="number"
                                className={!baseEditEnabled ? "dm-readonly-input" : ""}
                                disabled={!baseEditEnabled}
                                value={baseDraft.resistanceBonuses[damageType.id] ?? ""}
                                onChange={(event) =>
                                  setBaseDraft((current) =>
                                    setProfileResistanceValue(current, damageType.id, parseNumericInput(event.target.value))
                                  )
                                }
                              />
                            </label>
                            <label className="dm-field">
                              <span>{damageType.label} Bonus</span>
                              <input
                                type="number"
                                value={selectedItem.bonusProfile.resistanceBonuses[damageType.id] ?? ""}
                                onChange={(event) =>
                                  updateSelectedItem((currentItem) =>
                                    setSharedItemResistanceBonus(currentItem, damageType.id, parseNumericInput(event.target.value))
                                  )
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Base Utility Traits</span>
                        <textarea
                          className={`notes-input${!baseEditEnabled ? " dm-readonly-input" : ""}`}
                          disabled={!baseEditEnabled}
                          value={baseDraft.utilityTraits.join("\n")}
                          onChange={(event) =>
                            setBaseDraft((current) => setProfileUtilityTraits(current, splitLines(event.target.value)))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Bonus Utility Traits</span>
                        <textarea
                          className="notes-input"
                          value={selectedItem.bonusProfile.utilityTraits.join("\n")}
                          onChange={(event) =>
                            updateSelectedItem((currentItem) =>
                              setSharedItemUtilityTraits(currentItem, splitLines(event.target.value))
                            )
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Base Notes</span>
                        <textarea
                          className={`notes-input${!baseEditEnabled ? " dm-readonly-input" : ""}`}
                          disabled={!baseEditEnabled}
                          value={baseDraft.notes.join("\n")}
                          onChange={(event) =>
                            setBaseDraft((current) => setProfileNotes(current, splitLines(event.target.value)))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Bonus Notes</span>
                        <textarea
                          className="notes-input"
                          value={selectedItem.bonusProfile.notes.join("\n")}
                          onChange={(event) =>
                            updateSelectedItem((currentItem) =>
                              setSharedItemNotes(currentItem, splitLines(event.target.value))
                            )
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Power Effects</h3>
                    <div className="dm-item-edit-grid dm-item-edit-grid-paired">
                      {powerBonusOptions.map((option) => (
                        <div key={option.id} className="dm-field-pair">
                          <label className="dm-field">
                            <span>{option.label} Base</span>
                            <input
                              type="number"
                              className={!baseEditEnabled ? "dm-readonly-input" : ""}
                              disabled={!baseEditEnabled}
                              value={baseDraft.powerBonuses[option.id] ?? ""}
                              onChange={(event) =>
                                setBaseDraft((current) =>
                                  setProfilePowerValue(current, option.id, parseNumericInput(event.target.value))
                                )
                              }
                            />
                          </label>
                          <label className="dm-field">
                            <span>{option.label} Bonus</span>
                            <input
                              type="number"
                              value={selectedItem.bonusProfile.powerBonuses[option.id] ?? ""}
                              onChange={(event) =>
                                updateSelectedItem((currentItem) =>
                                  setSharedItemPowerBonus(currentItem, option.id, parseNumericInput(event.target.value))
                                )
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Spell Effects</h3>
                    <div className="dm-item-edit-grid dm-item-edit-grid-paired">
                      {spellBonusOptions.map((option) => (
                        <div key={option.id} className="dm-field-pair">
                          <label className="dm-field">
                            <span>{option.label} Base</span>
                            <input
                              type="number"
                              className={!baseEditEnabled ? "dm-readonly-input" : ""}
                              disabled={!baseEditEnabled}
                              value={baseDraft.spellBonuses[option.id] ?? ""}
                              onChange={(event) =>
                                setBaseDraft((current) =>
                                  setProfileSpellValue(current, option.id, parseNumericInput(event.target.value))
                                )
                              }
                            />
                          </label>
                          <label className="dm-field">
                            <span>{option.label} Bonus</span>
                            <input
                              type="number"
                              value={selectedItem.bonusProfile.spellBonuses[option.id] ?? ""}
                              onChange={(event) =>
                                updateSelectedItem((currentItem) =>
                                  setSharedItemSpellBonus(currentItem, option.id, parseNumericInput(event.target.value))
                                )
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <div className="flow-actions dm-item-base-actions">
                      <h3>Custom Properties</h3>
                      <button type="button" className="flow-secondary" onClick={handleAddCustomProperty}>
                        Add New Property
                      </button>
                    </div>
                    {selectedItem.customProperties.length === 0 ? (
                      <p className="empty-block-copy">No custom properties added yet.</p>
                    ) : (
                      <div className="dm-item-edit-group">
                        {selectedItem.customProperties.map((property) => (
                          <article key={property.id} className="dm-item-custom-property">
                            <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                              <label className="dm-field">
                                <span>Label</span>
                                <input
                                  value={property.label}
                                  onChange={(event) =>
                                    updateSelectedCustomProperty(property.id, (currentProperty) => ({
                                      ...currentProperty,
                                      label: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <label className="dm-field">
                                <span>PP Cost</span>
                                <input
                                  type="number"
                                  value={property.ppCost}
                                  onChange={(event) =>
                                    updateSelectedCustomProperty(property.id, (currentProperty) => ({
                                      ...currentProperty,
                                      ppCost: Number.parseInt(event.target.value, 10) || 0,
                                    }))
                                  }
                                />
                              </label>
                              <label className="dm-field">
                                <span>Applied Value</span>
                                <input
                                  type="number"
                                  value={property.value}
                                  onChange={(event) =>
                                    updateSelectedCustomProperty(property.id, (currentProperty) => ({
                                      ...currentProperty,
                                      value: Number.parseInt(event.target.value, 10) || 0,
                                    }))
                                  }
                                />
                              </label>
                              <label className="dm-field">
                                <span>Notes / Description</span>
                                <input
                                  value={property.notes}
                                  onChange={(event) =>
                                    updateSelectedCustomProperty(property.id, (currentProperty) => ({
                                      ...currentProperty,
                                      notes: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                            </div>

                            <details className="dm-item-custom-targets">
                              <summary>Select Targets ({property.targets.length})</summary>
                              <div className="dm-item-custom-target-grid">
                                {customPropertyTargetGroups.map((group) => (
                                  <div key={group.type} className="dm-item-custom-target-group">
                                    <strong>{group.label}</strong>
                                    {group.options.map((option) => (
                                      <label key={`${group.type}:${option.id}`} className="equipment-toggle">
                                        <input
                                          type="checkbox"
                                          checked={hasCustomPropertyTarget(property, {
                                            type: group.type,
                                            id: option.id,
                                          })}
                                          onChange={() =>
                                            toggleCustomPropertyTarget(property.id, group.type, option.id)
                                          }
                                        />
                                        {option.label}
                                      </label>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </details>

                            <div className="flow-actions">
                              <button
                                type="button"
                                className="flow-danger"
                                onClick={() => handleRemoveCustomProperty(property.id)}
                              >
                                Remove Property
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
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
