import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import {
  buildAuctionItemDraft,
  formatAuctionEntryStock,
  formatAuctionPrice,
  getAuctionHouseEntrySearchText,
  getAuctionHouseQualityOptions,
  getAuctionHouseTypeOptions,
  getDefaultAuctionHouseMetadata,
  inferAuctionEntryBlueprintId,
  parseAuctionHouseImport,
} from "../lib/auctionHouse.ts";
import { getItemCompactHeaderSummary } from "../lib/items.ts";
import { useAppFlow } from "../state/appFlow";

function clampCopyCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.min(20, parsed));
}

export function DmAuctionHousePage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    auctionEntries,
    itemBlueprints,
    items,
    createItem,
    replaceAuctionEntries,
    resetAuctionEntries,
  } = useAppFlow();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    auctionEntries[0]?.id ?? null
  );
  const [searchText, setSearchText] = useState("");
  const [qualityFilter, setQualityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [copyCount, setCopyCount] = useState("1");
  const [importPayload, setImportPayload] = useState("");
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const metadata = useMemo(() => getDefaultAuctionHouseMetadata(), []);
  const qualityOptions = useMemo(
    () => getAuctionHouseQualityOptions(auctionEntries),
    [auctionEntries]
  );
  const typeOptions = useMemo(
    () => getAuctionHouseTypeOptions(auctionEntries),
    [auctionEntries]
  );
  const filteredEntries = useMemo(
    () =>
      auctionEntries.filter((entry) => {
        if (
          searchText.trim().length > 0 &&
          !getAuctionHouseEntrySearchText(entry).includes(searchText.trim().toLowerCase())
        ) {
          return false;
        }
        if (qualityFilter && entry.itemQuality !== qualityFilter) {
          return false;
        }
        if (typeFilter && entry.typeLabel !== typeFilter) {
          return false;
        }
        return true;
      }),
    [auctionEntries, qualityFilter, searchText, typeFilter]
  );

  useEffect(() => {
    if (
      selectedEntryId &&
      filteredEntries.some((entry) => entry.id === selectedEntryId)
    ) {
      return;
    }

    setSelectedEntryId(filteredEntries[0]?.id ?? null);
  }, [filteredEntries, selectedEntryId]);

  const selectedEntry =
    filteredEntries.find((entry) => entry.id === selectedEntryId) ??
    auctionEntries.find((entry) => entry.id === selectedEntryId) ??
    filteredEntries[0] ??
    null;
  const selectedEntryLinkedItems = selectedEntry
    ? items.filter((item) => item.auctionEntryId === selectedEntry.id)
    : [];
  const inferredBlueprintId = selectedEntry
    ? inferAuctionEntryBlueprintId(selectedEntry)
    : null;
  const inferredBlueprintLabel =
    inferredBlueprintId
      ? itemBlueprints.find((blueprint) => blueprint.id === inferredBlueprintId)?.label ??
        inferredBlueprintId
      : "-";

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function createItemsFromSelectedEntry(openAfterCreate = false): void {
    if (!selectedEntry) {
      return;
    }

    const requestedCount = clampCopyCount(copyCount);
    const draft = buildAuctionItemDraft(selectedEntry);
    let lastCreatedItemId: string | null = null;

    for (let index = 0; index < requestedCount; index += 1) {
      lastCreatedItemId = createItem(draft.blueprintId, draft.overrides);
    }

    setPanelMessage(
      requestedCount === 1
        ? `Created ${selectedEntry.itemName} as a shared item draft.`
        : `Created ${requestedCount} ${selectedEntry.itemName} item drafts.`
    );

    if (openAfterCreate && lastCreatedItemId) {
      navigate(`/dm/items/edit?itemId=${encodeURIComponent(lastCreatedItemId)}`);
    }
  }

  function replaceFromImport(): void {
    const parsed = parseAuctionHouseImport(importPayload);
    if ("error" in parsed) {
      setPanelMessage(parsed.error);
      return;
    }

    replaceAuctionEntries(parsed.entries);
    setSelectedEntryId(parsed.entries[0]?.id ?? null);
    setImportPayload("");
    setPanelMessage(`Loaded ${parsed.entries.length} auction-house entries.`);
  }

  function resetToSeed(): void {
    resetAuctionEntries();
    setPanelMessage("Reset the auction house back to the workbook seed.");
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Auction House</h1>
            <p className="dm-summary-line">
              Browse seeded catalog rows, import pasted spreadsheet rows, and turn them into shared item drafts.
            </p>
          </div>
          <div className="dm-nav-actions dm-nav-actions-wrap">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm/items/edit")}>
              Item Editing
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm/items")}>
              Items List
            </button>
          </div>
        </header>

        <section className="flow-card flow-card-wide">
          <div className="dm-item-edit-layout">
            <article className="sheet-card dm-item-picker-card">
              <p className="section-kicker">Catalog Filters</p>
              <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                <label className="dm-field">
                  <span>Search</span>
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Name, bonus, label, remarks"
                  />
                </label>
                <label className="dm-field">
                  <span>Copies To Create</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={copyCount}
                    onChange={(event) => setCopyCount(event.target.value)}
                  />
                </label>
                <label className="dm-field">
                  <span>Quality</span>
                  <select value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value)}>
                    <option value="">All</option>
                    {qualityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dm-field">
                  <span>Type</span>
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option value="">All</option>
                    {typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="dm-summary-line">
                Session window {metadata.validSessionWindow || "-"} | Last session {metadata.lastFinishedSessionNumber || "-"} on {metadata.lastSessionDate || "-"}
              </p>
              {metadata.notes.length > 0 ? (
                <p className="dm-summary-line">{metadata.notes.join(" | ")}</p>
              ) : null}

              <div className="dm-item-picker-list">
                {filteredEntries.length === 0 ? (
                  <p className="empty-block-copy">No auction entries match the current filters.</p>
                ) : (
                  filteredEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`dm-item-picker-button${entry.id === selectedEntry?.id ? " is-active" : ""}`}
                      onClick={() => setSelectedEntryId(entry.id)}
                    >
                      <strong>{entry.itemName}</strong>
                      <span>{entry.itemQuality || "No quality"} | {entry.typeLabel || "No type"}</span>
                      <small>
                        Bid {formatAuctionPrice(entry.bid)} | Buyout {formatAuctionPrice(entry.buyout)} | Stock {formatAuctionEntryStock(entry)}
                      </small>
                    </button>
                  ))
                )}
              </div>
            </article>

            <article className="sheet-card dm-item-editor-card">
              {!selectedEntry ? (
                <p className="empty-block-copy">Select an auction entry to review it.</p>
              ) : (
                <div className="dm-item-editor-stack">
                  <section className="dm-item-editor-section">
                    <div className="dm-item-summary-head">
                      <div>
                        <p className="section-kicker">Auction Entry</p>
                        <h2>{selectedEntry.itemName}</h2>
                      </div>
                      <div className="row-side">
                        <strong>{selectedEntry.itemQuality || "Unrated"}</strong>
                        <p>Row {selectedEntry.sourceRow ?? "-"}</p>
                      </div>
                    </div>

                    <div className="dm-item-line-grid">
                      <div>
                        <strong>Price</strong>
                        <p>Bid {formatAuctionPrice(selectedEntry.bid)} | Buyout {formatAuctionPrice(selectedEntry.buyout)}</p>
                      </div>
                      <div>
                        <strong>Stock</strong>
                        <p>{formatAuctionEntryStock(selectedEntry)}</p>
                      </div>
                      <div>
                        <strong>Slot / Type</strong>
                        <p>{selectedEntry.bodyPart || "-"} | {selectedEntry.typeLabel || "-"}</p>
                      </div>
                      <div>
                        <strong>Spec</strong>
                        <p>{selectedEntry.spec || "-"}</p>
                      </div>
                      <div>
                        <strong>Bonus Text</strong>
                        <p>{selectedEntry.bonus || "-"}</p>
                      </div>
                      <div>
                        <strong>Remarks</strong>
                        <p>{selectedEntry.remarks || "-"}</p>
                      </div>
                      <div>
                        <strong>Labels</strong>
                        <p>{selectedEntry.itemLabels.join(", ") || "-"}</p>
                      </div>
                      <div>
                        <strong>Inferred Blueprint</strong>
                        <p>{inferredBlueprintLabel}</p>
                      </div>
                    </div>

                    <div className="dm-item-edit-actions">
                      <button type="button" className="flow-primary" onClick={() => createItemsFromSelectedEntry(true)}>
                        Create And Open
                      </button>
                      <button type="button" className="flow-secondary" onClick={() => createItemsFromSelectedEntry(false)}>
                        Create Draft Item
                      </button>
                      <button type="button" className="flow-secondary" onClick={() => navigate("/dm/items")}>
                        Open Items List
                      </button>
                    </div>

                    <p className="dm-summary-line">
                      Auto-created drafts keep the auction link, infer the closest blueprint, and preserve raw bonus text as draft item notes for later DM refinement.
                    </p>
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Linked Items</p>
                    <h3>Created Shared Items</h3>
                    {selectedEntryLinkedItems.length === 0 ? (
                      <p className="empty-block-copy">No shared items have been created from this auction entry yet.</p>
                    ) : (
                      <div className="dm-related-list">
                        {selectedEntryLinkedItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="dm-related-entry"
                            onClick={() => navigate(`/dm/items/edit?itemId=${encodeURIComponent(item.id)}`)}
                          >
                            <strong>{item.name}</strong>
                            <span>{getItemCompactHeaderSummary(item, { itemBlueprints })}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Import</p>
                    <h3>Replace Auction Rows</h3>
                    <p className="dm-summary-line">
                      Paste spreadsheet rows with the auction header row included, or paste a JSON array of auction entries.
                    </p>
                    <label className="dm-field">
                      <span>Import Payload</span>
                      <textarea
                        className="notes-input"
                        value={importPayload}
                        onChange={(event) => setImportPayload(event.target.value)}
                        placeholder="Paste Action House rows or JSON here"
                      />
                    </label>
                    <div className="dm-item-edit-actions">
                      <button type="button" className="flow-primary" onClick={replaceFromImport}>
                        Replace Auction Entries
                      </button>
                      <button type="button" className="flow-secondary" onClick={resetToSeed}>
                        Reset To Workbook Seed
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </article>
          </div>

          {panelMessage ? <p className="dm-summary-line">{panelMessage}</p> : null}
        </section>
      </section>
    </main>
  );
}
