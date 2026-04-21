export type AuctionHouseEntry = {
  id: string;
  sourceRow: number | null;
  bid: number | null;
  buyout: number | null;
  itemName: string;
  itemQuantity: string;
  stockQuantity: number | null;
  itemQuality: string;
  bodyPart: string;
  spec: string;
  bonus: string;
  typeLabel: string;
  remarks: string;
  itemLabels: string[];
};

export type AuctionTransactionMode = "bid" | "buyout";

export type AuctionHouseMetadata = {
  lastSessionDate: string;
  lastFinishedSessionNumber: string;
  validSessionWindow: string;
  notes: string[];
};
