import type {
  CastRequestPayload,
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../../types/combatEncounterView";
import type { SharedItemRecord } from "../../types/items";
import { EncounterCombatantCard } from "./EncounterCombatantCard";

type EncounterInitiativePanelProps = {
  encounterParticipants: EncounterParticipantView[];
  itemsById: Record<string, SharedItemRecord>;
  openCharacterSheet: (characterId: string, ownerRole: "player" | "dm") => void;
  requestCast: (payload: CastRequestPayload) => string | null;
  requestPhysicalAttack: (payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
  }) => string | null;
  requestBodyReinforcementRevive: (payload: {
    view: EncounterParticipantView;
  }) => string | null;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

export function EncounterInitiativePanel({
  encounterParticipants,
  itemsById,
  openCharacterSheet,
  requestCast,
  requestPhysicalAttack,
  requestBodyReinforcementRevive,
  updateCharacter,
}: EncounterInitiativePanelProps) {
  return (
    <article className="sheet-card dm-log-card">
      <p className="section-kicker">Combatants Block</p>
      <h2>Initiative Order</h2>
      <div className="dm-accordion-list">
        {encounterParticipants.map((view, index) => (
          <EncounterCombatantCard
            key={view.participant.characterId}
            index={index}
            view={view}
            encounterParticipants={encounterParticipants}
            itemsById={itemsById}
            openCharacterSheet={openCharacterSheet}
            requestCast={requestCast}
            requestPhysicalAttack={requestPhysicalAttack}
            requestBodyReinforcementRevive={requestBodyReinforcementRevive}
            updateCharacter={updateCharacter}
          />
        ))}
      </div>
    </article>
  );
}
