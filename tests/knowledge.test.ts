import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  applyKnowledgeBatch,
  buildLinkedCharacterKnowledgeBatchFromIntelEntry,
  createEmptyKnowledgeState,
  createItemKnowledgeRevision,
  createItemKnowledgeShareResult,
  createKnowledgeShareResult,
  deleteKnowledgeRevision,
  getKnowledgeGroupsForOwner,
  revokeItemKnowledgeShareResult,
} from "../src/lib/knowledge.ts";
import { createSharedItemRecord } from "../src/lib/items.ts";
import { buildAssessEntityHistoryEntry } from "../src/powers/runtimeSupport.ts";
import type { CharacterRecord } from "../src/types/character.ts";
import { runTestSuite } from "./harness.ts";

function createCharacterRecord(
  id: string,
  name: string,
  ownerRole: CharacterRecord["ownerRole"]
): CharacterRecord {
  const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
  sheet.name = name;

  return {
    id,
    ownerRole,
    sheet,
  };
}

export async function runKnowledgeTests(): Promise<void> {
  await runTestSuite("knowledge", [
    {
      name: "linked assess entity history creates a revisioned knowledge card",
      run: () => {
        const caster = createCharacterRecord("caster-1", "Veli", "player");
        const target = createCharacterRecord("target-1", "Ali", "player");
        caster.sheet.powers = [
          { id: "awareness", name: "Awareness", level: 3, governingStat: "PER" },
        ];
        const historyEntry = buildAssessEntityHistoryEntry(
          caster.sheet,
          target,
          "04.04.2026 12:00"
        );

        assert.equal(historyEntry.type, "intel_snapshot");
        const result = buildLinkedCharacterKnowledgeBatchFromIntelEntry({
          state: createEmptyKnowledgeState(),
          casterCharacter: caster,
          targetCharacter: target,
          entry: historyEntry,
        });

        assert.equal(result.batch.entities.length, 1);
        assert.equal(result.batch.revisions.length, 1);
        assert.equal(result.batch.ownerships.length, 1);
        assert.equal(result.entry.type, "intel_snapshot");
        assert.ok(result.entry.knowledgeLink);
        assert.equal(result.entry.knowledgeLink?.knowledgeEntityId, result.batch.entities[0]?.id);
        assert.equal(
          result.entry.knowledgeLink?.knowledgeRevisionId,
          result.batch.revisions[0]?.id
        );

        const nextState = applyKnowledgeBatch(createEmptyKnowledgeState(), result.batch);
        const groups = getKnowledgeGroupsForOwner(nextState, caster.id);
        assert.equal(groups.length, 1);
        assert.equal(groups[0]?.entity.displayName, "Ali");
        assert.equal(groups[0]?.revisions[0]?.revision.lineageMode, "observed");
      },
    },
    {
      name: "sharing a knowledge revision adds ownership without cloning the revision",
      run: () => {
        const caster = createCharacterRecord("caster-1", "Veli", "player");
        const target = createCharacterRecord("target-1", "Ali", "player");
        const recipient = createCharacterRecord("recipient-1", "Cemil", "player");
        caster.sheet.powers = [
          { id: "awareness", name: "Awareness", level: 3, governingStat: "PER" },
        ];
        const baseEntry = buildAssessEntityHistoryEntry(
          caster.sheet,
          target,
          "04.04.2026 12:00"
        );
        assert.equal(baseEntry.type, "intel_snapshot");
        const created = buildLinkedCharacterKnowledgeBatchFromIntelEntry({
          state: createEmptyKnowledgeState(),
          casterCharacter: caster,
          targetCharacter: target,
          entry: baseEntry,
        });
        const knowledgeState = applyKnowledgeBatch(createEmptyKnowledgeState(), created.batch);

        const result = createKnowledgeShareResult({
          state: knowledgeState,
          entity: created.batch.entities[0]!,
          revision: created.batch.revisions[0]!,
          sourceOwnerCharacterId: caster.id,
          sourceOwnerName: caster.sheet.name,
          recipientCharacters: [recipient],
        });

        assert.equal(result.batch.revisions.length, 0);
        assert.equal(result.batch.ownerships.length, 1);
        assert.equal(result.batch.ownerships[0]?.revisionId, created.batch.revisions[0]?.id);
        assert.equal(result.historyEntries.length, 1);
        assert.equal(
          result.historyEntries[0]?.entry.knowledgeLink?.knowledgeRevisionId,
          created.batch.revisions[0]?.id
        );
      },
    },
    {
      name: "creating an item card uses an item knowledge entity keyed by item id",
      run: () => {
        const item = createSharedItemRecord("range:short_bow", {
          id: "item-1",
          name: "Short Bow",
        });

        const created = createItemKnowledgeRevision({
          state: createEmptyKnowledgeState(),
          item,
          createdByCharacterId: null,
          sourceType: "dm_grant",
        });

        assert.equal(created.entity.type, "item");
        assert.equal(created.entity.subjectKey, item.id);
        assert.equal(created.revision.isCanonical, true);
      },
    },
    {
      name: "refreshing an item card creates a later revision on the same entity",
      run: () => {
        const item = createSharedItemRecord("range:short_bow", {
          id: "item-2",
          name: "Short Bow",
        });
        const first = createItemKnowledgeRevision({
          state: createEmptyKnowledgeState(),
          item,
          createdByCharacterId: null,
          sourceType: "dm_grant",
        });
        const stateAfterFirst = applyKnowledgeBatch(createEmptyKnowledgeState(), first.batch);
        const second = createItemKnowledgeRevision({
          state: stateAfterFirst,
          item: {
            ...item,
            baseDescription: "Updated string",
          },
          createdByCharacterId: null,
          sourceType: "dm_grant",
        });

        assert.equal(second.entity.id, first.entity.id);
        assert.equal(second.revision.revisionNumber, 2);
        assert.equal(second.revision.lineageMode, "updated_scan");
      },
    },
    {
      name: "sharing an item revision grants knowledge ownership and reveals the item",
      run: () => {
        const recipientA = createCharacterRecord("recipient-a", "Ayse", "player");
        const recipientB = createCharacterRecord("recipient-b", "Deniz", "player");
        const item = createSharedItemRecord("range:light_crossbow", {
          id: "item-3",
          name: "Light Crossbow",
        });
        const created = createItemKnowledgeRevision({
          state: createEmptyKnowledgeState(),
          item,
          createdByCharacterId: null,
          sourceType: "dm_grant",
        });
        const knowledgeState = applyKnowledgeBatch(createEmptyKnowledgeState(), created.batch);

        const result = createItemKnowledgeShareResult({
          state: knowledgeState,
          item,
          entity: created.entity,
          revision: created.revision,
          sourceOwnerName: "DM",
          recipientCharacters: [recipientA, recipientB],
        });

        assert.equal(result.batch.revisions.length, 0);
        assert.equal(result.batch.ownerships.length, 2);
        assert.deepEqual(result.item.knowledge.learnedCharacterIds.sort(), [
          "recipient-a",
          "recipient-b",
        ]);
        assert.deepEqual(result.item.knowledge.visibleCharacterIds.sort(), [
          "recipient-a",
          "recipient-b",
        ]);
      },
    },
    {
      name: "deleting an item revision removes its ownerships and drops the entity when empty",
      run: () => {
        const recipient = createCharacterRecord("recipient-z", "Zeynep", "player");
        const item = createSharedItemRecord("range:light_crossbow", {
          id: "item-delete-1",
          name: "Light Crossbow",
        });
        const created = createItemKnowledgeRevision({
          state: createEmptyKnowledgeState(),
          item,
          createdByCharacterId: null,
          sourceType: "dm_grant",
        });
        const knowledgeState = applyKnowledgeBatch(createEmptyKnowledgeState(), created.batch);
        const shared = createItemKnowledgeShareResult({
          state: knowledgeState,
          item,
          entity: created.entity,
          revision: created.revision,
          sourceOwnerName: "DM",
          recipientCharacters: [recipient],
        });
        const populatedState = applyKnowledgeBatch(knowledgeState, shared.batch);

        const nextState = deleteKnowledgeRevision(populatedState, created.revision.id);

        assert.equal(nextState.knowledgeRevisions.length, 0);
        assert.equal(nextState.knowledgeOwnerships.length, 0);
        assert.equal(nextState.knowledgeEntities.length, 0);
      },
    },
    {
      name: "unsharing an item revision removes ownership and clears synced item visibility when no other item card remains",
      run: () => {
        const recipient = createCharacterRecord("recipient-unshare", "Mina", "player");
        const item = createSharedItemRecord("range:light_crossbow", {
          id: "item-unshare-1",
          name: "Light Crossbow",
        });
        const created = createItemKnowledgeRevision({
          state: createEmptyKnowledgeState(),
          item,
          createdByCharacterId: null,
          sourceType: "dm_grant",
        });
        const knowledgeState = applyKnowledgeBatch(createEmptyKnowledgeState(), created.batch);
        const shared = createItemKnowledgeShareResult({
          state: knowledgeState,
          item,
          entity: created.entity,
          revision: created.revision,
          sourceOwnerName: "DM",
          recipientCharacters: [recipient],
        });
        const populatedState = applyKnowledgeBatch(knowledgeState, shared.batch);

        const revoked = revokeItemKnowledgeShareResult({
          state: populatedState,
          item: shared.item,
          revision: created.revision,
          recipientCharacterIds: [recipient.id],
        });

        assert.equal(revoked.state.knowledgeOwnerships.length, 0);
        assert.deepEqual(revoked.item.knowledge.learnedCharacterIds, []);
        assert.deepEqual(revoked.item.knowledge.visibleCharacterIds, []);
      },
    },
  ]);
}
