export type TimestampedIdOptions = {
  timestamp?: number;
  randomSuffix?: string;
};

export function createTimestampedId(
  prefix: string,
  options: TimestampedIdOptions = {}
): string {
  const timestamp = options.timestamp ?? Date.now();
  const randomSuffix = options.randomSuffix ?? Math.random().toString(16).slice(2, 8);

  return `${prefix}-${timestamp}-${randomSuffix}`;
}

export function getIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}
