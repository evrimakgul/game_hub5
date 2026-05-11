import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { normalizeCharacterDraft, type CharacterDraft } from "../config/characterTemplate.ts";
import { listCampaignCharacters, listCampaignsForRole } from "../lib/realtimeSessionRepository.ts";
import { getSupabaseClient } from "../lib/supabaseClient.ts";
import { useAppFlow } from "../state/appFlow";
import { useOnlineSession } from "../state/onlineSession.tsx";
import type { CampaignCharacterRecord } from "../types/realtimeSession.ts";

export function DmCharacterHubPage() {
  const navigate = useNavigate();
  const client = useMemo(() => getSupabaseClient(), []);
  const online = useOnlineSession();
  const { roleChoice, characters, selectCharacter, replaceCharacters } = useAppFlow();
  const playerCharacters = characters.filter((character) => character.ownerRole === "player");
  const [campaignCharacters, setCampaignCharacters] = useState<CampaignCharacterRecord[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!client || online.status !== "authenticated" || !online.user) {
      return;
    }

    const supabase = client;
    const userId = online.user.id;

    async function loadCampaignCharacters(): Promise<void> {
      const campaigns = await listCampaignsForRole({ client: supabase, userId, role: "dm" });
      if ("error" in campaigns) {
        setMessage(campaigns.error);
        return;
      }

      const campaignId = campaigns[0]?.id;
      if (!campaignId) {
        setCampaignCharacters([]);
        return;
      }

      const result = await listCampaignCharacters({ client: supabase, campaignId });
      if ("error" in result) {
        setMessage(result.error);
        return;
      }

      setCampaignCharacters(result);
    }

    void loadCampaignCharacters();
  }, [client, online.status, online.user]);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }
  const campaignCharacterIds = new Set(
    campaignCharacters.map((character) => character.characterId)
  );
  const localOnlyPlayerCharacters = playerCharacters.filter(
    (character) => !campaignCharacterIds.has(character.id)
  );

  function handleOpenCharacter(characterId: string): void {
    selectCharacter(characterId);
    navigate(`/dm/character?characterId=${encodeURIComponent(characterId)}`);
  }

  function handleOpenCampaignCharacter(record: CampaignCharacterRecord): void {
    const character = {
      id: record.characterId,
      ownerRole: "player" as const,
      sheet: normalizeCharacterDraft(record.sheetPayload as CharacterDraft),
    };
    replaceCharacters([
      ...characters.filter((entry) => entry.id !== record.characterId),
      character,
    ]);
    selectCharacter(record.characterId);
    navigate(`/dm/character?characterId=${encodeURIComponent(record.characterId)}`);
  }

  async function handleSignOut(): Promise<void> {
    if (online.isConfigured && online.status === "authenticated") {
      await online.signOut();
    }

    navigate("/");
  }

  return (
    <main className="flow-page">
      <section className="flow-card flow-card-wide">
        <nav className="sheet-top-nav">
          <button type="button" className="sheet-nav-button" onClick={handleSignOut}>
            Sign Out
          </button>
          <button type="button" className="sheet-nav-button" onClick={() => navigate("/")}>
            Main Menu
          </button>
          <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
            Back
          </button>
        </nav>
        <p className="section-kicker">Dungeon Master</p>
        <h1>Player Characters</h1>
        <div className="flow-actions">
          {message ? <p className="dm-status-line">{message}</p> : null}
          {campaignCharacters.length > 0 ? (
            <>
              <p className="section-kicker">Campaign Characters</p>
              {campaignCharacters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  className="flow-secondary"
                  onClick={() => handleOpenCampaignCharacter(character)}
                >
                  {character.displayName || "Unnamed Character"}
                </button>
              ))}
            </>
          ) : null}
          {localOnlyPlayerCharacters.length > 0 ? (
            <>
              <p className="section-kicker">Local Player Sheets</p>
              {localOnlyPlayerCharacters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  className="flow-secondary"
                  onClick={() => handleOpenCharacter(character.id)}
                >
                  {character.sheet.name.trim() || "Unnamed Character"}
                </button>
              ))}
            </>
          ) : campaignCharacters.length === 0 ? (
            <p className="empty-block-copy">No player characters are saved locally yet.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
