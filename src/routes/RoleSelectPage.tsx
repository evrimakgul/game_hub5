import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { listCampaignsForRole } from "../lib/realtimeSessionRepository.ts";
import { getSupabaseClient } from "../lib/supabaseClient.ts";
import { useAppFlow } from "../state/appFlow";
import { useOnlineSession } from "../state/onlineSession";
import type { CampaignRecord } from "../types/realtimeSession.ts";

type DmGameSummary = {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  createdAt: string;
};

function summarizeGames(campaigns: CampaignRecord[]): DmGameSummary[] {
  const summaries = new Map<string, DmGameSummary>();

  campaigns.forEach((campaign) => {
    const id = campaign.gameId ?? campaign.id;
    if (summaries.has(id)) {
      return;
    }

    summaries.set(id, {
      id,
      name: campaign.gameName ?? campaign.name,
      campaignId: campaign.id,
      campaignName: campaign.name,
      createdAt: campaign.createdAt,
    });
  });

  return [...summaries.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export function RoleSelectPage() {
  const navigate = useNavigate();
  const { authChoice, chooseRole } = useAppFlow();
  const online = useOnlineSession();
  const client = useMemo(() => getSupabaseClient(), []);
  const [dmFlowOpen, setDmFlowOpen] = useState(false);
  const [activeGames, setActiveGames] = useState<DmGameSummary[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!dmFlowOpen || !client || online.status !== "authenticated" || !online.user) {
      return;
    }

    const supabase = client;
    const userId = online.user.id;

    async function loadDmGames(): Promise<void> {
      const result = await listCampaignsForRole({
        client: supabase,
        userId,
        role: "dm",
      });

      if ("error" in result) {
        setMessage(result.error);
        return;
      }

      setActiveGames(summarizeGames(result));
    }

    void loadDmGames();
  }, [client, dmFlowOpen, online.status, online.user]);

  if (!authChoice) {
    return <Navigate to="/" replace />;
  }

  function handleRole(choice: "player" | "dm"): void {
    chooseRole(choice);
    if (choice === "dm" && online.status === "authenticated") {
      setDmFlowOpen(true);
      return;
    }

    navigate(choice === "player" ? "/player" : "/dm");
  }

  function handleOpenGame(game: DmGameSummary): void {
    chooseRole("dm");
    const params = new URLSearchParams({
      gameId: game.id,
      campaignId: game.campaignId,
      gameName: game.name,
    });
    navigate(`/dm?${params.toString()}`);
  }

  async function handleSignOut(): Promise<void> {
    if (online.isConfigured && online.status === "authenticated") {
      await online.signOut();
    }

    navigate("/");
  }

  return dmFlowOpen ? (
    <main className="flow-page role-game-page">
      <section className="flow-card flow-card-wide role-game-card">
        <p className="section-kicker">Dungeon Master</p>
        <h1>Choose Game</h1>
        {message ? <p className="dm-status-line">{message}</p> : null}
        <div className="role-game-create">
          <button
            type="button"
            className="flow-primary role-game-create-button"
            onClick={() => navigate("/dm/games/new")}
          >
            Create New Game
          </button>
        </div>
        <div className="role-game-grid">
          <article className="role-game-list">
            <h2>Retired Games</h2>
            <p>No retired games.</p>
          </article>
          <article className="role-game-list">
            <h2>Active Games</h2>
            {activeGames.length > 0 ? (
              <div className="role-game-buttons">
                {activeGames.map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    className="flow-secondary"
                    onClick={() => handleOpenGame(game)}
                  >
                    <strong>{game.name}</strong>
                    <span>{game.campaignName}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p>No active games.</p>
            )}
          </article>
        </div>
        <div className="flow-actions">
          <button type="button" className="flow-secondary" onClick={() => setDmFlowOpen(false)}>
            Back
          </button>
        </div>
      </section>
    </main>
  ) : (
    <main className="flow-page">
      <section className="flow-card">
        <p className="section-kicker">Role</p>
        <h1>Choose Your Side</h1>
        {online.isConfigured && online.status === "authenticated" ? (
          <p className="dm-summary-line">
            Signed in as {online.profile?.displayName ?? online.user?.email ?? online.user?.id}.
          </p>
        ) : null}
        <div className="flow-actions">
          <button type="button" className="flow-primary" onClick={() => handleRole("dm")}>
            Dungeon Master
          </button>
          <button type="button" className="flow-secondary" onClick={() => handleRole("player")}>
            Player
          </button>
          <button type="button" className="flow-secondary" onClick={handleSignOut}>
            {online.isConfigured && online.status === "authenticated" ? "Sign Out" : "Exit"}
          </button>
        </div>
      </section>
    </main>
  );
}
