import type { CharacterRecord } from "../types/character.ts";
import type { PreparedCastRequest } from "../types/combatEncounterView.ts";
import type { SharedItemRecord } from "../types/items.ts";
import type { KnowledgeState } from "../types/knowledge.ts";
import {
  appendPreparedHistoryEntry,
  applyPreparedDamage,
  applyPreparedEffect,
  applyPreparedHealing,
  applyPreparedHistoryEntries,
  applyPreparedResourceChange,
  applyPreparedStatusTagChange,
  applyPreparedUsageCounterChange,
  spendPreparedCastMana,
} from "./preparedCastShared.ts";

export type WorldExecutionResult = {
  characters: CharacterRecord[];
  knowledgeState: KnowledgeState;
};

type WorldExecutionEngineArgs = {
  characters: CharacterRecord[];
  knowledgeState: KnowledgeState;
  itemsById: Record<string, SharedItemRecord>;
};

export class WorldExecutionEngine {
  private characters: CharacterRecord[];
  private knowledgeState: KnowledgeState;
  private itemsById: Record<string, SharedItemRecord>;

  constructor(args: WorldExecutionEngineArgs) {
    this.characters = args.characters.slice();
    this.knowledgeState = {
      knowledgeEntities: args.knowledgeState.knowledgeEntities.slice(),
      knowledgeRevisions: args.knowledgeState.knowledgeRevisions.slice(),
      knowledgeOwnerships: args.knowledgeState.knowledgeOwnerships.slice(),
    };
    this.itemsById = args.itemsById;
  }

  executePreparedRequest(
    request: PreparedCastRequest
  ): { error: string } | { result: WorldExecutionResult } {
    if (request.damageApplications.length > 0) {
      return { error: "This power still requires encounter damage resolution." };
    }

    if (request.summonChanges.length > 0) {
      return { error: "This power still requires encounter summon resolution." };
    }

    if (request.ongoingStateChanges.length > 0) {
      return { error: "This power still requires encounter ongoing-state resolution." };
    }

    if (request.activityLogEntries.length > 0) {
      return { error: "This power still requires encounter activity logging." };
    }

    const casterCharacter =
      this.characters.find((entry) => entry.id === request.casterCharacterId) ?? null;
    if (!casterCharacter) {
      return { error: "The casting character no longer resolves to a saved character sheet." };
    }

    const spentMana = spendPreparedCastMana({
      casterCharacter,
      request,
      itemsById: this.itemsById,
    });
    if ("error" in spentMana) {
      return { error: spentMana.error };
    }

    this.updateCharacter(casterCharacter.id, spentMana.sheet);

    const preparedHistory = applyPreparedHistoryEntries({
      request,
      knowledgeState: this.knowledgeState,
      casterCharacter,
      resolveCharacter: (characterId) =>
        this.characters.find((entry) => entry.id === characterId) ?? null,
    });
    this.knowledgeState = preparedHistory.knowledgeState;

    preparedHistory.historyEntries.forEach((item) => {
      this.updateCharacter(item.characterId, (currentSheet) =>
        appendPreparedHistoryEntry(currentSheet, item.entry)
      );
    });

    request.resourceChanges.forEach((change) => {
      this.updateCharacter(change.characterId, (currentSheet) =>
        applyPreparedResourceChange(currentSheet, change, this.itemsById)
      );
    });

    request.statusTagChanges.forEach((change) => {
      this.updateCharacter(change.characterId, (currentSheet) =>
        applyPreparedStatusTagChange(currentSheet, change)
      );
    });

    request.usageCounterChanges.forEach((change) => {
      this.updateCharacter(change.characterId, (currentSheet) =>
        applyPreparedUsageCounterChange(currentSheet, change)
      );
    });

    request.healingApplications.forEach((application) => {
      this.updateCharacter(application.targetCharacterId, (currentSheet) =>
        applyPreparedHealing(currentSheet, application, this.itemsById)
      );
    });

    request.damageApplications.forEach((application) => {
      this.updateCharacter(application.targetCharacterId, (currentSheet) =>
        applyPreparedDamage(currentSheet, application, this.itemsById)
      );
    });

    request.effects.forEach((effect) => {
      this.updateCharacter(effect.targetCharacterId, (currentSheet) =>
        applyPreparedEffect(currentSheet, effect)
      );
    });

    return {
      result: {
        characters: this.characters,
        knowledgeState: this.knowledgeState,
      },
    };
  }

  private updateCharacter(
    characterId: string,
    updater:
      | CharacterRecord["sheet"]
      | ((current: CharacterRecord["sheet"]) => CharacterRecord["sheet"])
  ): void {
    this.characters = this.characters.map((character) =>
      character.id === characterId
        ? {
            ...character,
            sheet: typeof updater === "function" ? updater(character.sheet) : updater,
          }
        : character
    );
  }
}
