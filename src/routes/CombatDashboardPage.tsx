import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { type CharacterRecord, useAppFlow } from "../state/appFlow";

type CombatRosterEntry = {
  entryId: string;
  characterId: string;
};

function getCharacterName(character: CharacterRecord | undefined): string {
  return character?.sheet.name.trim() || "Unnamed Character";
}

export function CombatDashboardPage() {
  const navigate = useNavigate();
  const { roleChoice, characters } = useAppFlow();
  const [encounterLabel, setEncounterLabel] = useState("Combat Encounter");
  const [combatRoster, setCombatRoster] = useState<CombatRosterEntry[]>([]);
  const playerCharacters = characters.filter((character) => character.ownerRole === "player");
  const dmCharacters = characters.filter((character) => character.ownerRole === "dm");

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function addCharacterToRoster(characterId: string): void {
    setCombatRoster((currentRoster) => {
      if (currentRoster.some((entry) => entry.characterId === characterId)) {
        return currentRoster;
      }

      return [
        ...currentRoster,
        {
          entryId: `combatant-character-${characterId}`,
          characterId,
        },
      ];
    });
  }

  function removeRosterEntry(entryId: string): void {
    setCombatRoster((currentRoster) =>
      currentRoster.filter((entry) => entry.entryId !== entryId)
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
            <div className="dm-control-row">
              <button
                type="button"
                className="flow-secondary"
                onClick={() => navigate("/dm/characters")}
              >
                Open Player Character Sheets
              </button>
            </div>
            <div className="dm-list">
              {playerCharacters.length === 0 ? (
                <p className="empty-block-copy">No player characters created yet.</p>
              ) : (
                playerCharacters.map((character) => {
                  const isSelected = combatRoster.some(
                    (entry) => entry.characterId === character.id
                  );

                  return (
                    <div key={character.id} className="dm-selection-row">
                      <span>{getCharacterName(character)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          isSelected
                            ? removeRosterEntry(`combatant-character-${character.id}`)
                            : addCharacterToRoster(character.id)
                        }
                      >
                        {isSelected ? "Remove" : "Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">NPC Creator Block</p>
            <h2>NPC Creator</h2>
            <p className="dm-summary-line">
              Open the DM character creator and add DM-created characters to the combat roster.
            </p>
            <div className="dm-control-row">
              <button
                type="button"
                className="flow-secondary"
                onClick={() => navigate("/dm/npc-creator")}
              >
                Open NPC Creator
              </button>
            </div>
            <div className="dm-list">
              {dmCharacters.length === 0 ? (
                <p className="empty-block-copy">No DM-created characters saved yet.</p>
              ) : (
                dmCharacters.map((character) => {
                  const isSelected = combatRoster.some(
                    (entry) => entry.characterId === character.id
                  );

                  return (
                    <div key={character.id} className="dm-selection-row">
                      <span>{getCharacterName(character)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          isSelected
                            ? removeRosterEntry(`combatant-character-${character.id}`)
                            : addCharacterToRoster(character.id)
                        }
                      >
                        {isSelected ? "Remove" : "Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Combatant Selection</p>
            <h2>Combatants</h2>
            <label className="dm-field">
              <span>Encounter Label</span>
              <input
                value={encounterLabel}
                onChange={(event) => setEncounterLabel(event.target.value)}
              />
            </label>
            <div className="dm-list">
              {combatRoster.length === 0 ? (
                <p className="empty-block-copy">No combatants added yet.</p>
              ) : (
                combatRoster.map((entry) => (
                  <div key={entry.entryId} className="dm-selection-row">
                    <span>
                      {getCharacterName(
                        characters.find((character) => character.id === entry.characterId)
                      )}
                    </span>
                    <button type="button" onClick={() => removeRosterEntry(entry.entryId)}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Combat Encounter</p>
            <h2>Start Combat</h2>
            <p className="dm-summary-line">
              The combat encounter trigger is intentionally inactive on this branch. The combat
              engine and combat encounter UI have been removed.
            </p>
            <div className="dm-control-row">
              <button type="button" className="flow-primary" disabled>
                Combat Encounter
              </button>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
