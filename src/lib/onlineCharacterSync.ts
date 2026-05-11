import { normalizeCharacterDraft, type CharacterDraft } from "../config/characterTemplate.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { CampaignCharacterRecord } from "../types/realtimeSession.ts";

function areSheetsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeVisibleCampaignCharacters(args: {
  localCharacters: CharacterRecord[];
  campaignCharacters: CampaignCharacterRecord[];
  currentUserId: string;
}): CharacterRecord[] {
  const remoteByCharacterId = new Map(
    args.campaignCharacters.map((character) => [character.characterId, character])
  );
  const existingIds = new Set(args.localCharacters.map((character) => character.id));
  let didChange = false;

  const mergedCharacters = args.localCharacters.map((character) => {
    const remote = remoteByCharacterId.get(character.id);
    if (!remote) {
      return character;
    }

    const remoteSheet = normalizeCharacterDraft(remote.sheetPayload as CharacterDraft);
    const shouldUseRemoteSheet = remote.ownerUserId === args.currentUserId;
    const nextCharacter: CharacterRecord = {
      ...character,
      ownerUserId: remote.ownerUserId,
      sheet: shouldUseRemoteSheet ? remoteSheet : character.sheet,
    };

    if (
      nextCharacter.ownerUserId !== character.ownerUserId ||
      (shouldUseRemoteSheet && !areSheetsEqual(nextCharacter.sheet, character.sheet))
    ) {
      didChange = true;
    }

    return nextCharacter;
  });

  args.campaignCharacters.forEach((remote) => {
    if (remote.ownerUserId !== args.currentUserId || existingIds.has(remote.characterId)) {
      return;
    }

    didChange = true;
    mergedCharacters.push({
      id: remote.characterId,
      ownerRole: "player",
      ownerUserId: remote.ownerUserId,
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

  return currentUserId === null || character.ownerUserId == null || character.ownerUserId === currentUserId;
}
