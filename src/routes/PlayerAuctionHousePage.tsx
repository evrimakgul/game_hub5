import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import {
  formatAuctionEntryStock,
  formatAuctionPrice,
  getAuctionEntryAvailableStock,
  getAuctionHouseEntrySearchText,
  getAuctionHouseQualityOptions,
  getAuctionHouseTypeOptions,
  getAuctionTransactionMoneyCost,
} from "../lib/auctionHouse.ts";
import { getItemCompactHeaderSummary } from "../lib/items.ts";
import { useAppFlow } from "../state/appFlow";
import type { CharacterRecord } from "../types/character.ts";
import type { AuctionTransactionMode } from "../types/auction.ts";

function buildTransactionDisabledReason(args: {
  mode: AuctionTransactionMode;
  availableStock: number | null;
  moneyCost: number | null;
  currentMoney: number;
}): string | null {
  if (args.availableStock === null) {
    return "Stock is not set yet.";
  }

  if (args.availableStock <= 0) {
    return "Out of stock.";
  }

  if (args.moneyCost === null) {
    return args.mode === "bid" ? "Bid unavailable." : "Buyout unavailable.";
  }

  if (args.currentMoney < args.moneyCost) {
    return `Needs ${args.moneyCost.toLocaleString()} money.`;
  }

  return null;
}

