import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import {
  buildEncounterParticipantInput,
  createCombatEncounter,
} from "../config/combatEncounter";
import { type CharacterRecord, useAppFlow } from "../state/appFlow";
import type { CombatEncounterParty } from "../types/combatEncounter";

const DEFAULT_PARTIES: CombatEncounterParty[] = [
  { partyId: "party-1", label: "Party 1", kind: "players" },
  { partyId: "party-2", label: "Party 2", kind: "npcs" },
];

type StagedAssignments = Record<string, string | null>;

function getCharacterName(character: CharacterRecord | undefined): string {
  return character?.sheet.name.trim() || "Unnamed Character";
}

function getNextPartyLabel(parties: CombatEncounterParty[]): string {
  const highestPartyNumber = parties.reduce((highest, party) => {
    const matchedNumber = /^Party (\d+)$/.exec(party.label);
    if (!matchedNumber) {
      return highest;
    }

    return Math.max(highest, Number.parseInt(matchedNumber[1], 10));
  }, 0);

  return `Party ${highestPartyNumber + 1}`;
}

function buildInitialPendingAssignments(
  characters: CharacterRecord[],
  currentAssignments: StagedAssignments
): Record<string, string> {
  return Object.fromEntries(
    characters.map((character) => [character.id, currentAssignments[character.id] ?? ""])
  );
}

