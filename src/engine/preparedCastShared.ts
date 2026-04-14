import { buildCharacterDerivedValues } from "../config/characterRuntime.ts";
import { prependGameHistoryEntry } from "../lib/historyEntries.ts";
import {
  applyKnowledgeBatch,
  buildLinkedCharacterKnowledgeBatchFromIntelEntry,
} from "../lib/knowledge.ts";
import {
  incrementPerTargetDailyPowerUsageCount,
  incrementPowerUsageCount,
  setLongRestSelection,
} from "../lib/powerUsage.ts";
import { applyDamageToSheet, applyHealingToSheet } from "../rules/combatResolution.ts";
import {
  applyActivePowerEffect,
  spendPowerMana,
} from "../rules/powerEffects.ts";
import type { CharacterDraft } from "../config/characterTemplate.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { PreparedCastRequest } from "../types/combatEncounterView.ts";
import type { SharedItemRecord } from "../types/items.ts";
import type { KnowledgeState } from "../types/knowledge.ts";

type CharacterSheetUpdater =
  | CharacterRecord["sheet"]
  | ((current: CharacterRecord["sheet"]) => CharacterRecord["sheet"]);

export function applySheetUpdater(
  currentSheet: CharacterRecord["sheet"],
  updater: CharacterSheetUpdater
): CharacterRecord["sheet"] {
  return typeof updater === "function" ? updater(currentSheet) : updater;
}

export function normalizeStatusTagText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function applyPreparedResourceChange(
  currentSheet: CharacterDraft,
  change: PreparedCastRequest["resourceChanges"][number],
  itemsById: Record<string, SharedItemRecord>
): CharacterDraft {
  const derived = buildCharacterDerivedValues(currentSheet, itemsById);
  const currentValue =
    change.field === "currentMana" ? derived.currentMana : currentSheet[change.field];
  const rawNextValue = change.operation === "set" ? change.value : currentValue + change.value;
  const nextValue =
    change.field === "currentMana"
      ? Math.max(0, Math.min(Math.trunc(rawNextValue), derived.maxMana))
      : change.field === "temporaryHp"
        ? Math.max(0, Math.trunc(rawNextValue))
        : Math.trunc(rawNextValue);

  return {
    ...currentSheet,
    [change.field]: nextValue,
    ...(change.field === "currentMana" ? { manaInitialized: true } : null),
  };
}

export function applyPreparedStatusTagChange(
  currentSheet: CharacterDraft,
  change: PreparedCastRequest["statusTagChanges"][number]
): CharacterDraft {
  if (change.operation === "add") {
    const alreadyExists = currentSheet.statusTags.some(
      (tag) =>
        tag.id === change.tag.id ||
        normalizeStatusTagText(tag.label) === normalizeStatusTagText(change.tag.label)
    );
    if (alreadyExists) {
      return currentSheet;
    }

    return {
      ...currentSheet,
      statusTags: [...currentSheet.statusTags, change.tag],
    };
  }

  return {
    ...currentSheet,
    statusTags: currentSheet.statusTags.filter(
      (tag) =>
        tag.id !== change.tag.id &&
        normalizeStatusTagText(tag.label) !== normalizeStatusTagText(change.tag.label)
    ),
  };
}

export function applyPreparedUsageCounterChange(
  currentSheet: CharacterDraft,
  change: PreparedCastRequest["usageCounterChanges"][number]
): CharacterDraft {
  if (change.operation === "setSelection") {
    return {
      ...currentSheet,
      powerUsageState: setLongRestSelection(currentSheet.powerUsageState, change.key, change.value),
    };
  }

  return {
    ...currentSheet,
    powerUsageState:
      change.scope === "perTargetDaily"
        ? incrementPerTargetDailyPowerUsageCount(
            currentSheet.powerUsageState,
            change.key,
            change.targetCharacterId ?? "",
            change.amount
          )
        : incrementPowerUsageCount(
            currentSheet.powerUsageState,
            change.scope,
            change.key,
            change.amount
          ),
  };
}

export function applyPreparedHealing(
  currentSheet: CharacterDraft,
  application: PreparedCastRequest["healingApplications"][number],
  itemsById: Record<string, SharedItemRecord>
): CharacterDraft {
  return applyHealingToSheet(currentSheet, application.amount, {
    temporaryHpCap: application.temporaryHpCap,
    itemsById,
  }).sheet;
}

export function applyPreparedDamage(
  currentSheet: CharacterDraft,
  application: PreparedCastRequest["damageApplications"][number],
  itemsById: Record<string, SharedItemRecord>
): CharacterDraft {
  return applyDamageToSheet(currentSheet, {
    rawAmount: application.rawAmount,
    damageType: application.damageType,
    mitigationChannel: application.mitigationChannel,
    armorPenetration: application.armorPenetration,
    itemsById,
  }).sheet;
}

export function applyPreparedHistoryEntries(args: {
  request: PreparedCastRequest;
  knowledgeState: KnowledgeState;
  casterCharacter: CharacterRecord;
  resolveCharacter: (characterId: string) => CharacterRecord | null;
}): {
  knowledgeState: KnowledgeState;
  historyEntries: PreparedCastRequest["historyEntries"];
} {
  let knowledgeState = args.knowledgeState;

  const historyEntries = args.request.historyEntries.map((item) => {
    const historyEntry = item.entry;
    if (historyEntry.type !== "intel_snapshot" || !historyEntry.targetCharacterId) {
      return item;
    }

    const targetCharacter = args.resolveCharacter(historyEntry.targetCharacterId);
    if (!targetCharacter) {
      return item;
    }

    const linked = buildLinkedCharacterKnowledgeBatchFromIntelEntry({
      state: knowledgeState,
      casterCharacter: args.casterCharacter,
      targetCharacter,
      entry: historyEntry,
    });
    knowledgeState = applyKnowledgeBatch(knowledgeState, linked.batch);

    return {
      ...item,
      entry: linked.entry,
    };
  });

  return {
    knowledgeState,
    historyEntries,
  };
}

export function appendPreparedHistoryEntry(
  currentSheet: CharacterDraft,
  entry: PreparedCastRequest["historyEntries"][number]["entry"]
): CharacterDraft {
  return {
    ...currentSheet,
    gameHistory: prependGameHistoryEntry(currentSheet.gameHistory ?? [], entry),
  };
}

export function spendPreparedCastMana(args: {
  casterCharacter: CharacterRecord | null;
  request: PreparedCastRequest;
  itemsById: Record<string, SharedItemRecord>;
}): { error: string } | { sheet: CharacterDraft } {
  if (!args.casterCharacter) {
    return { error: "The casting character no longer resolves to a saved character sheet." };
  }

  return spendPowerMana(args.casterCharacter.sheet, args.request.manaCost, args.itemsById);
}

export function applyPreparedEffect(
  currentSheet: CharacterDraft,
  effect: PreparedCastRequest["effects"][number]
): CharacterDraft {
  return applyActivePowerEffect(currentSheet, effect);
}
