import type {
  CastRequestPayload,
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../../types/combatEncounterView";
import { EncounterCombatantCard } from "./EncounterCombatantCard";

type EncounterInitiativePanelProps = {
  encounterParticipants: EncounterParticipantView[];
  openCharacterSheet: (characterId: string, ownerRole: "player" | "dm") => void;
  requestCast: (payload: CastRequestPayload) => string | null;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

export function EncounterInitiativePanel({
  encounterParticipants,
  openCharacterSheet,
  requestCast,
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
            openCharacterSheet={openCharacterSheet}
            requestCast={requestCast}
            updateCharacter={updateCharacter}
          />
        ))}
      </div>
    </article>
  );
}