export function CombatDashboardPage() {
  const navigate = useNavigate();
  const { roleChoice, characters, beginCombatEncounter } = useAppFlow();
  const [encounterLabel, setEncounterLabel] = useState("Combat Encounter");
  const [parties, setParties] = useState<CombatEncounterParty[]>(DEFAULT_PARTIES);
  const [stagedAssignments, setStagedAssignments] = useState<StagedAssignments>({});
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string>>({});
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const playerCharacters = characters.filter((character) => character.ownerRole === "player");
  const dmCharacters = characters.filter((character) => character.ownerRole === "dm");

  const encounterMembersByParty = useMemo(
    () =>
      Object.fromEntries(
        parties.map((party) => [
          party.partyId,
          characters.filter((character) => stagedAssignments[character.id] === party.partyId),
        ])
      ) as Record<string, CharacterRecord[]>,
    [characters, parties, stagedAssignments]
  );
  const assignedCharacterIds = Object.entries(stagedAssignments)
    .filter(([, partyId]) => partyId !== null)
    .map(([characterId]) => characterId);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function getPendingAssignment(characterId: string): string {
    return pendingAssignments[characterId] ?? stagedAssignments[characterId] ?? "";
  }

  function syncPendingAssignments(nextAssignments: StagedAssignments): void {
    setPendingAssignments((currentPendingAssignments) => {
      const hydratedPendingAssignments =
        Object.keys(currentPendingAssignments).length === 0
          ? buildInitialPendingAssignments(characters, nextAssignments)
          : currentPendingAssignments;

      return Object.fromEntries(
        characters.map((character) => [
          character.id,
          hydratedPendingAssignments[character.id] ?? nextAssignments[character.id] ?? "",
        ])
      );
    });
  }

  function assignCharacterToParty(characterId: string, partyId: string): void {
    setStagedAssignments((currentAssignments) => {
      const nextAssignments = {
        ...currentAssignments,
        [characterId]: partyId,
      };
      syncPendingAssignments(nextAssignments);
      return nextAssignments;
    });
  }

  function removeCharacterFromCombat(characterId: string): void {
    setStagedAssignments((currentAssignments) => {
      const nextAssignments = {
        ...currentAssignments,
        [characterId]: null,
      };
      syncPendingAssignments(nextAssignments);
      return nextAssignments;
    });
  }

  function addAllCharactersToParty(ownerRole: "player" | "dm", partyId: string): void {
    setStagedAssignments((currentAssignments) => {
      const nextAssignments = { ...currentAssignments };
      characters.forEach((character) => {
        if (
          character.ownerRole !== ownerRole ||
          (nextAssignments[character.id] !== undefined && nextAssignments[character.id] !== null)
        ) {
          return;
        }

        nextAssignments[character.id] = partyId;
      });

      syncPendingAssignments(nextAssignments);
      return nextAssignments;
    });
  }

  function createParty(): void {
    setParties((currentParties) => {
      const nextPartyNumber = currentParties.length + 1;
      return [
        ...currentParties,
        {
          partyId: `party-${nextPartyNumber}`,
          label: getNextPartyLabel(currentParties),
          kind: "custom",
        },
      ];
    });
  }

  function handleStartEncounter(): void {
    try {
      const selectedCharacters = characters.filter(
        (character) => stagedAssignments[character.id] !== null && stagedAssignments[character.id] !== undefined
      );

      if (selectedCharacters.length === 0) {
        throw new RangeError("Add at least one combatant before starting the encounter.");
      }

      beginCombatEncounter(
        createCombatEncounter(
          encounterLabel,
          selectedCharacters.map((character) =>
            buildEncounterParticipantInput(
              character.id,
              character.ownerRole,
              character.sheet,
              stagedAssignments[character.id] ?? null
            )
          ),
          parties
        )
      );
      setDashboardError(null);
      navigate("/dm/combat/encounter");
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Combat encounter could not be started."
      );
    }
  }

  function renderCharacterSelectionRow(character: CharacterRecord): JSX.Element {
    const selectedPartyId = getPendingAssignment(character.id);
    const isAssigned = (stagedAssignments[character.id] ?? null) !== null;

    return (
      <div key={character.id} className="dm-selection-row dm-selection-row-complex">
        <span>{getCharacterName(character)}</span>
        <div className="dm-selection-controls">
          <select
            value={selectedPartyId}
            onChange={(event) =>
              setPendingAssignments((currentPendingAssignments) => ({
                ...currentPendingAssignments,
                [character.id]: event.target.value,
              }))
            }
          >
            <option value="">Choose party</option>
            {parties.map((party) => (
              <option key={party.partyId} value={party.partyId}>
                {party.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => assignCharacterToParty(character.id, selectedPartyId)}
            disabled={selectedPartyId === ""}
          >
            {isAssigned ? "Move" : "Assign"}
          </button>
          <button type="button" onClick={() => removeCharacterFromCombat(character.id)}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Combat Dashboard</h1>
          </div>
          <div className="dm-nav-actions">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/")}>
              Main Menu
            </button>
          </div>
        </header>

        <section className="dm-setup-grid">
          <article className="sheet-card">
            <p className="section-kicker">Player Character Block</p>
            <h2>Player Characters</h2>
            <div className="dm-control-row dm-control-row-wrap">
              <button
                type="button"
                className="flow-secondary"
                onClick={() => navigate("/dm/characters")}
              >
                Open Player Character Sheets
              </button>
              <button
                type="button"
                className="flow-secondary"
                onClick={() => addAllCharactersToParty("player", "party-1")}
              >
                Add All Players
              </button>
            </div>
            <div className="dm-list">
              {playerCharacters.length === 0 ? (
                <p className="empty-block-copy">No player characters created yet.</p>
              ) : (
                playerCharacters.map(renderCharacterSelectionRow)
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">NPC Creator Block</p>
            <h2>NPC Creator</h2>
            <p className="dm-summary-line">
              Open the DM character creator and add DM-created characters to the combat roster.
            </p>
            <div className="dm-control-row dm-control-row-wrap">
              <button
                type="button"
                className="flow-secondary"
                onClick={() => navigate("/dm/npc-creator")}
              >
                Open NPC Creator
              </button>
              <button
                type="button"
                className="flow-secondary"
                onClick={() => addAllCharactersToParty("dm", "party-2")}
              >
                Add All NPCs
              </button>
            </div>
            <div className="dm-list">
              {dmCharacters.length === 0 ? (
                <p className="empty-block-copy">No DM-created characters saved yet.</p>
              ) : (
                dmCharacters.map(renderCharacterSelectionRow)
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Party Staging</p>
            <h2>Parties</h2>
            <div className="dm-control-row">
              <button type="button" className="flow-secondary" onClick={createParty}>
                Create Party
              </button>
            </div>
            <div className="dm-party-grid">
              {parties.map((party) => (
                <section key={party.partyId} className="dm-party-card">
                  <div className="dm-party-card-head">
                    <strong>{party.label}</strong>
                    <small>
                      {party.kind === "players"
                        ? "Player Party"
                        : party.kind === "npcs"
                          ? "NPC Party"
                          : "Custom Party"}
                    </small>
                  </div>
                  <div className="dm-list">
                    {encounterMembersByParty[party.partyId]?.length ? (
                      encounterMembersByParty[party.partyId].map((character) => (
                        <div key={character.id} className="dm-selection-row dm-selection-row-complex">
                          <span>{getCharacterName(character)}</span>
                          <div className="dm-selection-controls">
                            <select
                              value={getPendingAssignment(character.id)}
                              onChange={(event) =>
                                setPendingAssignments((currentPendingAssignments) => ({
                                  ...currentPendingAssignments,
                                  [character.id]: event.target.value,
                                }))
                              }
                            >
                              {parties.map((destinationParty) => (
                                <option key={destinationParty.partyId} value={destinationParty.partyId}>
                                  {destinationParty.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                assignCharacterToParty(character.id, getPendingAssignment(character.id))
                              }
                            >
                              Move
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCharacterFromCombat(character.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="empty-block-copy">No combatants assigned.</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
            <p className="dm-summary-line">Assigned combatants: {assignedCharacterIds.length}</p>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Combat Encounter</p>
            <h2>Start Combat</h2>
            <p className="dm-summary-line">
              Starting combat rolls initiative for the assigned combatants and opens the Combat
              Encounter.
            </p>
            <div className="dm-control-row">
              <button type="button" className="flow-primary" onClick={handleStartEncounter}>
                Combat Encounter
              </button>
            </div>
          </article>
        </section>
        {dashboardError ? <p className="dm-error">{dashboardError}</p> : null}
      </section>
    </main>
  );
}
