import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { getSupabaseClient } from "../lib/supabaseClient.ts";
import {
  attachPlayerCharacterMetadata,
  isCharacterPlayableByUser,
  mergePlayerCharacters,
} from "../lib/onlineCharacterSync.ts";
import {
  deletePlayerCharacter,
  listPlayerCharacters,
  upsertPlayerCharacter,
} from "../lib/realtimeSessionRepository.ts";
import { useAppFlow } from "../state/appFlow";
import { useOnlineSession } from "../state/onlineSession.tsx";
import type { PlayerCharacterRecord } from "../types/realtimeSession.ts";

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
  const [panelMessage, setPanelMessage] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const currentUserId = online.status === "authenticated" ? online.user?.id ?? null : null;
  const playerCharacters = characters.filter((character) =>
    isCharacterPlayableByUser(character, currentUserId)
  );
  const localOnlyPlayerCharacters =
    currentUserId === null
      ? []
      : characters.filter(
          (character) => character.ownerRole === "player" && character.ownerUserId == null
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

    async function syncAccountCharacters(): Promise<void> {
      const result = await listPlayerCharacters({ client: supabase! });
      if (cancelled || "error" in result) {
        if (!cancelled && "error" in result) {
          setPanelMessage(result.error);
        }
        return;
      }

      const nextCharacters = mergePlayerCharacters({
        localCharacters: characters,
        playerCharacters: result,
      });

      if (nextCharacters !== characters) {
        replaceCharacters(nextCharacters);
      }
    }

    void syncAccountCharacters();

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

  async function handleDeleteConfirm(characterId: string): Promise<void> {
    const character = characters.find((entry) => entry.id === characterId) ?? null;
    const supabase = getSupabaseClient();

    if (character?.ownerUserId && currentUserId && supabase) {
      const result = await deletePlayerCharacter({
        client: supabase,
        characterId,
        ownerUserId: currentUserId,
      });

      if (result && "error" in result) {
        setPanelMessage(result.error);
        return;
      }
    }

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

  async function handleUploadLocalCharacters(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId || localOnlyPlayerCharacters.length === 0) {
      return;
    }

    setIsMigrating(true);
    const uploadedCharacters: Array<{ characterId: string; record: PlayerCharacterRecord }> = [];
    for (const character of localOnlyPlayerCharacters) {
      const result = await upsertPlayerCharacter({
        client: supabase,
        characterId: character.id,
        ownerUserId: currentUserId,
        displayName: character.sheet.name.trim() || character.id,
        sheetPayload: character.sheet,
      });

      if ("error" in result) {
        setPanelMessage(result.error);
        setIsMigrating(false);
        return;
      }

      uploadedCharacters.push({ characterId: character.id, record: result });
    }

    replaceCharacters(
      characters.map((character) => {
        const uploaded = uploadedCharacters.find((entry) => entry.characterId === character.id);
        return uploaded ? attachPlayerCharacterMetadata(character, uploaded.record) : character;
      })
    );
    setPendingDeleteId(null);
    setIsMigrating(false);
    setPanelMessage(`${uploadedCharacters.length} local character(s) uploaded to Supabase.`);
  }

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="section-kicker">Player</p>
        <h1>Character Access</h1>
        {panelMessage ? <p className="dm-status-line">{panelMessage}</p> : null}
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
          {localOnlyPlayerCharacters.length > 0 ? (
            <div className="character-access-row">
              <span>
                {localOnlyPlayerCharacters.length} local-only character(s) found.
              </span>
              <button
                type="button"
                className="flow-secondary"
                disabled={isMigrating}
                onClick={handleUploadLocalCharacters}
              >
                {isMigrating ? "Uploading..." : "Upload To Supabase"}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
