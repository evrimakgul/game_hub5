import assert from "node:assert/strict";

import { PLAYER_CHARACTER_TEMPLATE } from "../src/config/characterTemplate.ts";
import {
  applyKnowledgeBatch,
  buildLinkedCharacterKnowledgeBatchFromIntelEntry,
  createEmptyKnowledgeState,
  createKnowledgeShareResult,
  getKnowledgeGroupsForOwner,
} from "../src/lib/knowledge.ts";
import { buildAssessCharacterHistoryEntry } from "../src/powers/runtimeSupport.ts";
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
      name: "linked assess character history creates a revisioned knowledge card",
      run: () => {
        const caster = createCharacterRecord("caster-1", "Veli", "player");
        const target = createCharacterRecord("target-1", "Ali", "player");
        caster.sheet.powers = [
          { id: "awareness", name: "Awareness", level: 3, governingStat: "PER" },
        ];
        const historyEntry = buildAssessCharacterHistoryEntry(
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
        const baseEntry = buildAssessCharacterHistoryEntry(
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
  ]);
}
