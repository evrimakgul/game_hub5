import { AUCTION_HOUSE_SEED_ENTRIES, AUCTION_HOUSE_SEED_METADATA } from "../data/auctionHouseSeed.ts";
import { buildGameHistoryNoteEntry } from "./historyEntries.ts";
import { createTimestampedId } from "./ids.ts";
import {
  createEmptyBonusProfile,
  createSharedItemRecord,
  inferItemBlueprintId,
} from "./items.ts";
import type {
  AuctionHouseEntry,
  AuctionHouseMetadata,
  AuctionTransactionMode,
} from "../types/auction.ts";
import type {
  ItemBlueprintId,
  ItemBlueprintRecord,
  SharedItemRecord,
} from "../types/items.ts";

const AUCTION_HEADER_ALIASES: Record<string, keyof AuctionHouseEntry> = {
  bid: "bid",
  buyout: "buyout",
  "item name": "itemName",
  "item quantity": "itemQuantity",
  "item quality": "itemQuality",
  "body part": "bodyPart",
  spec: "spec",
  bonus: "bonus",
  type: "typeLabel",
  remarks: "remarks",
  "item labels": "itemLabels",
};

const AUCTION_PRICE_MULTIPLIER = 1000;
const TOO_MANY_IN_STOCK_FLOOR = 20;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const nextValue = normalizeText(value);
  if (!nextValue) {
    return null;
  }

  const parsed = Number.parseFloat(nextValue.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStringList(values: unknown): string[] {
  if (Array.isArray(values)) {
    return [...new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))];
  }

  const nextValue = normalizeText(values);
  if (!nextValue) {
    return [];
  }

  return [...new Set(nextValue.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

function normalizeStockQuantity(
  explicitValue: unknown,
  sourceText: unknown
): number | null {
  if (typeof explicitValue === "number" && Number.isFinite(explicitValue)) {
    return Math.max(0, Math.trunc(explicitValue));
  }

  const normalizedSource = normalizeText(sourceText).toLowerCase();
  if (!normalizedSource) {
    return null;
  }

  if (normalizedSource === "out of stock") {
    return 0;
  }

  if (normalizedSource === "too many in stock") {
    return TOO_MANY_IN_STOCK_FLOOR;
  }

  const numericMatch = normalizedSource.match(/^(\d+)/);
  if (!numericMatch) {
    return null;
  }

  return Math.max(0, Number.parseInt(numericMatch[1] ?? "0", 10));
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function splitDelimitedLine(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((entry) => entry.trim());
  }

  return line.split(",").map((entry) => entry.trim());
}

export function normalizeAuctionHouseEntry(
  value: Partial<Record<keyof AuctionHouseEntry, unknown>> & { id?: unknown }
): AuctionHouseEntry {
  const itemQuantity = normalizeText(value.itemQuantity);
  return {
    id: normalizeText(value.id) || createTimestampedId("auction-entry"),
    sourceRow:
      typeof value.sourceRow === "number" && Number.isFinite(value.sourceRow)
        ? Math.trunc(value.sourceRow)
        : null,
    bid: normalizeNumber(value.bid),
    buyout: normalizeNumber(value.buyout),
    itemName: normalizeText(value.itemName),
    itemQuantity,
    stockQuantity: normalizeStockQuantity(value.stockQuantity, itemQuantity),
    itemQuality: normalizeText(value.itemQuality),
    bodyPart: normalizeText(value.bodyPart),
    spec: normalizeText(value.spec),
    bonus: normalizeText(value.bonus),
    typeLabel: normalizeText(value.typeLabel),
    remarks: normalizeText(value.remarks),
    itemLabels: normalizeStringList(value.itemLabels),
  };
}

export function cloneAuctionHouseEntry(entry: AuctionHouseEntry): AuctionHouseEntry {
  return {
    ...entry,
    itemLabels: [...entry.itemLabels],
  };
}

export function getAuctionEntryAvailableStock(entry: AuctionHouseEntry): number | null {
  return entry.stockQuantity;
}

export function formatAuctionEntryStock(entry: AuctionHouseEntry): string {
  if (entry.stockQuantity !== null) {
    return entry.stockQuantity.toLocaleString();
  }

  return entry.itemQuantity || "-";
}

export function createDefaultAuctionHouseEntries(): AuctionHouseEntry[] {
  return AUCTION_HOUSE_SEED_ENTRIES.map((entry) => normalizeAuctionHouseEntry(entry));
}

export function getDefaultAuctionHouseMetadata(): AuctionHouseMetadata {
  return {
    ...AUCTION_HOUSE_SEED_METADATA,
    notes: [...AUCTION_HOUSE_SEED_METADATA.notes],
  };
}

export function getAuctionHouseEntrySearchText(entry: AuctionHouseEntry): string {
  return [
    entry.itemName,
    entry.itemQuality,
    entry.bodyPart,
    entry.spec,
    entry.bonus,
    entry.typeLabel,
    entry.remarks,
    entry.itemLabels.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

export function getAuctionHouseTypeOptions(entries: AuctionHouseEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.typeLabel).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

export function getAuctionHouseQualityOptions(entries: AuctionHouseEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.itemQuality).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

export function formatAuctionPrice(value: number | null): string {
  if (value === null) {
    return "-";
  }

  if (value === 0) {
    return "Unavailable";
  }

  return `${value.toLocaleString()} x1000`;
}

export function getAuctionTransactionMoneyCost(
  entry: AuctionHouseEntry,
  mode: AuctionTransactionMode
): number | null {
  const listedPrice = mode === "bid" ? entry.bid : entry.buyout;
  if (typeof listedPrice !== "number" || !Number.isFinite(listedPrice) || listedPrice <= 0) {
    return null;
  }

  return Math.max(0, Math.trunc(listedPrice * AUCTION_PRICE_MULTIPLIER));
}

function buildAuctionEntryIdFromName(itemName: string, offset: number): string {
  const slug = itemName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `auction-entry-${slug || "import"}-${offset + 1}`;
}

function parseAuctionEntryArray(value: unknown): AuctionHouseEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries = value
    .map((entry, index) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const nextEntry = normalizeAuctionHouseEntry({
        id:
          typeof record.id === "string" && record.id.trim().length > 0
            ? record.id
            : buildAuctionEntryIdFromName(normalizeText(record.itemName), index),
        sourceRow:
          typeof record.sourceRow === "number" && Number.isFinite(record.sourceRow)
            ? record.sourceRow
            : null,
        bid: record.bid,
        buyout: record.buyout,
        itemName: record.itemName,
        itemQuantity: record.itemQuantity,
        stockQuantity: record.stockQuantity,
        itemQuality: record.itemQuality,
        bodyPart: record.bodyPart,
        spec: record.spec,
        bonus: record.bonus,
        typeLabel: record.typeLabel,
        remarks: record.remarks,
        itemLabels: record.itemLabels,
      });

      return nextEntry.itemName ? nextEntry : null;
    })
    .filter((entry): entry is AuctionHouseEntry => entry !== null);

  return entries.length > 0 ? entries : null;
}

function parseTabularAuctionEntries(rawValue: string): AuctionHouseEntry[] | null {
  const rows = rawValue
    .split(/\r?\n/)
    .map((line) => splitDelimitedLine(line))
    .filter((columns) => columns.some((column) => column.trim().length > 0));
  if (rows.length === 0) {
    return null;
  }

  let headerIndex = -1;
  let headerMap: Partial<Record<keyof AuctionHouseEntry, number>> = {};

  rows.some((columns, index) => {
    const nextHeaderMap: Partial<Record<keyof AuctionHouseEntry, number>> = {};
    columns.forEach((column, columnIndex) => {
      const headerKey = AUCTION_HEADER_ALIASES[normalizeHeader(column)];
      if (headerKey) {
        nextHeaderMap[headerKey] = columnIndex;
      }
    });

    if (
      nextHeaderMap.bid !== undefined &&
      nextHeaderMap.buyout !== undefined &&
      nextHeaderMap.itemName !== undefined &&
      nextHeaderMap.bonus !== undefined &&
      nextHeaderMap.typeLabel !== undefined
    ) {
      headerIndex = index;
      headerMap = nextHeaderMap;
      return true;
    }

    return false;
  });

  if (headerIndex === -1) {
    return null;
  }

  const entries = rows
    .slice(headerIndex + 1)
    .map((columns, index) =>
      normalizeAuctionHouseEntry({
        id: buildAuctionEntryIdFromName(columns[headerMap.itemName ?? -1] ?? "", index),
        bid: columns[headerMap.bid ?? -1],
        buyout: columns[headerMap.buyout ?? -1],
        itemName: columns[headerMap.itemName ?? -1],
        itemQuantity: columns[headerMap.itemQuantity ?? -1],
        itemQuality: columns[headerMap.itemQuality ?? -1],
        bodyPart: columns[headerMap.bodyPart ?? -1],
        spec: columns[headerMap.spec ?? -1],
        bonus: columns[headerMap.bonus ?? -1],
        typeLabel: columns[headerMap.typeLabel ?? -1],
        remarks: columns[headerMap.remarks ?? -1],
        itemLabels: columns[headerMap.itemLabels ?? -1],
      })
    )
    .filter((entry) => entry.itemName.length > 0);

  return entries.length > 0 ? entries : null;
}

export function parseAuctionHouseImport(
  rawValue: string
): { entries: AuctionHouseEntry[] } | { error: string } {
  const normalizedValue = rawValue.replace(/^\uFEFF/, "");
  const trimmedValue = normalizedValue.trim();
  if (!trimmedValue) {
    return { error: "Paste auction-house rows or a JSON array first." };
  }

  if (trimmedValue.startsWith("[") || trimmedValue.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmedValue) as unknown;
      const entries =
        parseAuctionEntryArray(parsed) ??
        (typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        "entries" in parsed
          ? parseAuctionEntryArray((parsed as { entries?: unknown }).entries)
          : null);
      if (!entries) {
        return { error: "JSON import did not contain any valid auction entries." };
      }
      return { entries };
    } catch {
      return { error: "Could not parse the pasted JSON payload." };
    }
  }

  const entries = parseTabularAuctionEntries(normalizedValue);
  if (!entries) {
    return {
      error:
        "Could not find a valid auction-house header row. Paste spreadsheet rows that include Bid, Buyout, Item Name, Bonus, and Type.",
    };
  }

  return { entries };
}

