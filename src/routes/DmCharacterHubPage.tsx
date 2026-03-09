import { Navigate, useNavigate } from "react-router-dom";

import { useAppFlow } from "../state/appFlow";

export function DmCharacterHubPage() {
  const navigate = useNavigate();
  const { roleChoice, characters, selectCharacter } = useAppFlow();
  const playerCharacters = characters.filter((character) => character.ownerRole === "player");

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function handleOpenCharacter(characterId: string): void {
    selectCharacter(characterId);
    navigate(`/dm/character?characterId=${encodeURIComponent(characterId)}`);
  }

  return (
    <main className="flow-page">
      <section className="flow-card flow-card-wide">
        <p className="section-kicker">Dungeon Master</p>
        <h1>Player Characters</h1>
        <div className="flow-actions">
          {playerCharacters.length === 0 ? (
            <p className="empty-block-copy">No player characters are saved locally yet.</p>
          ) : (
            playerCharacters.map((character) => (
              <button
                key={character.id}
                type="button"
                className="flow-secondary"
                onClick={() => handleOpenCharacter(character.id)}
              >
                {character.sheet.name.trim() || "Unnamed Character"}
              </button>
            ))
          )}
          <button type="button" className="flow-secondary" onClick={() => navigate("/dm")}>
            Back To DM Dashboard
          </button>
        </div>
      </section>
    </main>
  );
}
