import { Navigate, useNavigate } from "react-router-dom";

import { useAppFlow } from "../state/appFlow";

export function PlayerHubPage() {
  const navigate = useNavigate();
  const { roleChoice, characters, createCharacter, selectCharacter } = useAppFlow();

  if (roleChoice !== "player") {
    return <Navigate to="/role" replace />;
  }

  function handleCreateCharacter(): void {
    createCharacter();
    navigate("/player/character");
  }

  function handleSelectCharacter(characterId: string): void {
    selectCharacter(characterId);
    navigate("/player/character");
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
          {characters.map((character) => (
            <button
              key={character.id}
              type="button"
              className="flow-secondary"
              onClick={() => handleSelectCharacter(character.id)}
            >
              {character.sheet.name.trim() || "Unnamed Character"}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