export function PlayerAuctionHousePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    roleChoice,
    characters,
    auctionEntries,
    itemBlueprints,
    items,
    activePlayerCharacter,
    selectCharacter,
    completeAuctionTransaction,
  } = useAppFlow();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    auctionEntries[0]?.id ?? null
  );
  const [searchText, setSearchText] = useState("");
  const [qualityFilter, setQualityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const playerCharacters = useMemo(
    () => characters.filter((character) => character.ownerRole === "player"),
    [characters]
  );
  const characterIdFromQuery = new URLSearchParams(location.search).get("characterId");
  const activeCharacter =
    (characterIdFromQuery
      ? playerCharacters.find((character) => character.id === characterIdFromQuery) ?? null
      : null) ??
    activePlayerCharacter ??
    playerCharacters[0] ??
    null;
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

  if (roleChoice !== "player") {
    return <Navigate to="/role" replace />;
  }

  if (!activeCharacter) {
    return <Navigate to="/player" replace />;
  }

  const selectedEntry =
    filteredEntries.find((entry) => entry.id === selectedEntryId) ??
    auctionEntries.find((entry) => entry.id === selectedEntryId) ??
    filteredEntries[0] ??
    null;
  const ownedItemsFromSelectedEntry = selectedEntry
    ? items.filter(
        (item) =>
          item.auctionEntryId === selectedEntry.id &&
          item.assignedCharacterId === activeCharacter.id
      )
    : [];
  const availableStock = selectedEntry
    ? getAuctionEntryAvailableStock(selectedEntry)
    : null;
  const bidCost =
    selectedEntry ? getAuctionTransactionMoneyCost(selectedEntry, "bid") : null;
  const buyoutCost =
    selectedEntry ? getAuctionTransactionMoneyCost(selectedEntry, "buyout") : null;
  const bidDisabledReason = buildTransactionDisabledReason({
    mode: "bid",
    availableStock,
    moneyCost: bidCost,
    currentMoney: activeCharacter.sheet.money,
  });
  const buyoutDisabledReason = buildTransactionDisabledReason({
    mode: "buyout",
    availableStock,
    moneyCost: buyoutCost,
    currentMoney: activeCharacter.sheet.money,
  });

  function navigateToCharacterSheet(character: CharacterRecord): void {
    selectCharacter(character.id);
    navigate(`/player/character?characterId=${encodeURIComponent(character.id)}`);
  }

  function handleCharacterChange(characterId: string): void {
    selectCharacter(characterId);
    navigate(`/player/auction-house?characterId=${encodeURIComponent(characterId)}`);
  }

  function handleTransaction(mode: AuctionTransactionMode): void {
    if (!selectedEntry) {
      return;
    }

    const result = completeAuctionTransaction({
      entryId: selectedEntry.id,
      characterId: activeCharacter.id,
      mode,
    });
    setPanelMessage("error" in result ? result.error : result.message);
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Player</p>
            <h1>Auction House</h1>
            <p className="dm-summary-line">
              Shop as {activeCharacter.sheet.name.trim() || "Unnamed Character"} using live stock and character money.
            </p>
          </div>
          <div className="dm-nav-actions dm-nav-actions-wrap">
            <button
              type="button"
              className="sheet-nav-button"
              onClick={() => navigateToCharacterSheet(activeCharacter)}
            >
              Character Sheet
            </button>
            <button
              type="button"
              className="sheet-nav-button"
              onClick={() => navigate("/player")}
            >
              Player Hub
            </button>
          </div>
        </header>

        <section className="flow-card flow-card-wide">
          <div className="dm-item-edit-layout">
            <article className="sheet-card dm-item-picker-card">
              <p className="section-kicker">Shopping Context</p>
              <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                <label className="dm-field">
                  <span>Character</span>
                  <select
                    value={activeCharacter.id}
                    onChange={(event) => handleCharacterChange(event.target.value)}
                  >
                    {playerCharacters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.sheet.name.trim() || "Unnamed Character"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dm-field">
                  <span>Current Money</span>
                  <input value={activeCharacter.sheet.money.toLocaleString()} readOnly />
                </label>
                <label className="dm-field">
                  <span>Search</span>
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Name, bonus, label, remarks"
                  />
                </label>
                <label className="dm-field">
                  <span>Quality</span>
                  <select
                    value={qualityFilter}
                    onChange={(event) => setQualityFilter(event.target.value)}
                  >
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
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                  >
                    <option value="">All</option>
                    {typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

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
                      <span>
                        {entry.itemQuality || "No quality"} | {entry.typeLabel || "No type"}
                      </span>
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
                <p className="empty-block-copy">Select an item to shop it.</p>
              ) : (
                <div className="dm-item-editor-stack">
                  <section className="dm-item-editor-section">
                    <div className="dm-item-summary-head">
                      <div>
                        <p className="section-kicker">Auction Item</p>
                        <h2>{selectedEntry.itemName}</h2>
                      </div>
                      <div className="row-side">
                        <strong>{selectedEntry.itemQuality || "Unrated"}</strong>
                        <p>Stock {formatAuctionEntryStock(selectedEntry)}</p>
                      </div>
                    </div>

                    <div className="dm-item-line-grid">
                      <div>
                        <strong>Price</strong>
                        <p>
                          Bid {formatAuctionPrice(selectedEntry.bid)} | Buyout{" "}
                          {formatAuctionPrice(selectedEntry.buyout)}
                        </p>
                      </div>
                      <div>
                        <strong>Current Money</strong>
                        <p>{activeCharacter.sheet.money.toLocaleString()}</p>
                      </div>
                      <div>
                        <strong>Slot / Type</strong>
                        <p>
                          {selectedEntry.bodyPart || "-"} | {selectedEntry.typeLabel || "-"}
                        </p>
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
                        <strong>Owned Copies</strong>
                        <p>{ownedItemsFromSelectedEntry.length}</p>
                      </div>
                    </div>

                    <div className="dm-item-edit-actions">
                      <button
                        type="button"
                        className="flow-primary"
                        disabled={buyoutDisabledReason !== null}
                        title={buyoutDisabledReason ?? undefined}
                        onClick={() => handleTransaction("buyout")}
                      >
                        Buyout
                      </button>
                      <button
                        type="button"
                        className="flow-secondary"
                        disabled={bidDisabledReason !== null}
                        title={bidDisabledReason ?? undefined}
                        onClick={() => handleTransaction("bid")}
                      >
                        Bid
                      </button>
                    </div>

                    <p className="dm-summary-line">
                      Buyout or bid adds one shared item directly into this character&apos;s Items section and reduces stock by one.
                    </p>
                    <p className="dm-summary-line">
                      Bid resolves as a completed winning bid in this surface; unavailable prices or empty stock disable the action.
                    </p>
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Purchased Here</p>
                    <h3>Items On This Character</h3>
                    {ownedItemsFromSelectedEntry.length === 0 ? (
                      <p className="empty-block-copy">
                        This character does not own any copies from this auction entry yet.
                      </p>
                    ) : (
                      <div className="dm-related-list">
                        {ownedItemsFromSelectedEntry.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="dm-related-entry"
                            onClick={() => navigateToCharacterSheet(activeCharacter)}
                          >
                            <strong>{item.name}</strong>
                            <span>{getItemCompactHeaderSummary(item, { itemBlueprints })}</span>
                          </button>
                        ))}
                      </div>
                    )}
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
