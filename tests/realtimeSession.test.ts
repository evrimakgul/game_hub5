import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  applyRewardPacket,
  canViewSessionEvent,
  createDefaultRewardPacket,
  createRollSessionEvent,
  createShareSessionEvent,
  getMissingKnowledgeRecipientIds,
} from "../src/lib/realtimeSession.ts";
import { formatRealtimeSessionError } from "../src/lib/realtimeSessionRepository.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import type { KnowledgeState } from "../src/types/knowledge.ts";
import { runTestSuite } from "./harness.ts";

function createCharacter(id: string, name: string): CharacterRecord {
  return {
    id,
    ownerRole: "player",
    sheet: {
      ...PLAYER_CHARACTER_TEMPLATE.createInstance(),
      name,
      xpEarned: 10,
      xpUsed: 4,
      inspiration: 1,
      temporaryInspiration: 1,
      money: 20,
      positiveKarma: 1,
      negativeKarma: 1,
    },
  };
}

export async function runRealtimeSessionTests(): Promise<void> {
  await runTestSuite("realtimeSession", [
    {
      name: "secret roll visibility supports DM-only and DM-and-actor modes",
      run: () => {
        const dmPrivate = createRollSessionEvent({
          id: "roll-1",
          sessionId: "session-1",
          actorUserId: "dm-user",
          actorCharacterId: null,
          actorDisplayName: "DM",
          labels: ["PER", "Alertness"],
          poolSize: 3,
          faces: [10, 6, 1],
          mode: "dm_private",
          createdAt: "2026-04-24T00:00:00.000Z",
        });
        const playerHidden = createRollSessionEvent({
          id: "roll-2",
          sessionId: "session-1",
          actorUserId: "player-user",
          actorCharacterId: "character-1",
          actorDisplayName: "Player",
          labels: ["Stealth"],
          poolSize: 2,
          faces: [6, 6],
          mode: "player_hidden",
          createdAt: "2026-04-24T00:00:00.000Z",
        });

        assert.equal(dmPrivate.visibility, "dm_only");
        assert.equal(playerHidden.visibility, "dm_and_actor");
        assert.equal(canViewSessionEvent(dmPrivate, { role: "dm", userId: "dm-user" }), true);
        assert.equal(canViewSessionEvent(dmPrivate, { role: "player", userId: "player-user" }), false);
        assert.equal(canViewSessionEvent(playerHidden, { role: "dm", userId: "dm-user" }), true);
        assert.equal(
          canViewSessionEvent(playerHidden, {
            role: "player",
            userId: "player-user",
            characterId: "character-1",
          }),
          true
        );
        assert.equal(
          canViewSessionEvent(playerHidden, {
            role: "player",
            userId: "other-player",
            characterId: "character-2",
          }),
          false
        );
      },
    },
    {
      name: "limited shares are visible only to DMs and selected recipients",
      run: () => {
        const share = createShareSessionEvent({
          id: "share-1",
          sessionId: "session-1",
          actorUserId: "player-user",
          actorCharacterId: "character-1",
          actorDisplayName: "Player",
          summary: "Shared a card.",
          visibility: "limited",
          targetUserIds: ["friend-user"],
          targetCharacterIds: ["character-2"],
          cardRevisionId: "revision-1",
          createdAt: "2026-04-24T00:00:00.000Z",
        });

        assert.equal(canViewSessionEvent(share, { role: "dm", userId: "dm-user" }), true);
        assert.equal(canViewSessionEvent(share, { role: "player", userId: "friend-user" }), true);
        assert.equal(
          canViewSessionEvent(share, { role: "player", userId: "other-user", characterId: "character-2" }),
          true
        );
        assert.equal(canViewSessionEvent(share, { role: "player", userId: "other-user" }), false);
      },
    },
    {
      name: "reward packets update core rewards and leave xp used unchanged",
      run: () => {
        const character = createCharacter("character-1", "P1");
        const packet = {
          ...createDefaultRewardPacket(["character-1"]),
          xpEarnedDelta: 5,
          inspirationDelta: -5,
          temporaryInspirationDelta: 2,
          moneyDelta: 10,
          positiveKarmaDelta: 3,
          negativeKarmaDelta: -5,
          note: "Closed the session.",
        };

        const result = applyRewardPacket({
          id: "reward-1",
          sessionId: "session-1",
          characters: [character],
          packet,
          actorUserId: "dm-user",
          actorDisplayName: "DM",
          createdAt: "2026-04-24T00:00:00.000Z",
        });
        const nextSheet = result.characters[0]?.sheet;

        assert.equal(nextSheet?.xpEarned, 15);
        assert.equal(nextSheet?.xpUsed, 4);
        assert.equal(nextSheet?.inspiration, 0);
        assert.equal(nextSheet?.temporaryInspiration, 3);
        assert.equal(nextSheet?.money, 30);
        assert.equal(nextSheet?.positiveKarma, 4);
        assert.equal(nextSheet?.negativeKarma, 0);
        assert.equal(nextSheet?.gameHistory[0]?.type, "note");
        assert.ok(nextSheet?.dmAuditLog.some((entry) => entry.fieldPath === "xpEarned"));
        assert.equal(result.event.kind, "reward");
      },
    },
    {
      name: "share recipient helper prevents duplicate knowledge ownership",
      run: () => {
        const state: KnowledgeState = {
          knowledgeEntities: [],
          knowledgeRevisions: [],
          knowledgeOwnerships: [
            {
              id: "ownership-1",
              revisionId: "revision-1",
              ownerCharacterId: "character-1",
              acquiredFromCharacterId: null,
              acquiredAt: "2026-04-24T00:00:00.000Z",
              localLabel: "",
              isPinned: false,
              isArchived: false,
            },
          ],
        };

        assert.deepEqual(
          getMissingKnowledgeRecipientIds(state, "revision-1", [
            "character-1",
            "character-2",
            "character-2",
          ]),
          ["character-2"]
        );
      },
    },
    {
      name: "repository errors explain missing live-session schema",
      run: () => {
        const message = formatRealtimeSessionError(
          {
            code: "PGRST205",
            message: "Could not find the table 'public.campaigns' in the schema cache",
          },
          "Failed to load campaigns."
        );

        assert.match(message, /202604240001_realtime_dm_screen\.sql/);
        assert.match(message, /202604240002_account_access_hardening\.sql/);
      },
    },
  ]);
}
