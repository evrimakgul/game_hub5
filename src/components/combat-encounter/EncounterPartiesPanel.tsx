import { getEncounterPartyMembers } from "../../selectors/encounterViewModel";
import { buildItemIndex } from "../../lib/items.ts";
import { useAppFlow } from "../../state/appFlow";
import type { CombatEncounterParty } from "../../types/combatEncounter";
import type { EncounterParticipantView, EncounterPartyMemberView } from "../../types/combatEncounterView";

type EncounterPartiesPanelProps = {
  encounterParties: CombatEncounterParty[];
  encounterParticipants: EncounterParticipantView[];
  unassignedEncounterMembers: EncounterPartyMemberView[];
  moveEncounterParticipantToParty: (characterId: string, partyId: string | null) => void;
};

function renderPartyLabel(kind: CombatEncounterParty["kind"]): string {
  if (kind === "players") {
    return "Player Party";
  }

  if (kind === "npcs") {
    return "NPC Party";
  }

  return "Custom Party";
}

function PartyMemberCard({
  member,
  encounterParties,
  moveEncounterParticipantToParty,
  showRemoveButton,
}: {
  member: EncounterPartyMemberView;
  encounterParties: CombatEncounterParty[];
  moveEncounterParticipantToParty: (characterId: string, partyId: string | null) => void;
  showRemoveButton: boolean;
}) {
  return (
    <div className="dm-party-member-card">
      <div className="dm-party-hp-row">
        <span>{member.participant.displayName}</span>
        <strong>
          {member.currentHp} / {member.maxHp}
        </strong>
      </div>
      {member.statusSummary ? <small>{member.statusSummary}</small> : null}
      <div className="dm-party-hp-bar" aria-hidden="true">
        <div className="dm-party-hp-fill" style={{ width: `${member.hpPercent}%` }} />
      </div>
      <div className="dm-selection-controls">
        <select
          value={showRemoveButton ? (member.participant.partyId ?? "") : ""}
          onChange={(event) =>
            moveEncounterParticipantToParty(member.participant.characterId, event.target.value || null)
          }
        >
          {!showRemoveButton ? <option value="">Choose party</option> : null}
          {encounterParties.map((destinationParty) => (
            <option key={destinationParty.partyId} value={destinationParty.partyId}>
              {destinationParty.label}
            </option>
          ))}
        </select>
        {showRemoveButton ? (
          <button
            type="button"
            onClick={() => moveEncounterParticipantToParty(member.participant.characterId, null)}
          >
            Remove from Party
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function EncounterPartiesPanel({
  encounterParties,
  encounterParticipants,
  unassignedEncounterMembers,
  moveEncounterParticipantToParty,
}: EncounterPartiesPanelProps) {
  const { items } = useAppFlow();
  const itemsById = buildItemIndex(items);

  return (
    <article className="sheet-card dm-log-card">
      <p className="section-kicker">Parties</p>
      <h2>Encounter Parties</h2>
      <div className="dm-party-grid">
        {encounterParties.map((party) => {
          const partyMembers = getEncounterPartyMembers(
            encounterParticipants,
            party.partyId,
            itemsById
          );

          return (
            <section key={party.partyId} className="dm-party-card">
              <div className="dm-party-card-head">
                <strong>{party.label}</strong>
                <small>{renderPartyLabel(party.kind)}</small>
              </div>
              <div className="dm-party-member-list">
                {partyMembers.length === 0 ? (
                  <p className="empty-block-copy">No combatants assigned.</p>
                ) : (
                  partyMembers.map((member) => (
                    <PartyMemberCard
                      key={member.participant.characterId}
                      member={member}
                      encounterParties={encounterParties}
                      moveEncounterParticipantToParty={moveEncounterParticipantToParty}
                      showRemoveButton
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}

        {unassignedEncounterMembers.length > 0 ? (
          <section className="dm-party-card">
            <div className="dm-party-card-head">
              <strong>Unassigned</strong>
              <small>Encounter Only</small>
            </div>
            <div className="dm-party-member-list">
              {unassignedEncounterMembers.map((member) => (
                <PartyMemberCard
                  key={member.participant.characterId}
                  member={member}
                  encounterParties={encounterParties}
                  moveEncounterParticipantToParty={moveEncounterParticipantToParty}
                  showRemoveButton={false}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}
