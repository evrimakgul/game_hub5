import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAppFlow } from "../state/appFlow";

export function DmNpcCreatorPage() {
  const navigate = useNavigate();
  const { roleChoice, characters, createCharacter, selectCharacter, deleteCharacter } =
    useAppFlow();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const dmCharacters = characters.filter((character) => character.ownerRole === "dm");

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function handleCreateCharacter(): void {
    const characterId = createCharacter("dm");
    setPendingDeleteId(null);
    navigate(`/dm/npc-character?characterId=${encodeURIComponent(characterId)}`);
  }

  function handleOpenCharacter(characterId: string): void {
    selectCharacter(characterId);
    setPendingDeleteId(null);
    navigate(`/dm/npc-character?characterId=${encodeURIComponent(characterId)}`);
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
      <section className="flow-card flow-card-wide">
        <p className="section-kicker">Dungeon Master</p>
        <h1>NPC Creator</h1>
        <div className="flow-actions">
          <button type="button" className="flow-primary" onClick={handleCreateCharacter}>
            Create New Character
          </button>
          {dmCharacters.length === 0 ? (
            <p className="empty-block-copy">No DM-created characters are saved locally yet.</p>
          ) : (
            dmCharacters.map((character) => {
              const isDeletePending = pendingDeleteId === character.id;

              return (
                <div key={character.id} className="character-access-row">
                  <button
                    type="button"
                    className="flow-secondary character-open"
                    onClick={() => handleOpenCharacter(character.id)}
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
            })
          )}
          <button type="button" className="flow-secondary" onClick={() => navigate("/dm")}>
            Back To DM Dashboard
          </button>
        </div>
      </section>
    </main>
  );
}
