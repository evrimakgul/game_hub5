import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";

import { useAppFlow } from "../state/appFlow";

export function PlayerHubPage() {
  const navigate = useNavigate();
  const { roleChoice, characters, createCharacter, selectCharacter, deleteCharacter } =
    useAppFlow();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const playerCharacters = characters.filter((character) => character.ownerRole === "player");

  if (roleChoice !== "player") {
    return <Navigate to="/role" replace />;
  }

  function handleCreateCharacter(): void {
    createCharacter("player");
    setPendingDeleteId(null);
    navigate("/player/character");
  }

  function handleSelectCharacter(characterId: string): void {
    selectCharacter(characterId);
    setPendingDeleteId(null);
    navigate("/player/character");
  }

  function handleDeletePrompt(characterId: string): void {
    setPendingDeleteId(characterId);
  }

  function handleDeleteConfirm(characterId: string): void {
    deleteCharacter(characterId);
    setPendingDeleteId(null);
  }

  function handleDeleteCancel(): void {
    setPendingDeleteId(null);
  }

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="section-kicker">Player</p>
        <h1>Character Access</h1>
        <div className="flow-actions">
          <button type="button" className="flow-primary" onClick={handleCreateCharacter}>
            Create New Character
          </button>
          {playerCharacters.map((character) => {
            const isDeletePending = pendingDeleteId === character.id;

            return (
              <div key={character.id} className="character-access-row">
                <button
                  type="button"
                  className="flow-secondary character-open"
                  onClick={() => handleSelectCharacter(character.id)}
                >
                  {character.sheet.name.trim() || "Unnamed Character"}
                </button>
                {!isDeletePending ? (
                  <button
                    type="button"
                    className="flow-danger"
                    onClick={() => handleDeletePrompt(character.id)}
                  >
                    Delete
                  </button>
                ) : (
                  <div className="delete-confirm-wrap">
                    <button
                      type="button"
                      className="flow-danger is-confirm"
                      onClick={() => handleDeleteConfirm(character.id)}
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      className="flow-cancel"
                      onClick={handleDeleteCancel}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