export function inferAuctionEntryBlueprintId(entry: AuctionHouseEntry): ItemBlueprintId {
  return inferItemBlueprintId(
    entry.itemName,
    [entry.typeLabel, entry.bodyPart, entry.itemLabels.join(" ")].filter(Boolean).join(" "),
    [entry.spec, entry.remarks].filter(Boolean).join(" ")
  );
}

export function buildAuctionItemDraft(
  entry: AuctionHouseEntry
): {
  blueprintId: ItemBlueprintId;
  overrides: Partial<
    Pick<SharedItemRecord, "auctionEntryId" | "name" | "baseDescription" | "bonusProfile">
  >;
} {
  const blueprintId = inferAuctionEntryBlueprintId(entry);
  const baseDescriptionParts = [
    entry.itemQuality ? `Quality: ${entry.itemQuality}` : null,
    entry.bodyPart && entry.bodyPart !== "-" ? `Body Part: ${entry.bodyPart}` : null,
    entry.typeLabel ? `Type: ${entry.typeLabel}` : null,
    entry.spec ? `Spec: ${entry.spec}` : null,
    entry.itemQuantity ? `Stock: ${entry.itemQuantity}` : null,
    entry.remarks ? `Remarks: ${entry.remarks}` : null,
    entry.itemLabels.length > 0 ? `Labels: ${entry.itemLabels.join(", ")}` : null,
  ].filter((value): value is string => value !== null);
  const bonusNotes = [entry.bonus].filter((value) => value.trim().length > 0);

  return {
    blueprintId,
    overrides: {
      auctionEntryId: entry.id,
      name: entry.itemName || "Auction Item",
      baseDescription: baseDescriptionParts.join(" | "),
      bonusProfile:
        bonusNotes.length > 0
          ? {
              ...createEmptyBonusProfile(),
              notes: bonusNotes,
            }
          : createEmptyBonusProfile(),
    },
  };
}

