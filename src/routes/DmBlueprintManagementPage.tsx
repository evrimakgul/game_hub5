import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { PLAYER_CHARACTER_TEMPLATE } from "../config/characterTemplate.ts";
import {
  createEmptyBonusProfile,
  getItemPowerBonusOptions,
  getItemSpellBonusOptions,
  setProfileDerivedValue,
  setProfileNotes,
  setProfilePowerValue,
  setProfileResistanceValue,
  setProfileSkillValue,
  setProfileSpellValue,
  setProfileStatValue,
  setProfileUtilityTraits,
} from "../lib/items.ts";
import { DAMAGE_TYPES } from "../rules/resistances.ts";
import { useAppFlow } from "../state/appFlow";
import { ARMOR_SUBTYPES, ITEM_CATEGORIES, WEAPON_SUBTYPES } from "../types/items.ts";
import type { ItemBlueprintRecord, ItemCombatSpec, ItemDerivedModifierId } from "../types/items.ts";
import { STAT_IDS, type StatId } from "../types/character.ts";

const SKILL_OPTIONS = PLAYER_CHARACTER_TEMPLATE.createInstance().skills.map((skill) => ({
  id: skill.id,
  label: skill.label,
}));

const DERIVED_BONUS_FIELDS: Array<{ id: ItemDerivedModifierId; label: string }> = [
  { id: "max_hp", label: "Max HP" },
  { id: "max_mana", label: "Max Mana" },
  { id: "initiative", label: "Initiative" },
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

function sortBlueprints(blueprints: ItemBlueprintRecord[]): ItemBlueprintRecord[] {
  return [...blueprints].sort((left, right) => {
    const labelCompare = left.label.localeCompare(right.label);
    if (labelCompare !== 0) {
      return labelCompare;
    }
    return left.id.localeCompare(right.id);
  });
}

function buildDefaultCombatSpec(category: string, subtype: string): ItemCombatSpec | null {
  if (category === "weapon") {
    const rangedSubtype = ["ranged_light", "pistol", "bow_long", "rifle", "crossbow_heavy", "shotgun", "chaingun", "rocket_launcher"].includes(subtype);
    const handsRequired =
      subtype === "pistol" || subtype === "unarmed" || subtype === "brawl" || subtype === "one_handed"
        ? 1
        : 2;
    const physicalProfileKind =
      subtype === "unarmed" || subtype === "brawl" || subtype === "one_handed" || subtype === "two_handed" || subtype === "oversized"
        ? subtype
        : "ranged";

    return {
      attackKind: rangedSubtype ? "ranged" : "melee",
      physicalProfileKind,
      handsRequired,
      attacksPerAction: subtype === "unarmed" || subtype === "brawl" ? 2 : 1,
      slotKey: undefined,
    };
  }

  if (category === "armor") {
    return { slotKey: subtype.startsWith("shield") ? "Hand" : "Chest" };
  }

  if (category === "mystic") {
    return { slotKey: "Hand", handsRequired: 1 };
  }

  return null;
}

function getSubtypeOptions(category: string): string[] {
  if (category === "weapon") {
    return [...WEAPON_SUBTYPES];
  }
  if (category === "armor") {
    return [...ARMOR_SUBTYPES];
  }
  if (category === "jewel") {
    return ["jewel"];
  }
  return ["focus"];
}

export function DmBlueprintManagementPage() {
  const navigate = useNavigate();
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { roleChoice, itemBlueprints, items, createItemBlueprint, updateItemBlueprint, deleteItemBlueprint } = useAppFlow();
  const sortedBlueprints = useMemo(() => sortBlueprints(itemBlueprints), [itemBlueprints]);
  const powerBonusOptions = useMemo(() => getItemPowerBonusOptions(), []);
  const spellBonusOptions = useMemo(() => getItemSpellBonusOptions(), []);
  const selectedBlueprint =
    sortedBlueprints.find((blueprint) => blueprint.id === selectedBlueprintId) ?? sortedBlueprints[0] ?? null;

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function handleCreateBlueprint(): void {
    const blueprintId = createItemBlueprint({
      label: "Custom Blueprint",
      defaultName: "Custom Item",
      category: "weapon",
      subtype: "one_handed",
      combatSpec: buildDefaultCombatSpec("weapon", "one_handed"),
      baseProfile: createEmptyBonusProfile(),
    });
    setSelectedBlueprintId(blueprintId);
  }

  const referencingItems = selectedBlueprint
    ? items.filter((item) => item.blueprintId === selectedBlueprint.id)
    : [];

  return (
    <main className="sheet-page">
      <section className="sheet-frame">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Blueprint Management</h1>
            <p className="dm-summary-line">
              Edit blueprint classes directly, including combat metadata and overridden-instance exceptions.
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
          </div>
        </header>

        <div className="dm-item-edit-actions">
          <button type="button" className="flow-primary" onClick={handleCreateBlueprint}>
            Create New Blueprint
          </button>
          {selectedBlueprint ? (
            pendingDeleteId === selectedBlueprint.id ? (
              <div className="delete-confirm-wrap">
                <button
                  type="button"
                  className="flow-danger is-confirm"
                  disabled={referencingItems.length > 0}
                  onClick={() => {
                    deleteItemBlueprint(selectedBlueprint.id);
                    setPendingDeleteId(null);
                    setSelectedBlueprintId(null);
                  }}
                >
                  Confirm Delete
                </button>
                <button type="button" className="flow-cancel" onClick={() => setPendingDeleteId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="flow-danger" onClick={() => setPendingDeleteId(selectedBlueprint.id)}>
                Delete Selected Blueprint
              </button>
            )
          ) : null}
        </div>

        <section className="dm-item-edit-layout">
          <article className="sheet-card dm-item-picker-card">
            <p className="section-kicker">Blueprint Classes</p>
            <h2>Blueprint Picker</h2>
            <div className="dm-item-picker-list">
              {sortedBlueprints.map((blueprint) => (
                <button
                  key={blueprint.id}
                  type="button"
                  className={`dm-item-picker-button${blueprint.id === selectedBlueprint?.id ? " is-active" : ""}`}
                  onClick={() => {
                    setSelectedBlueprintId(blueprint.id);
                    setPendingDeleteId(null);
                  }}
                >
                  <strong>{blueprint.label}</strong>
                  <span>{blueprint.defaultName}</span>
                  <small>{blueprint.id}</small>
                </button>
              ))}
            </div>
          </article>

          <article className="sheet-card dm-item-editor-card">
            {!selectedBlueprint ? (
              <>
                <p className="section-kicker">Blueprint Class</p>
                <h2>No Blueprint Selected</h2>
                <p className="empty-block-copy">Create a new blueprint or choose one from the picker.</p>
              </>
            ) : (
              <>
                <p className="section-kicker">Blueprint Class</p>
                <h2>{selectedBlueprint.label}</h2>

                <div className="dm-item-editor-stack">
                  <section className="dm-item-editor-section">
                    <h3>Identity And Classification</h3>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Label</span>
                        <input
                          value={selectedBlueprint.label}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              label: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Default Item Name</span>
                        <input
                          value={selectedBlueprint.defaultName}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              defaultName: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Category</span>
                        <select
                          value={selectedBlueprint.category}
                          onChange={(event) => {
                            const nextCategory = event.target.value;
                            const nextSubtype = getSubtypeOptions(nextCategory)[0] ?? "focus";
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              category: nextCategory as ItemBlueprintRecord["category"],
                              subtype: nextSubtype as ItemBlueprintRecord["subtype"],
                              combatSpec: buildDefaultCombatSpec(nextCategory, nextSubtype),
                            }));
                          }}
                        >
                          {ITEM_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="dm-field">
                        <span>Subtype</span>
                        <select
                          value={selectedBlueprint.subtype}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              subtype: event.target.value as ItemBlueprintRecord["subtype"],
                              combatSpec: buildDefaultCombatSpec(current.category, event.target.value),
                            }))
                          }
                        >
                          {getSubtypeOptions(selectedBlueprint.category).map((subtype) => (
                            <option key={subtype} value={subtype}>
                              {subtype}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="dm-summary-line">Blueprint ID: {selectedBlueprint.id}</p>
                    <p className="dm-summary-line">
                      Referencing Items: {referencingItems.length} | Override Exceptions: {selectedBlueprint.overrideItemIds.length}
                    </p>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Combat Metadata</h3>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Attack Kind</span>
                        <select
                          value={selectedBlueprint.combatSpec?.attackKind ?? ""}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              combatSpec: {
                                ...(current.combatSpec ?? {}),
                                attackKind: event.target.value ? (event.target.value as "melee" | "ranged") : undefined,
                              },
                            }))
                          }
                        >
                          <option value="">None</option>
                          <option value="melee">Melee</option>
                          <option value="ranged">Ranged</option>
                        </select>
                      </label>
                      <label className="dm-field">
                        <span>Physical Profile</span>
                        <select
                          value={selectedBlueprint.combatSpec?.physicalProfileKind ?? ""}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              combatSpec: {
                                ...(current.combatSpec ?? {}),
                                physicalProfileKind: event.target.value ? (event.target.value as NonNullable<ItemCombatSpec["physicalProfileKind"]>) : undefined,
                              },
                            }))
                          }
                        >
                          <option value="">None</option>
                          <option value="unarmed">unarmed</option>
                          <option value="brawl">brawl</option>
                          <option value="one_handed">one_handed</option>
                          <option value="two_handed">two_handed</option>
                          <option value="oversized">oversized</option>
                          <option value="ranged">ranged</option>
                        </select>
                      </label>
                      <label className="dm-field">
                        <span>Hands Required</span>
                        <input
                          type="number"
                          min="1"
                          max="2"
                          value={selectedBlueprint.combatSpec?.handsRequired ?? ""}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              combatSpec: {
                                ...(current.combatSpec ?? {}),
                                handsRequired: parseNumericInput(event.target.value) === 2 ? 2 : parseNumericInput(event.target.value) === 1 ? 1 : undefined,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Attacks Per Action</span>
                        <input
                          type="number"
                          min="1"
                          value={selectedBlueprint.combatSpec?.attacksPerAction ?? ""}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              combatSpec: {
                                ...(current.combatSpec ?? {}),
                                attacksPerAction: parseNumericInput(event.target.value) ?? undefined,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Melee Damage Bonus</span>
                        <input
                          type="number"
                          value={selectedBlueprint.combatSpec?.meleeDamageBonus ?? ""}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              combatSpec: {
                                ...(current.combatSpec ?? {}),
                                meleeDamageBonus: parseNumericInput(event.target.value) ?? undefined,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Ranged Damage Base</span>
                        <input
                          type="number"
                          value={selectedBlueprint.combatSpec?.rangedDamageBase ?? ""}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              combatSpec: {
                                ...(current.combatSpec ?? {}),
                                rangedDamageBase: parseNumericInput(event.target.value) ?? undefined,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Range (m)</span>
                        <input
                          type="number"
                          value={selectedBlueprint.combatSpec?.rangeMeters ?? ""}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              combatSpec: {
                                ...(current.combatSpec ?? {}),
                                rangeMeters: parseNumericInput(event.target.value) ?? undefined,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Minimum STR</span>
                        <input
                          type="number"
                          value={selectedBlueprint.combatSpec?.minimumStrength ?? ""}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              combatSpec: {
                                ...(current.combatSpec ?? {}),
                                minimumStrength: parseNumericInput(event.target.value) ?? undefined,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Slot Key</span>
                        <input
                          value={selectedBlueprint.combatSpec?.slotKey ?? ""}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              combatSpec: {
                                ...(current.combatSpec ?? {}),
                                slotKey: event.target.value.trim() || undefined,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Area Of Effect</span>
                        <input
                          type="checkbox"
                          checked={selectedBlueprint.combatSpec?.isAreaOfEffect === true}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              combatSpec: {
                                ...(current.combatSpec ?? {}),
                                isAreaOfEffect: event.target.checked,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Base Values</h3>
                    <div className="dm-item-edit-group">
                      <h4>Stats</h4>
                      <div className="dm-item-edit-grid">
                        {STAT_IDS.map((statId) => (
                          <label key={statId} className="dm-field">
                            <span>{statId}</span>
                            <input
                              type="number"
                              value={selectedBlueprint.baseProfile.statBonuses[statId] ?? ""}
                              onChange={(event) =>
                                updateItemBlueprint(selectedBlueprint.id, (current) => ({
                                  ...current,
                                  baseProfile: setProfileStatValue(current.baseProfile, statId as StatId, parseNumericInput(event.target.value)),
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="dm-item-edit-group">
                      <h4>Skills</h4>
                      <div className="dm-item-edit-grid">
                        {SKILL_OPTIONS.map((skill) => (
                          <label key={skill.id} className="dm-field">
                            <span>{skill.label}</span>
                            <input
                              type="number"
                              value={selectedBlueprint.baseProfile.skillBonuses[skill.id] ?? ""}
                              onChange={(event) =>
                                updateItemBlueprint(selectedBlueprint.id, (current) => ({
                                  ...current,
                                  baseProfile: setProfileSkillValue(current.baseProfile, skill.id, parseNumericInput(event.target.value)),
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="dm-item-edit-group">
                      <h4>Derived</h4>
                      <div className="dm-item-edit-grid">
                        {DERIVED_BONUS_FIELDS.map((field) => (
                          <label key={field.id} className="dm-field">
                            <span>{field.label}</span>
                            <input
                              type="number"
                              value={selectedBlueprint.baseProfile.derivedBonuses[field.id] ?? ""}
                              onChange={(event) =>
                                updateItemBlueprint(selectedBlueprint.id, (current) => ({
                                  ...current,
                                  baseProfile: setProfileDerivedValue(current.baseProfile, field.id, parseNumericInput(event.target.value)),
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="dm-item-edit-group">
                      <h4>Resistances</h4>
                      <div className="dm-item-edit-grid">
                        {DAMAGE_TYPES.map((damageType) => (
                          <label key={damageType.id} className="dm-field">
                            <span>{damageType.label}</span>
                            <input
                              type="number"
                              value={selectedBlueprint.baseProfile.resistanceBonuses[damageType.id] ?? ""}
                              onChange={(event) =>
                                updateItemBlueprint(selectedBlueprint.id, (current) => ({
                                  ...current,
                                  baseProfile: setProfileResistanceValue(current.baseProfile, damageType.id, parseNumericInput(event.target.value)),
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Utility Traits</span>
                        <textarea
                          className="notes-input"
                          value={selectedBlueprint.baseProfile.utilityTraits.join("\n")}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              baseProfile: setProfileUtilityTraits(current.baseProfile, splitLines(event.target.value)),
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Notes</span>
                        <textarea
                          className="notes-input"
                          value={selectedBlueprint.baseProfile.notes.join("\n")}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              baseProfile: setProfileNotes(current.baseProfile, splitLines(event.target.value)),
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="dm-item-edit-group">
                      <h4>Power Effects</h4>
                      <div className="dm-item-edit-grid">
                        {powerBonusOptions.map((option) => (
                          <label key={option.id} className="dm-field">
                            <span>{option.label}</span>
                            <input
                              type="number"
                              value={selectedBlueprint.baseProfile.powerBonuses[option.id] ?? ""}
                              onChange={(event) =>
                                updateItemBlueprint(selectedBlueprint.id, (current) => ({
                                  ...current,
                                  baseProfile: setProfilePowerValue(
                                    current.baseProfile,
                                    option.id,
                                    parseNumericInput(event.target.value)
                                  ),
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="dm-item-edit-group">
                      <h4>Spell Effects</h4>
                      <div className="dm-item-edit-grid">
                        {spellBonusOptions.map((option) => (
                          <label key={option.id} className="dm-field">
                            <span>{option.label}</span>
                            <input
                              type="number"
                              value={selectedBlueprint.baseProfile.spellBonuses[option.id] ?? ""}
                              onChange={(event) =>
                                updateItemBlueprint(selectedBlueprint.id, (current) => ({
                                  ...current,
                                  baseProfile: setProfileSpellValue(
                                    current.baseProfile,
                                    option.id,
                                    parseNumericInput(event.target.value)
                                  ),
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Visible Notes And Requirements</h3>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Visible Notes</span>
                        <textarea
                          className="notes-input"
                          value={selectedBlueprint.visibleNotes.join("\n")}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              visibleNotes: splitLines(event.target.value),
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Requirements</span>
                        <textarea
                          className="notes-input"
                          value={selectedBlueprint.requirements.join("\n")}
                          onChange={(event) =>
                            updateItemBlueprint(selectedBlueprint.id, (current) => ({
                              ...current,
                              requirements: splitLines(event.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Referenced Items</h3>
                    {pendingDeleteId === selectedBlueprint.id && referencingItems.length > 0 ? (
                      <p className="dm-summary-line">
                        This blueprint cannot be deleted while item instances still reference it.
                      </p>
                    ) : null}
                    {referencingItems.length === 0 ? (
                      <p className="empty-block-copy">No items currently use this blueprint.</p>
                    ) : (
                      <div className="dm-related-list">
                        {referencingItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="dm-related-entry"
                            onClick={() => navigate(`/dm/items/edit?itemId=${encodeURIComponent(item.id)}`)}
                          >
                            <strong>{item.name}</strong>
                            <span>{item.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="dm-item-editor-section">
                    <h3>Override Exceptions</h3>
                    {selectedBlueprint.overrideItemIds.length === 0 ? (
                      <p className="empty-block-copy">No item-specific base overrides are tracked for this blueprint.</p>
                    ) : (
                      <div className="dm-related-list">
                        {selectedBlueprint.overrideItemIds.map((itemId) => {
                          const item = items.find((entry) => entry.id === itemId) ?? null;
                          return (
                            <button
                              key={itemId}
                              type="button"
                              className="dm-related-entry"
                              onClick={() => navigate(`/dm/items/edit?itemId=${encodeURIComponent(itemId)}`)}
                            >
                              <strong>{item?.name ?? itemId}</strong>
                              <span>{itemId}</span>
                            </button>
                          );
                        })}
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
