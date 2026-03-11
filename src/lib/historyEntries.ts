import type { GameHistoryEntry, GameHistoryNoteEntry } from "../config/characterTemplate";
import { formatActualDateTime } from "./dateTime.ts";
import { createTimestampedId } from "./ids.ts";

export function buildGameHistoryNoteEntry(
  note: string,
  gameDateTime: string,
  now: Date = new Date()
): GameHistoryNoteEntry {
  return {
    id: createTimestampedId("history-note"),
    type: "note",
    actualDateTime: formatActualDateTime(now),
    gameDateTime,
    note,
  };
}

export function prependGameHistoryEntry(
  gameHistory: GameHistoryEntry[],
  entry: GameHistoryEntry
): GameHistoryEntry[] {
  return [entry, ...gameHistory];
}
