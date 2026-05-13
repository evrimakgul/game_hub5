import type { EncounterParticipantView } from "../types/combatEncounterView.ts";
import type { CombatEncounterState } from "../types/combatEncounter.ts";
import type {
  KnowledgeEntity,
  KnowledgeOwnership,
  KnowledgeRevision,
} from "../types/knowledge.ts";
import type {
  SessionCombatParticipant,
  SessionCombatViewPayload,
} from "../types/realtimeSession.ts";
import type { SharedItemRecord } from "../types/items.ts";
import {
  buildPlayerCombatParticipantViews,
  buildPlayerFacingEncounterActivityLog,
} from "./playerCombat.ts";

type KnowledgeStateInput = {
  knowledgeEntities: KnowledgeEntity[];
  knowledgeRevisions: KnowledgeRevision[];
  knowledgeOwnerships: KnowledgeOwnership[];
};

function buildParticipantPayload(args: {
  combatants: ReturnType<typeof buildPlayerCombatParticipantViews>;
  activeParticipantId: string | null;
}): SessionCombatParticipant[] {
  return args.combatants.map((combatant) => ({
    characterId: combatant.encounterView.participant.characterId,
    label: combatant.label,
    partyLabel: combatant.partyDisplayLabel,
    hpPercent: combatant.hpPercent,
    isViewer: combatant.isViewer,
    isAllied: combatant.isAllied,
    isOpponent: combatant.isOpponent,
    isActive: combatant.encounterView.participant.characterId === args.activeParticipantId,
    canInspect: combatant.isViewer || combatant.knowledgeRevision !== null,
  }));
}

export function buildSessionCombatViewPayloads(args: {
  encounter: CombatEncounterState;
  encounterParticipants: EncounterParticipantView[];
  knowledgeState: KnowledgeStateInput;
  itemsById: Record<string, SharedItemRecord>;
}): SessionCombatViewPayload[] {
  return args.encounterParticipants
    .filter((view) => view.character?.ownerRole === "player")
    .map((viewer) => {
      const combatants = buildPlayerCombatParticipantViews({
        viewerCharacterId: viewer.participant.characterId,
        encounterParticipants: args.encounterParticipants,
        encounterParties: args.encounter.parties,
        knowledgeState: args.knowledgeState,
        itemsById: args.itemsById,
      });
      const activityLog = buildPlayerFacingEncounterActivityLog({
        activityLog: args.encounter.activityLog,
        combatants,
      });
      const activeCombatantLabel =
        combatants.find(
          (combatant) =>
            combatant.encounterView.participant.characterId ===
            args.encounter.turnState.activeParticipantId
        )?.label ?? null;

      return {
        schemaVersion: 1,
        encounterId: args.encounter.encounterId,
        encounterLabel: args.encounter.label,
        viewerCharacterId: viewer.participant.characterId,
        round: args.encounter.turnState.round,
        activeParticipantId: args.encounter.turnState.activeParticipantId,
        activeCombatantLabel,
        generatedAt: new Date().toISOString(),
        combatants: buildParticipantPayload({
          combatants,
          activeParticipantId: args.encounter.turnState.activeParticipantId,
        }),
        activityLog: activityLog.slice(-30),
      };
    });
}