export function completeAuctionTransaction(args: {
  entry: AuctionHouseEntry;
  mode: AuctionTransactionMode;
  characterId: string;
  characterName: string;
  characterMoney: number;
  characterGameDateTime: string;
  itemBlueprints: ItemBlueprintRecord[];
  now?: Date;
}):
  | {
      nextEntry: AuctionHouseEntry;
      createdItem: SharedItemRecord;
      moneySpent: number;
      message: string;
      historyEntry: ReturnType<typeof buildGameHistoryNoteEntry>;
    }
  | { error: string } {
  const availableStock = getAuctionEntryAvailableStock(args.entry);
  if (availableStock === null) {
    return { error: "This auction entry does not have a usable stock value yet." };
  }

  if (availableStock <= 0) {
    return { error: "This item is out of stock." };
  }

  const moneyCost = getAuctionTransactionMoneyCost(args.entry, args.mode);
  if (moneyCost === null) {
    return {
      error:
        args.mode === "bid"
          ? "Bidding is not available for this item."
          : "Buyout is not available for this item.",
    };
  }

  if (args.characterMoney < moneyCost) {
    return { error: `${args.characterName || "This character"} does not have enough money.` };
  }

  const draft = buildAuctionItemDraft(args.entry);
  const createdItem = createSharedItemRecord(
    draft.blueprintId,
    {
      ...draft.overrides,
      assignedCharacterId: args.characterId,
    },
    args.itemBlueprints
  );
  const nextEntry = {
    ...cloneAuctionHouseEntry(args.entry),
    stockQuantity: Math.max(0, availableStock - 1),
  };
  const actionLabel = args.mode === "bid" ? "Won bid on" : "Bought";
  const priceLabel = formatAuctionPrice(args.mode === "bid" ? args.entry.bid : args.entry.buyout);
  const historyEntry = buildGameHistoryNoteEntry(
    `${actionLabel} ${args.entry.itemName} for ${priceLabel}.`,
    args.characterGameDateTime,
    args.now
  );

  return {
    nextEntry,
    createdItem,
    moneySpent: moneyCost,
    message: `${actionLabel} ${args.entry.itemName} for ${priceLabel}.`,
    historyEntry,
  };
}
