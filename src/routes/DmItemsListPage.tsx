import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import {
  getItemBaseCharacterImpactSummary,
  getItemBaseVisibleStats,
  getItemBlueprintLabel,
  getItemCharacterImpactSummary,
  getItemCompactHeaderSummary,
  getItemCustomPropertySummary,
  getItemPropertyPoints,
  getItemPowerBonusSummary,
  getItemSpellBonusSummary,
  getItemTierLabel,
} from "../lib/items.ts";
import { useAppFlow } from "../state/appFlow";
import type { CharacterRecord } from "../types/character.ts";
import type { SharedItemRecord } from "../types/items.ts";

function sortItems(items: SharedItemRecord[]): SharedItemRecord[] {
  return [...items].sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return left.id.localeCompare(right.id);
  });
}

function sortCharacters(characters: CharacterRecord[]): CharacterRecord[] {
  return [...characters].sort((left, right) => {
    const nameCompare = left.sheet.name.localeCompare(right.sheet.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return left.id.localeCompare(right.id);
  });
}

function formatSummary(lines: string[]): string {
  return lines.length > 0 ? lines.join(" | ") : "None";
}

function hasAnyBonusValue(item: SharedItemRecord): boolean {
  return (
    Object.keys(item.bonusProfile.statBonuses).length > 0 ||
    Object.keys(item.bonusProfile.skillBonuses).length > 0 ||
    Object.keys(item.bonusProfile.derivedBonuses).length > 0 ||
    Object.keys(item.bonusProfile.resistanceBonuses).length > 0 ||
    Object.keys(item.bonusProfile.powerBonuses).length > 0 ||
    Object.keys(item.bonusProfile.spellBonuses).length > 0 ||
    item.bonusProfile.utilityTraits.length > 0 ||
    item.bonusProfile.notes.length > 0
  );
}

function isAccidentalNewItem(item: SharedItemRecord): boolean {
  return (
    item.name.trim() === "New Item" &&
    item.assignedCharacterId === null &&
    item.baseDescription.trim().length === 0 &&
    item.customProperties.length === 0 &&
    getItemPropertyPoints(item) === 0 &&
    !hasAnyBonusValue(item)
  );
}

export function DmItemsListPage() {
  const navigate = useNavigate();
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const {
    roleChoice,
    characters,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
    itemBlueprints,
    items,
    assignItemToCharacter,
    deleteItem,
  } = useAppFlow();
  const sortedItems = useMemo(() => sortItems(items), [items]);
  const sortedCharacters = useMemo(() => sortCharacters(characters), [characters]);
  const itemRulesContext = {
    itemBlueprints,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
  };
  const accidentalNewItems = useMemo(
    () => sortedItems.filter((item) => isAccidentalNewItem(item)),
    [sortedItems]
  );

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  return (
    <main className="flow-page">
      <section className="flow-card flow-card-wide dm-items-list-card">
        <p className="section-kicker">Dungeon Master</p>
        <h1>Items List</h1>
        <p className="dm-summary-line">
          Browse blueprint-backed item instances, expand rows for details, and assign items to characters.
        </p>

        <div className="flow-actions dm-items-list-actions">
          <button type="button" className="flow-primary" onClick={() => navigate("/dm/items/edit?create=1")}>
            Create New Item
          </button>
          {accidentalNewItems.length > 0 ? (
            confirmBulkDelete ? (
              <>
                <button
                  type="button"
                  className="flow-danger"
                  onClick={() => {
                    accidentalNewItems.forEach((item) => deleteItem(item.id));
                    setConfirmBulkDelete(false);
                    setExpandedItemId((current) =>
                      current && accidentalNewItems.some((item) => item.id === current) ? null : current
                    );
                  }}
                >
                  Delete {accidentalNewItems.length} New Item Entries
                </button>
                <button
                  type="button"
                  className="flow-cancel"
                  onClick={() => setConfirmBulkDelete(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="flow-danger"
                onClick={() => setConfirmBulkDelete(true)}
              >
                Delete Duplicate New Items ({accidentalNewItems.length})
              </button>
            )
          ) : null}
          <button type="button" className="flow-secondary" onClick={() => navigate("/dm/items/blueprints")}>
            Blueprint Management
          </button>
          <button type="button" className="flow-secondary" onClick={() => navigate("/dm/items/definitions")}>
            Definition Management
          </button>
          <button type="button" className="flow-secondary" onClick={() => navigate("/dm")}>
            Back To DM Dashboard
          </button>
        </div>

        <div className="dm-item-lines">
          {sortedItems.length === 0 ? (
            <p className="empty-block-copy">No item instances exist yet.</p>
          ) : (
            sortedItems.map((item) => {
              const isExpanded = expandedItemId === item.id;
              const assignedCharacter =
                item.assignedCharacterId
                  ? characters.find((character) => character.id === item.assignedCharacterId) ?? null
                  : null;

              return (
                <article key={item.id} className={`dm-item-line${isExpanded ? " is-expanded" : ""}`}>
                  <button
                    type="button"
                    className="dm-item-line-toggle"
                    onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  >
                    <span className="dm-item-line-main">
                      <strong>{item.name}</strong>
                      <small>{getItemBlueprintLabel(item, itemBlueprints)}</small>
                      <small>{getItemCompactHeaderSummary(item, itemRulesContext)}</small>
                    </span>
                    <span className="dm-item-line-side">
                      <span>PP {getItemPropertyPoints(item)}</span>
                      <span>{getItemTierLabel(item)}</span>
                      <span>{assignedCharacter?.sheet.name || "Unassigned"}</span>
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="dm-item-line-body">
                      <div className="dm-item-line-grid">
                        <div>
                          <strong>Base Visible Stats</strong>
                          <p>{formatSummary(getItemBaseVisibleStats(item, itemRulesContext))}</p>
                        </div>
                        <div>
                          <strong>Base Character Effects</strong>
                          <p>{formatSummary(getItemBaseCharacterImpactSummary(item))}</p>
                        </div>
                        <div>
                          <strong>Bonus Character Effects</strong>
                          <p>{formatSummary(getItemCharacterImpactSummary(item))}</p>
                        </div>
                        <div>
                          <strong>Power Bonuses</strong>
                          <p>{formatSummary(getItemPowerBonusSummary(item))}</p>
                        </div>
                        <div>
                          <strong>Spell Bonuses</strong>
                          <p>{formatSummary(getItemSpellBonusSummary(item))}</p>
                        </div>
                        <div>
                          <strong>Custom Properties</strong>
                          <p>{formatSummary(getItemCustomPropertySummary(item))}</p>
                        </div>
                      </div>

                      <div className="dm-item-line-actions">
                        <label className="dm-field dm-item-assign-field">
                          <span>Assigned Character</span>
                          <select
                            value={item.assignedCharacterId ?? ""}
                            onChange={(event) =>
                              assignItemToCharacter(item.id, event.target.value || null)
                            }
                          >
                            <option value="">Unassigned</option>
                            {sortedCharacters.map((character) => (
                              <option key={character.id} value={character.id}>
                                {(character.sheet.name || "Unnamed Character").trim()} ({character.ownerRole})
                              </option>
                            ))}
                          </select>
                        </label>

                        <button
                          type="button"
                          className="flow-secondary"
                          onClick={() => navigate(`/dm/items/edit?itemId=${encodeURIComponent(item.id)}`)}
                        >
                          Edit Item
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
