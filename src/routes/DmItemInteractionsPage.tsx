import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { KnowledgeCardView } from "../components/player-character/KnowledgeCardView.tsx";
import { KnowledgeRevisionDialog } from "../components/player-character/KnowledgeRevisionDialog.tsx";
import type { GameHistoryEntry } from "../config/characterTemplate.ts";
import { prependGameHistoryEntry } from "../lib/historyEntries.ts";
import {
  applyKnowledgeBatch,
  createItemKnowledgeRevision,
  createItemKnowledgeShareResult,
  findKnowledgeEntityBySubjectKey,
  getKnowledgeEntityById,
  getKnowledgeRevisionById,
} from "../lib/knowledge.ts";
import {
  buildItemIndex,
  getItemBlueprintLabel,
  getItemCompactHeaderSummary,
} from "../lib/items.ts";
import { useAppFlow } from "../state/appFlow";
import {
  SUPPLEMENTARY_EQUIPMENT_SLOT_IDS,
  SUPPLEMENTARY_EQUIPMENT_SLOT_LABELS,
} from "../types/items.ts";

function sortCharacters<T extends { id: string; sheet: { name: string } }>(characters: T[]): T[] {
  return [...characters].sort((left, right) =>
    (left.sheet.name.trim() || left.id).localeCompare(right.sheet.name.trim() || right.id)
  );
}

