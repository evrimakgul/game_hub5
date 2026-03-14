import { buildEncounterCombatantViewModel } from "../../selectors/encounterViewModel";
import type {
  CastRequestPayload,
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../../types/combatEncounterView";
import { CombatantPowerControls } from "./CombatantPowerControls";
import { CombatantRuntimeAdjustments } from "./CombatantRuntimeAdjustments";

type EncounterCombatantCardProps = {
  index: number;
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  openCharacterSheet: (characterId: string, ownerRole: "player" | "dm") => void;
  requestCast: (payload: CastRequestPayload) => string | null;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

export function EncounterCombatantCard({
  index,
  view,
  encounterParticipants,
  openCharacterSheet,
  requestCast,
  updateCharacter,
}: EncounterCombatantCardProps) {
  const combatant = buildEncounterCombatantViewModel(view);

  return (
    <details className="dm-accordion">
      <summary className="dm-accordion-summary">
        <div>
          <strong>
            {index + 1}. {combatant.participant.displayName}
          </strong>
          <small>
            Init Pool {combatant.participant.initiativePool} | Roll{" "}
            {combatant.participant.initiativeFaces.join(", ")} | Successes{" "}
            {combatant.participant.initiativeSuccesses}
          </small>
          {combatant.statusSummary ? <small>{combatant.statusSummary}</small> : null}
        </div>
      </summary>

      <div className="dm-accordion-body">
        {combatant.snapshot ? (
          <>
            <div className="dm-combatant-tools">
              <div className="dm-combatant-tool-section dm-combatant-tool-stack">
                <div className="dm-combatant-tool-subsection">
                  <p className="section-kicker">Character Sheet</p>
                  <div className="dm-entry-actions">
                    <button
                      type="button"
                      className="flow-secondary"
                      onClick={() =>
                        openCharacterSheet(combatant.participant.characterId, combatant.participant.ownerRole)
                      }
                    >
                      Open Full Character Sheet
                    </button>
                  </div>
                </div>

                <CombatantRuntimeAdjustments view={view} updateCharacter={updateCharacter} />
              </div>

              <CombatantPowerControls
                view={view}
                encounterParticipants={encounterParticipants}
                requestCast={requestCast}
                updateCharacter={updateCharacter}
              />
            </div>

            <div className="dm-combatant-values">
              <div className="dm-combatant-section">
                <p className="section-kicker">Combat Summary</p>
                <div className="dm-action-grid">
                  {combatant.snapshot.combatSummary.map((field) => (
                    <div key={field.id}>
                      <span>{field.label}</span>
                      <strong>{field.value}</strong>
                    </div>
                  ))}
                  <div>
                    <span>Inspiration</span>
                    <strong>{combatant.snapshot.inspiration}</strong>
                    <small>{combatant.snapshot.inspirationDetail}</small>
                  </div>
                </div>
              </div>

              <div className="dm-combatant-side-stack">
                <div className="dm-combatant-section">
                  <p className="section-kicker">Stats</p>
                  <div className="dm-detail-grid dm-detail-grid-compact">
                    {combatant.snapshot.stats.map((field) => (
                      <article key={field.id} className="dm-detail-card dm-detail-card-compact">
                        <span>{field.label}</span>
                        <strong>{field.value}</strong>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="dm-combatant-section">
                  <p className="section-kicker">Highlighted Skills</p>
                  <div className="dm-detail-grid-small dm-detail-grid-compact">
                    {combatant.snapshot.highlightedSkills.map((field) => (
                      <article key={field.id} className="dm-detail-card dm-detail-card-compact">
                        <span>{field.label}</span>
                        <strong>{field.value}</strong>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              {combatant.snapshot.visibleResistances.length > 0 ? (
                <div className="dm-combatant-section dm-combatant-section-full">
                  <p className="section-kicker">Resistances</p>
                  <div className="dm-pill-list">
                    {combatant.snapshot.visibleResistances.map((resistance) => (
                      <div key={resistance.id} className="dm-pill">
                        <strong>{resistance.label}</strong>
                        <span>
                          {resistance.levelLabel} {resistance.multiplierLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {combatant.snapshot.statusTags.length > 0 ? (
                <div className="dm-combatant-section dm-combatant-section-full">
                  <p className="section-kicker">Status Tags</p>
                  <div className="dm-pill-list">
                    {combatant.snapshot.statusTags.map((tag) => (
                      <div key={tag} className="dm-pill">
                        <strong>{tag}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {combatant.snapshot.utilityTraits.length > 0 ? (
                <div className="dm-combatant-section dm-combatant-section-full">
                  <p className="section-kicker">Utility Traits</p>
                  <div className="dm-pill-list">
                    {combatant.snapshot.utilityTraits.map((trait) => (
                      <div key={trait} className="dm-pill">
                        <strong>{trait}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="dm-summary-line">This combatant no longer resolves to a saved character sheet.</p>
        )}
      </div>
    </details>
  );
}
