import assert from "node:assert/strict";

import {
  buildAuctionItemDraft,
  completeAuctionTransaction,
  createDefaultAuctionHouseEntries,
  getDefaultAuctionHouseMetadata,
  parseAuctionHouseImport,
} from "../src/lib/auctionHouse.ts";
import { createSharedItemRecord } from "../src/lib/items.ts";
import { runTestSuite } from "./harness.ts";

export async function runAuctionHouseTests(): Promise<void> {
  await runTestSuite("auctionHouse", [
    {
      name: "default auction seed exposes workbook metadata and entries",
      run: () => {
        const metadata = getDefaultAuctionHouseMetadata();
        const entries = createDefaultAuctionHouseEntries();

        assert.equal(metadata.lastSessionDate, "2025.09.03");
        assert.equal(metadata.lastFinishedSessionNumber, "26");
        assert.ok(entries.length > 100);
        assert.equal(entries[0]?.itemName, "Occult Item");
      },
    },
    {
      name: "tabular auction import accepts pasted workbook rows with the header row",
      run: () => {
        const pastedRows = [
          "\tBid\tBuyout\tItem Name\tItem Quantity\tItem Quality\tBody Part\tSpec\tBonus\tType\tRemarks\tItem Labels",
          "\t0\t40\tOccult Item\ttoo many in stock\t0. Common\tHands\tWhen Equipped / Active\tMana +1\tOccult\t\tMana",
          "\t7\t10\tFrozen Orb\tOut of Stock\t1. Uncommon\t-\tSingle Use\t7 Cold Damage\tAmmunition\t\tDmg, Range",
        ].join("\n");
        const parsed = parseAuctionHouseImport(pastedRows);

        if ("error" in parsed) {
          throw new Error(parsed.error);
        }

        assert.equal(parsed.entries.length, 2);
        assert.equal(parsed.entries[0]?.itemName, "Occult Item");
        assert.equal(parsed.entries[0]?.stockQuantity, 20);
        assert.equal(parsed.entries[1]?.typeLabel, "Ammunition");
        assert.equal(parsed.entries[1]?.stockQuantity, 0);
        assert.deepEqual(parsed.entries[1]?.itemLabels, ["Dmg", "Range"]);
      },
    },
    {
      name: "auction item draft preserves source link and raw bonus note",
      run: () => {
        const entry = createDefaultAuctionHouseEntries()[0]!;
        const draft = buildAuctionItemDraft(entry);
        const item = createSharedItemRecord(draft.blueprintId, {
          id: "auction-draft-item-1",
          ...draft.overrides,
        });

        assert.equal(item.auctionEntryId, entry.id);
        assert.equal(item.name, entry.itemName);
        assert.match(item.baseDescription, /Quality:/);
        assert.deepEqual(item.bonusProfile.notes, [entry.bonus]);
      },
    },
    {
      name: "completed auction transactions create an assigned item and decrement live stock",
      run: () => {
        const result = completeAuctionTransaction({
          entry: {
            id: "auction-entry-test",
            sourceRow: 1,
            bid: 7,
            buyout: 10,
            itemName: "Frozen Orb",
            itemQuantity: "3 (have bids)",
            stockQuantity: 3,
            itemQuality: "1. Uncommon",
            bodyPart: "-",
            spec: "Single Use",
            bonus: "7 Cold Damage",
            typeLabel: "Ammunition",
            remarks: "",
            itemLabels: ["Dmg", "Range"],
          },
          mode: "bid",
          characterId: "character-1",
          characterName: "Mira",
          characterMoney: 7_000,
          characterGameDateTime: "17.09.2124 - 08:00",
          itemBlueprints: [],
          now: new Date("2026-04-20T10:00:00.000Z"),
        });

        if ("error" in result) {
          throw new Error(result.error);
        }

        assert.equal(result.nextEntry.stockQuantity, 2);
        assert.equal(result.createdItem.auctionEntryId, "auction-entry-test");
        assert.equal(result.createdItem.assignedCharacterId, "character-1");
        assert.equal(result.moneySpent, 7_000);
        assert.match(result.historyEntry.note, /Won bid on Frozen Orb/);
      },
    },
  ]);
}
