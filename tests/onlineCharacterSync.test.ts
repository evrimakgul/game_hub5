import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  attachCampaignCharacterMetadata,
  mergeVisibleCampaignCharacters,
} from "../src/lib/onlineCharacterSync.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import type { CampaignCharacterRecord } from "../src/types/realtimeSession.ts";
import { runTestSuite } from "./harness.ts";

function createSheet(name: string) {
  return {
    ...PLAYER_CHARACTER_TEMPLATE.createInstance(),
    name,
  };
}

function createCampaignCharacter(
  overrides: Partial<CampaignCharacterRecord> = {}
): CampaignCharacterRecord {
  return {
    id: overrides.id ?? "campaign-character-1",
    campaignId: overrides.campaignId ?? "campaign-1",
    characterId: overrides.characterId ?? "character-1",
    ownerUserId: overrides.ownerUserId ?? "user-1",
    displayName: overrides.displayName ?? "Remote",
    sheetPayload: overrides.sheetPayload ?? createSheet("Remote"),
    updatedAt: overrides.updatedAt ?? "2026-05-12T10:00:00.000Z",
  };
}

export async function runOnlineCharacterSyncTests(): Promise<void> {
  await runTestSuite("onlineCharacterSync", [
    {
      name: "mergeVisibleCampaignCharacters attaches campaign metadata and latest owned sheet",
      run: () => {
        const local: CharacterRecord = {
          id: "character-1",
          ownerRole: "player",
          ownerUserId: "user-1",
          sheet: createSheet("Local"),
        };
        const older = createCampaignCharacter({
          campaignId: "campaign-old",
          sheetPayload: createSheet("Older"),
          updatedAt: "2026-05-12T09:00:00.000Z",
        });
        const newer = createCampaignCharacter({
          campaignId: "campaign-new",
          sheetPayload: createSheet("Newer"),
          updatedAt: "2026-05-12T11:00:00.000Z",
        });

        const merged = mergeVisibleCampaignCharacters({
          localCharacters: [local],
          campaignCharacters: [newer, older],
          currentUserId: "user-1",
        });

        assert.equal(merged[0]?.sheet.name, "Newer");
        assert.equal(merged[0]?.onlineCampaignId, "campaign-new");
        assert.equal(merged[0]?.onlineSheetUpdatedAt, "2026-05-12T11:00:00.000Z");
      },
    },
    {
      name: "attachCampaignCharacterMetadata preserves local sheet while linking remote row",
      run: () => {
        const local: CharacterRecord = {
          id: "character-1",
          ownerRole: "player",
          ownerUserId: "user-1",
          sheet: createSheet("Local"),
        };

        const linked = attachCampaignCharacterMetadata(
          local,
          createCampaignCharacter({
            campaignId: "campaign-2",
            updatedAt: "2026-05-12T12:00:00.000Z",
          })
        );

        assert.equal(linked.sheet.name, "Local");
        assert.equal(linked.onlineCampaignId, "campaign-2");
        assert.equal(linked.onlineSheetUpdatedAt, "2026-05-12T12:00:00.000Z");
      },
    },
  ]);
}
