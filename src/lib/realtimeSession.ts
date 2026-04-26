import type { CharacterDraft } from "../config/characterTemplate.ts";
import {
  appendDmAuditEntry,
  createDmAuditEntry,
} from "./dmAudit.ts";
import { buildGameHistoryNoteEntry } from "./historyEntries.ts";
import { createTimestampedId, getIsoTimestamp } from "./ids.ts";
import { resolveDicePool } from "../rules/combat.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { KnowledgeState } from "../types/knowledge.ts";
import type {
  ApplyRewardPacketInput,
  ApplyRewardPacketResult,
  CreateRollEventInput,
  RewardPacket,
  SessionEvent,
  SessionEventVisibility,
  SessionViewer,
  ShareEventInput,
} from "../types/realtimeSession.ts";

function createEventId(prefix: string, explicitId?: string): string {
  return explicitId ?? createTimestampedId(prefix);
}

function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function appendAuditForField(args: {
  sheet: CharacterDraft;
  character: CharacterRecord;
  fieldPath: string;
  beforeValue: number;
  afterValue: number;
  reason: string;
  sourceScreen: string;
}): CharacterDraft {
  if (args.beforeValue === args.afterValue) {
    return args.sheet;
  }

  const editLayer =
    args.fieldPath === "inspiration" || args.fieldPath === "temporaryInspiration"
      ? "runtime"
      : "sheet";

  return appendDmAuditEntry(
    args.sheet,
    createDmAuditEntry({
      characterId: args.character.id,
      targetOwnerRole: args.character.ownerRole,
      editLayer,
      fieldPath: args.fieldPath,
      beforeValue: args.beforeValue,
      afterValue: args.afterValue,
      reason: args.reason,
      sourceScreen: args.sourceScreen,
    })
  );
}

export function createRollSessionEvent(input: CreateRollEventInput): SessionEvent {
  const resolution = resolveDicePool(input.faces, input.poolSize);
  const visibility: SessionEventVisibility =
    input.mode === "dm_private"
      ? "dm_only"
      : input.mode === "player_hidden"
        ? "dm_and_actor"
        : "public";
  const label = input.labels.length > 0 ? input.labels.join(" + ") : "Custom roll";

  return {
    id: createEventId("session-roll", input.id),
    sessionId: input.sessionId,
    kind: "roll",
    visibility,
    actorUserId: input.actorUserId,
    actorCharacterId: input.actorCharacterId,
    actorDisplayName: input.actorDisplayName,
    targetUserIds: input.targetUserIds ?? [],
    targetCharacterIds: input.targetCharacterIds ?? [],
    summary: `${input.actorDisplayName} rolled ${label}: ${resolution.successes} successes${
      resolution.isBotch ? " (botch)" : ""
    }`,
    payload: {
      labels: input.labels,
      poolSize: input.poolSize,
      faces: input.faces,
      successes: resolution.successes,
      isBotch: resolution.isBotch,
      mode: input.mode,
    },
    createdAt: input.createdAt ?? getIsoTimestamp(),
  };
}

export function createShareSessionEvent(input: ShareEventInput): SessionEvent {
  return {
    id: createEventId("session-share", input.id),
    sessionId: input.sessionId,
    kind: "share",
    visibility: input.visibility,
    actorUserId: input.actorUserId,
    actorCharacterId: input.actorCharacterId,
    actorDisplayName: input.actorDisplayName,
    targetUserIds: input.targetUserIds ?? [],
    targetCharacterIds: input.targetCharacterIds ?? [],
    summary: input.summary,
    payload: {
      text: input.text ?? "",
      cardRevisionId: input.cardRevisionId ?? null,
      cardEntityId: input.cardEntityId ?? null,
    },
    createdAt: input.createdAt ?? getIsoTimestamp(),
  };
}

export function canViewSessionEvent(event: SessionEvent, viewer: SessionViewer): boolean {
  if (viewer.role === "dm") {
    return true;
  }

  if (event.visibility === "public") {
    return true;
  }

  if (event.visibility === "dm_only") {
    return false;
  }

  if (event.visibility === "dm_and_actor") {
    return (
      (viewer.userId !== null && event.actorUserId === viewer.userId) ||
      (viewer.characterId != null && event.actorCharacterId === viewer.characterId)
    );
  }

  return (
    (viewer.userId !== null && event.targetUserIds.includes(viewer.userId)) ||
    (viewer.characterId != null && event.targetCharacterIds.includes(viewer.characterId))
  );
}

