import { normalizeCharacterDraft, type CharacterDraft } from "../config/characterTemplate.ts";
import type { CharacterRecord } from "../types/character.ts";
import type {
  CampaignCharacterRecord,
  PlayerCharacterRecord,
} from "../types/realtimeSession.ts";

function areSheetsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getLatestCampaignCharacters(
  campaignCharacters: CampaignCharacterRecord[]
): CampaignCharacterRecord[] {
  const latestByCharacterId = new Map<string, CampaignCharacterRecord>();

  campaignCharacters.forEach((character) => {
    const current = latestByCharacterId.get(character.characterId);
    if (!current || character.updatedAt.localeCompare(current.updatedAt) > 0) {
      latestByCharacterId.set(character.characterId, character);
    }
  });

  return [...latestByCharacterId.values()];
}

export function attachCampaignCharacterMetadata(
  character: CharacterRecord,
  record: CampaignCharacterRecord
): CharacterRecord {
  return {
    ...character,
    ownerUserId: record.ownerUserId,
    onlineCampaignId: record.campaignId,
    onlineSheetUpdatedAt: record.updatedAt,
  };
}

export function attachPlayerCharacterMetadata(
  character: CharacterRecord,
  record: PlayerCharacterRecord
): CharacterRecord {
  return {
    ...character,
    ownerRole: "player",
    ownerUserId: record.ownerUserId,
    onlineSheetUpdatedAt: record.updatedAt,
  };
}

export function mergePlayerCharacters(args: {
  localCharacters: CharacterRecord[];
  playerCharacters: PlayerCharacterRecord[];
}): CharacterRecord[] {
  const localByCharacterId = new Map(
    args.localCharacters.map((character) => [character.id, character])
  );
  const remoteByCharacterId = new Map(
    args.playerCharacters.map((character) => [character.characterId, character])
  );
  const preservedLocalCharacters = args.localCharacters.filter(
    (character) =>
      character.ownerRole !== "player" ||
      (character.ownerUserId == null && !remoteByCharacterId.has(character.id))
  );
  const remoteCharacters = args.playerCharacters.map((record) => {
    const local = localByCharacterId.get(record.characterId);

    return {
      id: record.characterId,
      ownerRole: "player" as const,
      ownerUserId: record.ownerUserId,
      onlineCampaignId: local?.onlineCampaignId ?? null,
      onlineSheetUpdatedAt: record.updatedAt,
      sheet: normalizeCharacterDraft(record.sheetPayload as CharacterDraft),
    };
  });
  const nextCharacters = [...preservedLocalCharacters, ...remoteCharacters];

  return JSON.stringify(nextCharacters) === JSON.stringify(args.localCharacters)
    ? args.localCharacters
    : nextCharacters;
}

export function mergeVisibleCampaignCharacters(args: {
  localCharacters: CharacterRecord[];
  campaignCharacters: CampaignCharacterRecord[];
  currentUserId: string;
  canUseRemoteSheet?: (record: CampaignCharacterRecord) => boolean;
}): CharacterRecord[] {
  const remoteByCharacterId = new Map(
    getLatestCampaignCharacters(args.campaignCharacters).map((character) => [
      character.characterId,
      character,
    ])
  );
  const existingIds = new Set(args.localCharacters.map((character) => character.id));
  let didChange = false;

  const mergedCharacters = args.localCharacters.map((character) => {
    const remote = remoteByCharacterId.get(character.id);
    if (!remote) {
      return character;
    }

    const remoteSheet = normalizeCharacterDraft(remote.sheetPayload as CharacterDraft);
    const shouldUseRemoteSheet =
      args.canUseRemoteSheet?.(remote) ?? remote.ownerUserId === args.currentUserId;
    const nextCharacter: CharacterRecord = {
      ...character,
      ownerUserId: remote.ownerUserId,
      onlineCampaignId: remote.campaignId,
      onlineSheetUpdatedAt: remote.updatedAt,
      sheet: shouldUseRemoteSheet ? remoteSheet : character.sheet,
    };

    if (
      nextCharacter.ownerUserId !== character.ownerUserId ||
      nextCharacter.onlineCampaignId !== character.onlineCampaignId ||
      nextCharacter.onlineSheetUpdatedAt !== character.onlineSheetUpdatedAt ||
      (shouldUseRemoteSheet && !areSheetsEqual(nextCharacter.sheet, character.sheet))
    ) {
      didChange = true;
    }

    return nextCharacter;
  });

  args.campaignCharacters.forEach((remote) => {
    const shouldUseRemoteSheet =
      args.canUseRemoteSheet?.(remote) ?? remote.ownerUserId === args.currentUserId;
    if (!shouldUseRemoteSheet || existingIds.has(remote.characterId)) {
      return;
    }

    didChange = true;
    mergedCharacters.push({
      id: remote.characterId,
      ownerRole: "player",
      ownerUserId: remote.ownerUserId,
      onlineCampaignId: remote.campaignId,
      onlineSheetUpdatedAt: remote.updatedAt,
      sheet: normalizeCharacterDraft(remote.sheetPayload as CharacterDraft),
    });
  });

  return didChange ? mergedCharacters : args.localCharacters;
}

export function isCharacterPlayableByUser(
  character: CharacterRecord,
  currentUserId: string | null
): boolean {
  if (character.ownerRole !== "player") {
    return false;
  }

  return currentUserId === null ? true : character.ownerUserId === currentUserId;
}
