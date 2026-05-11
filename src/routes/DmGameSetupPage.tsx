import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { createCampaign } from "../lib/realtimeSessionRepository.ts";
import { getSupabaseClient } from "../lib/supabaseClient.ts";
import { useAppFlow } from "../state/appFlow";
import { useOnlineSession } from "../state/onlineSession.tsx";

const rulesets = ["Convergence", "D&D 5e", "Custom"];
const settings = ["Portals", "Forgotten Realms", "Homebrew"];

export function DmGameSetupPage() {
  const navigate = useNavigate();
  const client = useMemo(() => getSupabaseClient(), []);
  const online = useOnlineSession();
  const { roleChoice, chooseRole } = useAppFlow();
  const [gameName, setGameName] = useState("Portals");
  const [ruleset, setRuleset] = useState(rulesets[0]);
  const [setting, setSetting] = useState(settings[0]);
  const [message, setMessage] = useState("");

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  async function handleCreateGame(): Promise<void> {
    if (!client || online.status !== "authenticated" || !online.user) {
      setMessage("Sign in is required to create online games.");
      return;
    }

    const resolvedGameName = gameName.trim() || "Portals";
    const result = await createCampaign({
      client,
      gameName: resolvedGameName,
      name: "Campaign 1",
      ownerUserId: online.user.id,
      ownerDisplayName: online.profile?.displayName ?? online.user.email ?? "DM",
    });

    if ("error" in result) {
      setMessage(result.error);
      return;
    }

    const params = new URLSearchParams({
      gameId: result.campaign.gameId ?? result.campaign.id,
      campaignId: result.campaign.id,
      gameName: result.campaign.gameName ?? resolvedGameName,
      ruleset,
      setting,
    });
    chooseRole("dm");
    navigate(`/dm?${params.toString()}`);
  }

  return (
    <main className="flow-page role-game-page">
      <section className="flow-card flow-card-wide game-setup-card">
        <p className="section-kicker">Game Setup</p>
        <h1>Create New Game</h1>
        {message ? <p className="dm-status-line">{message}</p> : null}
        <div className="game-setup-form">
          <label className="dm-field">
            <span>Game Name</span>
            <input
              value={gameName}
              onChange={(event) => setGameName(event.target.value)}
              placeholder="Portals"
            />
          </label>
          <label className="dm-field">
            <span>Ruleset</span>
            <select value={ruleset} onChange={(event) => setRuleset(event.target.value)}>
              {rulesets.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="dm-field">
            <span>Setting</span>
            <select value={setting} onChange={(event) => setSetting(event.target.value)}>
              {settings.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="flow-primary game-setup-submit" onClick={handleCreateGame}>
          Create Game
        </button>
      </section>
    </main>
  );
}
