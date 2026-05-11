import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { getSupabaseClient } from "../lib/supabaseClient.ts";
import { isCharacterPlayableByUser, mergeVisibleCampaignCharacters } from "../lib/onlineCharacterSync.ts";
import { listVisibleCampaignCharacters } from "../lib/realtimeSessionRepository.ts";
import { useAppFlow } from "../state/appFlow";
import { useOnlineSession } from "../state/onlineSession.tsx";

export function PlayerHubPage() {
  const navigate = useNavigate();
  const online = useOnlineSession();
  const {
    roleChoice,
    characters,
    activeCombatEncounter,
    createCharacter,
    selectCharacter,
    deleteCharacter,
    replaceCharacters,
  } = useAppFlow();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const currentUserId = online.status === "authenticated" ? online.user?.id ?? null : null;
  const playerCharacters = characters.filter((character) =>
    isCharacterPlayableByUser(character, currentUserId)
  );
  const activeCombatCharacterIds = new Set(
    activeCombatEncounter?.participants.map((participant) => participant.characterId) ?? []
  );

  useEffect(() => {
    const supabase = getSupabaseClient();
    const userId = online.user?.id ?? null;
    if (!supabase || !userId) {
      return;
    }

    let cancelled = false;

    async function syncVisibleCharacters(): Promise<void> {
      const result = await listVisibleCampaignCharacters({ client: supabase! });
      if (cancelled || "error" in result) {
        return;
      }

      const nextCharacters = mergeVisibleCampaignCharacters({
        localCharacters: characters,
        campaignCharacters: result,
        currentUserId: userId!,
      });

      if (nextCharacters !== characters) {
        replaceCharacters(nextCharacters);
      }
    }

    void syncVisibleCharacters();

    return () => {
      cancelled = true;
    };
  }, [online.user?.id]);

  if (roleChoice !== "player") {
    return <Navigate to="/role" replace />;
  }

  function handleCreateCharacter(): void {
    const characterId = createCharacter("player", currentUserId);
    setPendingDeleteId(null);
    navigate(`/player/character?characterId=${encodeURIComponent(characterId)}`);
  }

  function handleSelectCharacter(characterId: string): void {
    selectCharacter(characterId);
    setPendingDeleteId(null);
    navigate(`/player/character?characterId=${encodeURIComponent(characterId)}`);
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

  function handleOpenCombat(characterId: string): void {
    selectCharacter(characterId);
    setPendingDeleteId(null);
    navigate(`/player/combat?characterId=${encodeURIComponent(characterId)}`);
  }

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="section-kicker">Player</p>
        <h1>Character Access</h1>
        <div className="flow-actions">
          <button type="button" className="flow-primary" onClick={() => navigate("/player/session")}>
            Live Session
          </button>
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
                  <div className="delete-confirm-wrap">
                    {activeCombatCharacterIds.has(character.id) ? (
                      <button
                        type="button"
                        className="flow-secondary"
                        onClick={() => handleOpenCombat(character.id)}
                      >
                        Combat Mode
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="flow-danger"
                      onClick={() => handleDeletePrompt(character.id)}
                    >
                      Delete
                    </button>
                  </div>
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