export function DmItemInteractionsPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    characters,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
    itemBlueprints,
    items,
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
    updateCharacter,
    updateItem,
    updateKnowledgeState,
    setCharacterSupplementarySlotEnabled,
  } = useAppFlow();
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [openKnowledgeRevisionId, setOpenKnowledgeRevisionId] = useState<string | null>(null);

  const sortedCharacters = useMemo(() => sortCharacters(characters), [characters]);
  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
      ),
    [items]
  );
  const itemsById = useMemo(() => buildItemIndex(items), [items]);
  const knowledgeState = {
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
  };
  const itemRulesContext = {
    itemBlueprints,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
  };

  useEffect(() => {
    if (selectedItemId && itemsById[selectedItemId]) {
      return;
    }

    setSelectedItemId(sortedItems[0]?.id ?? "");
  }, [itemsById, selectedItemId, sortedItems]);

  const selectedRecipients = sortedCharacters.filter((character) =>
    selectedRecipientIds.includes(character.id)
  );
  const selectedItem = selectedItemId ? itemsById[selectedItemId] ?? null : null;
  const selectedItemEntity =
    selectedItem !== null
      ? findKnowledgeEntityBySubjectKey(knowledgeState, "item", selectedItem.id)
      : null;
  const selectedItemRevisions = useMemo(() => {
    if (!selectedItemEntity) {
      return [];
    }

    return knowledgeRevisions
      .filter((revision) => revision.entityId === selectedItemEntity.id)
      .sort((left, right) => right.revisionNumber - left.revisionNumber);
  }, [knowledgeRevisions, selectedItemEntity]);

  useEffect(() => {
    if (selectedItemRevisions.length === 0) {
      setSelectedRevisionId(null);
      return;
    }

    if (
      selectedRevisionId &&
      selectedItemRevisions.some((revision) => revision.id === selectedRevisionId)
    ) {
      return;
    }

    setSelectedRevisionId(selectedItemRevisions[0]?.id ?? null);
  }, [selectedItemRevisions, selectedRevisionId]);

  const selectedRevision =
    selectedItemRevisions.find((revision) => revision.id === selectedRevisionId) ??
    selectedItemRevisions[0] ??
    null;
  const openKnowledgeRevision =
    openKnowledgeRevisionId !== null
      ? getKnowledgeRevisionById(knowledgeState, openKnowledgeRevisionId)
      : null;
  const openKnowledgeEntity =
    openKnowledgeRevision !== null
      ? getKnowledgeEntityById(knowledgeState, openKnowledgeRevision.entityId)
      : null;

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function toggleRecipient(characterId: string, isChecked: boolean): void {
    setSelectedRecipientIds((currentIds) =>
      isChecked
        ? [...new Set([...currentIds, characterId])]
        : currentIds.filter((entryId) => entryId !== characterId)
    );
  }

  function applySupplementarySlotChange(
    slotId: (typeof SUPPLEMENTARY_EQUIPMENT_SLOT_IDS)[number],
    isEnabled: boolean
  ): void {
    selectedRecipients.forEach((character) => {
      setCharacterSupplementarySlotEnabled(character.id, slotId, isEnabled);
    });
  }

  function appendHistoryEntries(
    entries: Array<{ characterId: string; entry: GameHistoryEntry }>
  ): void {
    entries.forEach(({ characterId, entry }) => {
      updateCharacter(characterId, (currentSheet) => ({
        ...currentSheet,
        gameHistory: prependGameHistoryEntry(currentSheet.gameHistory ?? [], entry),
      }));
    });
  }

  function handleGenerateItemCard(): void {
    if (!selectedItem) {
      return;
    }

    const created = createItemKnowledgeRevision({
      state: knowledgeState,
      item: selectedItem,
      createdByCharacterId: null,
      sourceType: "dm_grant",
      isCanonical: true,
      context: itemRulesContext,
    });
    const nextState = applyKnowledgeBatch(knowledgeState, created.batch);

    updateKnowledgeState(nextState);
    setSelectedRevisionId(created.revision.id);
  }

  function handleShareSelectedRevision(): void {
    if (!selectedItem || !selectedItemEntity || !selectedRevision || selectedRecipients.length === 0) {
      return;
    }

    const result = createItemKnowledgeShareResult({
      state: knowledgeState,
      item: selectedItem,
      entity: selectedItemEntity,
      revision: selectedRevision,
      sourceOwnerCharacterId: null,
      sourceOwnerName: "DM",
      recipientCharacters: selectedRecipients,
    });

    updateKnowledgeState(applyKnowledgeBatch(knowledgeState, result.batch));
    updateItem(selectedItem.id, result.item);
    appendHistoryEntries(result.historyEntries);
  }

  return (
    <main className="sheet-page">
      <section className="sheet-frame">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Item Interactions</h1>
            <p className="dm-summary-line">
              Activate supplementary slots and manage item knowledge cards.
            </p>
          </div>
          <div className="dm-nav-actions dm-nav-actions-wrap">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
            <button
              type="button"
              className="sheet-nav-button"
              onClick={() => navigate("/dm/items/edit")}
            >
              Item Editing
            </button>
          </div>
        </header>

        <section className="dm-hub-grid">
          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Recipients</p>
            <h2>Character Selection</h2>
            {sortedCharacters.length === 0 ? (
              <p className="empty-block-copy">No characters available.</p>
            ) : (
              <div className="knowledge-recipient-list">
                {sortedCharacters.map((character) => (
                  <label key={character.id} className="knowledge-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedRecipientIds.includes(character.id)}
                      onChange={(event) => toggleRecipient(character.id, event.target.checked)}
                    />
                    <span>{character.sheet.name.trim() || character.id}</span>
                  </label>
                ))}
              </div>
            )}
          </article>

          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Supplementary Slots</p>
            <h2>Activation</h2>
            <p className="dm-summary-line">
              Disabling a slot clears that equipped slot for the selected characters.
            </p>
            {SUPPLEMENTARY_EQUIPMENT_SLOT_IDS.map((slotId) => {
              const enabledCount = selectedRecipients.filter((character) =>
                character.sheet.enabledSupplementarySlotIds.includes(slotId)
              ).length;

              return (
                <div key={slotId} className="equipment-compact-row">
                  <div className="equipment-compact-main">
                    <strong>{SUPPLEMENTARY_EQUIPMENT_SLOT_LABELS[slotId]}</strong>
                    <span className="equipment-line-detail">
                      {selectedRecipients.length === 0
                        ? "Select recipients first."
                        : `${enabledCount}/${selectedRecipients.length} enabled`}
                    </span>
                  </div>
                  <div className="equipment-inline-actions">
                    <button
                      type="button"
                      className="equipment-inline-button"
                      disabled={selectedRecipients.length === 0}
                      onClick={() => applySupplementarySlotChange(slotId, true)}
                    >
                      Enable
                    </button>
                    <button
                      type="button"
                      className="equipment-inline-button"
                      disabled={selectedRecipients.length === 0}
                      onClick={() => applySupplementarySlotChange(slotId, false)}
                    >
                      Disable
                    </button>
                  </div>
                </div>
              );
            })}
          </article>
        </section>

        <section className="dm-item-edit-layout">
          <article className="sheet-card dm-item-picker-card">
            <p className="section-kicker">Shared Items</p>
            <h2>Item Picker</h2>
            <div className="dm-item-picker-list">
              {sortedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`dm-item-picker-button${item.id === selectedItemId ? " is-active" : ""}`}
                  onClick={() => setSelectedItemId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span>{getItemBlueprintLabel(item, itemBlueprints)}</span>
                  <small>{getItemCompactHeaderSummary(item, itemRulesContext)}</small>
                </button>
              ))}
            </div>
          </article>

          <article className="sheet-card dm-item-editor-card">
            {!selectedItem ? (
              <>
                <p className="section-kicker">Item Knowledge</p>
                <h2>No Item Selected</h2>
                <p className="empty-block-copy">Select an item to manage its knowledge card.</p>
              </>
            ) : (
              <>
                <p className="section-kicker">Item Knowledge</p>
                <h2>{selectedItem.name}</h2>
                <p className="dm-summary-line">
                  {getItemCompactHeaderSummary(selectedItem, itemRulesContext)}
                </p>

                <div className="equipment-inline-actions">
                  <button
                    type="button"
                    className="flow-primary"
                    onClick={handleGenerateItemCard}
                  >
                    {selectedItemRevisions.length === 0 ? "Generate Card" : "Refresh Card"}
                  </button>
                  <button
                    type="button"
                    className="flow-secondary"
                    disabled={!selectedRevision}
                    onClick={() =>
                      selectedRevision ? setOpenKnowledgeRevisionId(selectedRevision.id) : undefined
                    }
                  >
                    Open Revision
                  </button>
                  <button
                    type="button"
                    className="flow-secondary"
                    disabled={!selectedRevision || selectedRecipients.length === 0}
                    onClick={handleShareSelectedRevision}
                  >
                    Share To Selected
                  </button>
                </div>

                {selectedItemRevisions.length > 0 ? (
                  <label className="dm-field">
                    <span>Revision</span>
                    <select
                      value={selectedRevision?.id ?? ""}
                      onChange={(event) => setSelectedRevisionId(event.target.value || null)}
                    >
                      {selectedItemRevisions.map((revision) => (
                        <option key={revision.id} value={revision.id}>
                          v{revision.revisionNumber} - {revision.summary || revision.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {selectedItemEntity && selectedRevision ? (
                  <KnowledgeCardView
                    entity={selectedItemEntity}
                    revision={selectedRevision}
                  />
                ) : (
                  <p className="empty-block-copy">
                    No item card generated yet for this item.
                  </p>
                )}
              </>
            )}
          </article>
        </section>
      </section>

      <KnowledgeRevisionDialog
        entity={openKnowledgeEntity}
        revision={openKnowledgeRevision}
        ownership={null}
        onClose={() => setOpenKnowledgeRevisionId(null)}
      />
    </main>
  );
}