export function filterSessionEventsForViewer(
  events: SessionEvent[],
  viewer: SessionViewer
): SessionEvent[] {
  return events.filter((event) => canViewSessionEvent(event, viewer));
}

export function createDefaultRewardPacket(characterIds: string[] = []): RewardPacket {
  return {
    characterIds,
    xpEarnedDelta: 0,
    inspirationDelta: 0,
    temporaryInspirationDelta: 0,
    moneyDelta: 0,
    positiveKarmaDelta: 0,
    negativeKarmaDelta: 0,
    note: "",
    cardRevisionIds: [],
  };
}

export function applyRewardPacket(input: ApplyRewardPacketInput): ApplyRewardPacketResult {
  const targetIds = new Set(input.packet.characterIds);
  const changedNames: string[] = [];
  const rewardNote =
    input.packet.note.trim().length > 0
      ? input.packet.note.trim()
      : "Session reward granted by DM.";

  const characters = input.characters.map((character) => {
    if (!targetIds.has(character.id)) {
      return character;
    }

    changedNames.push(character.sheet.name.trim() || character.id);

    const before = character.sheet;
    let nextSheet: CharacterDraft = {
      ...before,
      xpEarned: clampNonNegativeInteger(before.xpEarned + input.packet.xpEarnedDelta),
      inspiration: clampNonNegativeInteger(before.inspiration + input.packet.inspirationDelta),
      temporaryInspiration: clampNonNegativeInteger(
        before.temporaryInspiration + input.packet.temporaryInspirationDelta
      ),
      money: clampNonNegativeInteger(before.money + input.packet.moneyDelta),
      positiveKarma: clampNonNegativeInteger(
        before.positiveKarma + input.packet.positiveKarmaDelta
      ),
      negativeKarma: clampNonNegativeInteger(
        before.negativeKarma + input.packet.negativeKarmaDelta
      ),
      gameHistory: [
        buildGameHistoryNoteEntry(rewardNote, before.gameDateTime, new Date(input.createdAt ?? Date.now())),
        ...(before.gameHistory ?? []),
      ],
    };

    const auditFields: Array<keyof Pick<
      CharacterDraft,
      | "xpEarned"
      | "inspiration"
      | "temporaryInspiration"
      | "money"
      | "positiveKarma"
      | "negativeKarma"
    >> = [
      "xpEarned",
      "inspiration",
      "temporaryInspiration",
      "money",
      "positiveKarma",
      "negativeKarma",
    ];

    auditFields.forEach((fieldPath) => {
      nextSheet = appendAuditForField({
        sheet: nextSheet,
        character,
        fieldPath,
        beforeValue: before[fieldPath],
        afterValue: nextSheet[fieldPath],
        reason: rewardNote,
        sourceScreen: "dm-screen",
      });
    });

    return {
      ...character,
      sheet: nextSheet,
    };
  });

  const event: SessionEvent = {
    id: createEventId("session-reward", input.id),
    sessionId: input.sessionId,
    kind: "reward",
    visibility: "public",
    actorUserId: input.actorUserId,
    actorCharacterId: null,
    actorDisplayName: input.actorDisplayName,
    targetUserIds: [],
    targetCharacterIds: input.packet.characterIds,
    summary:
      changedNames.length > 0
        ? `Reward granted to ${changedNames.join(", ")}.`
        : "Reward packet created with no matching characters.",
    payload: {
      packet: input.packet,
      characterNames: changedNames,
    },
    createdAt: input.createdAt ?? getIsoTimestamp(),
  };

  return { characters, event };
}

export function getMissingKnowledgeRecipientIds(
  state: KnowledgeState,
  revisionId: string,
  recipientCharacterIds: string[]
): string[] {
  const existing = new Set(
    state.knowledgeOwnerships
      .filter((ownership) => ownership.revisionId === revisionId)
      .map((ownership) => ownership.ownerCharacterId)
  );

  return [...new Set(recipientCharacterIds)].filter((characterId) => !existing.has(characterId));
}
