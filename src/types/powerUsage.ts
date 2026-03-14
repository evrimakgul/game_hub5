export type PowerUsageState = {
  daily: Record<string, number>;
  longRest: Record<string, number>;
  perTargetDaily: Record<string, Record<string, number>>;
  longRestSelections: Record<string, string>;
};

export type PowerUsageResetScope = "daily" | "longRest";

export type PowerUsageSummaryEntry = {
  id: string;
  label: string;
  resetLabel: string;
  detail: string;
};
