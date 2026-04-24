import { buildCharacterDerivedValues } from "../config/characterRuntime.ts";
import type { CombatEncounterParty, EncounterActivityLogEntry } from "../types/combatEncounter.ts";
import type { EncounterParticipantView } from "../types/combatEncounterView.ts";
import type {
  KnowledgeEntity,
  KnowledgeOwnership,
  KnowledgeRevision,
  KnowledgeState,
} from "../types/knowledge.ts";
import type { SharedItemRecord } from "../types/items.ts";
import { buildKnowledgeIndexes, findKnowledgeEntityBySubjectKey } from "./knowledge.ts";

export type PlayerCombatParticipantView = {
  encounterView: EncounterParticipantView;
  label: string;
  partyDisplayLabel: string;
  currentHp: number;
  maxHp: number;
  hpPercent: number;
  isViewer: boolean;
  isAllied: boolean;
  isOpponent: boolean;
  knowledgeEntity: KnowledgeEntity | null;
  knowledgeOwnership: KnowledgeOwnership | null;
  knowledgeRevision: KnowledgeRevision | null;
};

function getCharacterDisplayName(view: EncounterParticipantView): string {
  const sheetName = view.character?.sheet.name.trim() ?? "";
  if (sheetName.length > 0) {
    return sheetName;
  }

  const displayName = view.participant.displayName.trim();
  if (displayName.length > 0) {
    return displayName;
  }

  return "Unknown Combatant";
}

function escapeRegexPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveOwnedKnowledge(args: {
  viewerCharacterId: string;
  targetCharacterId: string;
  knowledgeState: KnowledgeState;
}): {
  entity: KnowledgeEntity | null;
  ownership: KnowledgeOwnership | null;
  revision: KnowledgeRevision | null;
} {
  const entity = findKnowledgeEntityBySubjectKey(
    args.knowledgeState,
    "character",
    args.targetCharacterId
  );
  if (!entity) {
    return {
      entity: null,
      ownership: null,
      revision: null,
    };
  }

  const indexes = buildKnowledgeIndexes(args.knowledgeState);
  const ownerships = indexes.ownershipsByOwnerId.get(args.viewerCharacterId) ?? [];
  const latestOwnedRevision = ownerships
    .flatMap((ownership) => {
      const revision = indexes.revisionById.get(ownership.revisionId);
      if (!revision || revision.entityId !== entity.id) {
        return [];
      }

      return [
        {
          ownership,
          revision,
        },
      ];
    })
    .sort((left, right) => right.revision.revisionNumber - left.revision.revisionNumber)[0];

  return {
    entity,
    ownership: latestOwnedRevision?.ownership ?? null,
    revision: latestOwnedRevision?.revision ?? null,
  };
}

function buildPartyDisplayLabels(args: {
  encounterParties: CombatEncounterParty[];
  viewerPartyId: string | null;
}): Map<string, string> {
  const partyLabels = new Map<string, string>();
  let nextOpponentPartyNumber = 1;

  args.encounterParties.forEach((party) => {
    if (party.partyId === args.viewerPartyId) {
      partyLabels.set(party.partyId, "Your Party");
      return;
    }

    partyLabels.set(party.partyId, `Opponent Party ${nextOpponentPartyNumber}`);
    nextOpponentPartyNumber += 1;
  });

  return partyLabels;
}

export function isCharacterInCombatEncounter(
  encounterParticipants: EncounterParticipantView[],
  characterId: string
): boolean {
  return encounterParticipants.some(
    ({ participant }) => participant.characterId === characterId
  );
}

export function buildPlayerCombatParticipantViews(args: {
  viewerCharacterId: string;
  encounterParticipants: EncounterParticipantView[];
  encounterParties: CombatEncounterParty[];
  knowledgeState: KnowledgeState;
  itemsById: Record<string, SharedItemRecord>;
}): PlayerCombatParticipantView[] {
  const viewerView =
    args.encounterParticipants.find(
      ({ participant }) => participant.characterId === args.viewerCharacterId
    ) ?? null;
  const viewerPartyId = viewerView?.participant.partyId ?? null;
  const partyDisplayLabels = buildPartyDisplayLabels({
    encounterParties: args.encounterParties,
    viewerPartyId,
  });
  const opponentNumbers = new Map<string, number>();
  let nextOpponentNumber = 1;

  return args.encounterParticipants.map((encounterView) => {
    const isViewer = encounterView.participant.characterId === args.viewerCharacterId;
    const isAllied =
      !isViewer &&
      viewerPartyId !== null &&
      encounterView.participant.partyId === viewerPartyId;
    const isOpponent = !isViewer && !isAllied;
    const knowledge = isOpponent
      ? resolveOwnedKnowledge({
          viewerCharacterId: args.viewerCharacterId,
          targetCharacterId: encounterView.participant.characterId,
          knowledgeState: args.knowledgeState,
        })
      : {
          entity: null,
          ownership: null,
          revision: null,
        };
    const derived = encounterView.character
      ? buildCharacterDerivedValues(encounterView.character.sheet, args.itemsById)
      : null;
    const maxHp = derived?.maxHp ?? 0;
    const currentHp = encounterView.character?.sheet.currentHp ?? 0;
    const label = (() => {
      if (isViewer) {
        return `${getCharacterDisplayName(encounterView)} (You)`;
      }

      if (isAllied || knowledge.revision) {
        return getCharacterDisplayName(encounterView);
      }

      const existingNumber = opponentNumbers.get(encounterView.participant.characterId);
      if (existingNumber) {
        return `Opponent ${existingNumber}`;
      }

      const nextNumber = nextOpponentNumber;
      nextOpponentNumber += 1;
      opponentNumbers.set(encounterView.participant.characterId, nextNumber);
      return `Opponent ${nextNumber}`;
    })();

    return {
      encounterView,
      label,
      partyDisplayLabel:
        encounterView.participant.partyId === null
          ? "Unassigned"
          : partyDisplayLabels.get(encounterView.participant.partyId) ??
            "Opponent Party",
      currentHp,
      maxHp,
      hpPercent:
        maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0,
      isViewer,
      isAllied,
      isOpponent,
      knowledgeEntity: knowledge.entity,
      knowledgeOwnership: knowledge.ownership,
      knowledgeRevision: knowledge.revision,
    };
  });
}

export function buildPlayerFacingEncounterActivityLog(args: {
  activityLog: EncounterActivityLogEntry[];
  combatants: PlayerCombatParticipantView[];
}): EncounterActivityLogEntry[] {
  const replacements = args.combatants
    .flatMap((combatant) => {
      if (!combatant.isOpponent || combatant.knowledgeRevision) {
        return [];
      }

      const displayName = combatant.encounterView.participant.displayName.trim();
      const sheetName = combatant.encounterView.character?.sheet.name.trim() ?? "";
      return [displayName, sheetName]
        .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
        .map((value) => ({
          source: value,
          target: combatant.label,
        }));
    })
    .sort((left, right) => right.source.length - left.source.length);

  return args.activityLog.map((entry) => ({
    ...entry,
    summary: replacements.reduce((summary, replacement) => {
      const pattern = new RegExp(escapeRegexPattern(replacement.source), "g");
      return summary.replace(pattern, replacement.target);
    }, entry.summary),
  }));
}
