import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  buildPlayerCombatParticipantViews,
  buildPlayerFacingEncounterActivityLog,
} from "../src/lib/playerCombat.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import type { EncounterParticipantView } from "../src/types/combatEncounterView.ts";
import { runTestSuite } from "./harness.ts";

function createCharacterRecord(args: {
  id: string;
  ownerRole: CharacterRecord["ownerRole"];
  name: string;
  currentHp?: number;
}): CharacterRecord {
  const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
  sheet.name = args.name;
  sheet.currentHp = args.currentHp ?? sheet.currentHp;

  return {
    id: args.id,
    ownerRole: args.ownerRole,
    sheet,
  };
}

function createEncounterParticipantView(args: {
  character: CharacterRecord;
  partyId: string;
  displayName?: string;
}): EncounterParticipantView {
  return {
    participant: {
      characterId: args.character.id,
      ownerRole: args.character.ownerRole,
      displayName: args.displayName ?? args.character.sheet.name,
      initiativePool: 6,
      initiativeFaces: [9, 8, 7, 6, 5, 4],
      initiativeSuccesses: 3,
      dex: 3,
      wits: 3,
      partyId: args.partyId,
      controllerCharacterId: null,
      summonTemplateId: null,
      sourcePowerId: null,
    },
    character: args.character,
    encounterOwnedMob: null,
    transientCombatant: null,
    snapshot: null,
  };
}

export async function runPlayerCombatTests(): Promise<void> {
  await runTestSuite("playerCombat", [
    {
      name: "player combat labels mask unknown opponents and reveal assessed ones",
      run: () => {
        const viewer = createCharacterRecord({
          id: "player-1",
          ownerRole: "player",
          name: "Alicia",
        });
        const ally = createCharacterRecord({
          id: "player-2",
          ownerRole: "player",
          name: "Bran",
        });
        const hiddenEnemy = createCharacterRecord({
          id: "enemy-1",
          ownerRole: "dm",
          name: "Hidden Enemy",
        });
        const assessedEnemy = createCharacterRecord({
          id: "enemy-2",
          ownerRole: "dm",
          name: "Known Enemy",
        });

        const combatants = buildPlayerCombatParticipantViews({
          viewerCharacterId: viewer.id,
          encounterParticipants: [
            createEncounterParticipantView({ character: viewer, partyId: "party-1" }),
            createEncounterParticipantView({ character: ally, partyId: "party-1" }),
            createEncounterParticipantView({ character: hiddenEnemy, partyId: "party-2" }),
            createEncounterParticipantView({ character: assessedEnemy, partyId: "party-2" }),
          ],
          encounterParties: [
            { partyId: "party-1", label: "Heroes", kind: "players" },
            { partyId: "party-2", label: "Cultists", kind: "npcs" },
          ],
          knowledgeState: {
            knowledgeEntities: [
              {
                id: "knowledge-entity-1",
                type: "character",
                subjectKey: assessedEnemy.id,
                displayName: assessedEnemy.sheet.name,
                createdAt: "2026-04-20T12:00:00.000Z",
                updatedAt: "2026-04-20T12:00:00.000Z",
              },
            ],
            knowledgeRevisions: [
              {
                id: "knowledge-revision-1",
                entityId: "knowledge-entity-1",
                revisionNumber: 1,
                title: "Known Enemy Card",
                summary: "Observed in combat.",
                content: [],
                tags: ["character", "assess_entity"],
                createdAt: "2026-04-20T12:00:00.000Z",
                createdByCharacterId: viewer.id,
                sourceType: "spell",
                sourceSpellName: "Assess Entity",
                sourceHistoryEntryId: null,
                parentRevisionId: null,
                lineageMode: "observed",
                isCanonical: true,
              },
            ],
            knowledgeOwnerships: [
              {
                id: "knowledge-ownership-1",
                ownerCharacterId: viewer.id,
                revisionId: "knowledge-revision-1",
                acquiredAt: "2026-04-20T12:00:00.000Z",
                acquiredFromCharacterId: null,
                localLabel: "",
                isArchived: false,
                isPinned: false,
              },
            ],
          },
          itemsById: {},
        });

        assert.equal(combatants[0]?.label, "Alicia (You)");
        assert.equal(combatants[1]?.label, "Bran");
        assert.equal(combatants[2]?.label, "Opponent 1");
        assert.equal(combatants[3]?.label, "Known Enemy");
        assert.equal(combatants[0]?.partyDisplayLabel, "Your Party");
        assert.equal(combatants[2]?.partyDisplayLabel, "Opponent Party 1");
      },
    },
    {
      name: "player encounter activity log masks only hidden opponents",
      run: () => {
        const viewer = createCharacterRecord({
          id: "player-1",
          ownerRole: "player",
          name: "Alicia",
        });
        const hiddenEnemy = createCharacterRecord({
          id: "enemy-1",
          ownerRole: "dm",
          name: "Hidden Enemy",
        });
        const assessedEnemy = createCharacterRecord({
          id: "enemy-2",
          ownerRole: "dm",
          name: "Known Enemy",
        });
        const combatants = buildPlayerCombatParticipantViews({
          viewerCharacterId: viewer.id,
          encounterParticipants: [
            createEncounterParticipantView({ character: viewer, partyId: "party-1" }),
            createEncounterParticipantView({ character: hiddenEnemy, partyId: "party-2" }),
            createEncounterParticipantView({ character: assessedEnemy, partyId: "party-2" }),
          ],
          encounterParties: [
            { partyId: "party-1", label: "Heroes", kind: "players" },
            { partyId: "party-2", label: "Cultists", kind: "npcs" },
          ],
          knowledgeState: {
            knowledgeEntities: [
              {
                id: "knowledge-entity-1",
                type: "character",
                subjectKey: assessedEnemy.id,
                displayName: assessedEnemy.sheet.name,
                createdAt: "2026-04-20T12:00:00.000Z",
                updatedAt: "2026-04-20T12:00:00.000Z",
              },
            ],
            knowledgeRevisions: [
              {
                id: "knowledge-revision-1",
                entityId: "knowledge-entity-1",
                revisionNumber: 1,
                title: "Known Enemy Card",
                summary: "Observed in combat.",
                content: [],
                tags: ["character", "assess_entity"],
                createdAt: "2026-04-20T12:00:00.000Z",
                createdByCharacterId: viewer.id,
                sourceType: "spell",
                sourceSpellName: "Assess Entity",
                sourceHistoryEntryId: null,
                parentRevisionId: null,
                lineageMode: "observed",
                isCanonical: true,
              },
            ],
            knowledgeOwnerships: [
              {
                id: "knowledge-ownership-1",
                ownerCharacterId: viewer.id,
                revisionId: "knowledge-revision-1",
                acquiredAt: "2026-04-20T12:00:00.000Z",
                acquiredFromCharacterId: null,
                localLabel: "",
                isArchived: false,
                isPinned: false,
              },
            ],
          },
          itemsById: {},
        });
        const log = buildPlayerFacingEncounterActivityLog({
          activityLog: [
            {
              id: "activity-1",
              createdAt: "2026-04-20T12:01:00.000Z",
              summary: "Hidden Enemy attacks Alicia. Known Enemy misses Alicia.",
            },
          ],
          combatants,
        });

        assert.equal(
          log[0]?.summary,
          "Opponent 1 attacks Alicia. Known Enemy misses Alicia."
        );
      },
    },
  ]);
}
