import type { CharacterDraft, DmAuditEntry } from "../config/characterTemplate";
import type { CharacterOwnerRole } from "../types/character";
import { createTimestampedId, getIsoTimestamp } from "./ids.ts";

export type CreateDmAuditEntryInput = {
  characterId: string;
  targetOwnerRole: CharacterOwnerRole;
  editLayer: DmAuditEntry["editLayer"];
  fieldPath: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string;
  sourceScreen: string;
};

export function createDmAuditEntry(input: CreateDmAuditEntryInput): DmAuditEntry {
  return {
    id: createTimestampedId("dm-edit"),
    timestamp: getIsoTimestamp(),
    characterId: input.characterId,
    targetOwnerRole: input.targetOwnerRole,
    editLayer: input.editLayer,
    fieldPath: input.fieldPath,
    beforeValue: String(input.beforeValue ?? ""),
    afterValue: String(input.afterValue ?? ""),
    reason: input.reason,
    sourceScreen: input.sourceScreen,
  };
}

export function appendDmAuditEntry(
  sheet: CharacterDraft,
  entry: DmAuditEntry | null
): CharacterDraft {
  if (!entry) {
    return sheet;
  }

  return {
    ...sheet,
    dmAuditLog: [...(sheet.dmAuditLog ?? []), entry],
  };
}
