import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { type CombatResolutionMode } from "../config/combatWorkflow";
import { resolveAndLogCombat } from "../lib/combatResolution";
import { advanceCombatTurn } from "../lib/dmActions";
import { isSupabaseConfigured } from "../lib/env";
import { loadDmDashboard, type DmDashboardData } from "../lib/dmDashboard";
import { subscribeToDmDashboardState } from "../lib/realtime";
import { useAuthStore } from "../state/authStore";

type LoadState = "idle" | "loading" | "ready" | "empty" | "error";
type MutationState = "idle" | "running";

export function DmDashboardPage() {
  const configured = isSupabaseConfigured();
  const authStatus = useAuthStore((state) => state.status);
  const authUser = useAuthStore((state) => state.user);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [dashboardData, setDashboardData] = useState<DmDashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [attackerParticipantId, setAttackerParticipantId] = useState<string>("");
  const [defenderParticipantId, setDefenderParticipantId] = useState<string>("");
  const [attackSuccesses, setAttackSuccesses] = useState(5);
  const [targetArmorClass, setTargetArmorClass] = useState(4);
  const [damageInput, setDamageInput] = useState(4);
  const [mitigation, setMitigation] = useState(1);
  const [damageMode, setDamageMode] = useState<CombatResolutionMode>("physical");

  useEffect(() => {
    if (!configured || !authUser) {
      setDashboardData(null);
      setErrorMessage(null);
      setLoadState("idle");
      setSelectedEncounterId(null);
      setMutationMessage(null);
      return;
    }

    let cancelled = false;
    setLoadState("loading");
    setErrorMessage(null);

    loadDmDashboard()
      .then((data) => {
        if (cancelled) {
          return;
        }

        if (data.characters.length === 0 && data.encounters.length === 0) {
          setDashboardData(data);
          setSelectedEncounterId(null);
          setLoadState("empty");
          return;
        }

        setDashboardData(data);
        setSelectedEncounterId((current) => current ?? data.encounters[0]?.encounterId ?? null);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setDashboardData(null);
        setLoadState("error");
        setErrorMessage(error instanceof Error ? error.message : "Unable to load the DM dashboard.");
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, configured, reloadToken]);

  useEffect(() => {
    if (!configured || !authUser) {
      return;
    }

    return subscribeToDmDashboardState(() => {
      setReloadToken((value) => value + 1);
    });
  }, [authUser, configured]);

  const encounters = dashboardData?.encounters ?? [];
  const selectedEncounter =
    encounters.find((encounter) => encounter.encounterId === selectedEncounterId) ?? encounters[0] ?? null;
  const selectedParticipants = selectedEncounter?.participants ?? [];

  useEffect(() => {
    if (selectedParticipants.length === 0) {
      setAttackerParticipantId("");
      setDefenderParticipantId("");
      return;
    }

    setAttackerParticipantId((current) => {
      if (current && selectedParticipants.some((participant) => participant.participantId === current)) {
        return current;
      }

      return selectedParticipants[0]?.participantId ?? "";
    });
    setDefenderParticipantId((current) => {
      if (current && selectedParticipants.some((participant) => participant.participantId === current)) {
        return current;
      }

      const fallback = selectedParticipants.find(
        (participant) => participant.participantId !== selectedParticipants[0]?.participantId
      );
      return fallback?.participantId ?? selectedParticipants[0]?.participantId ?? "";
    });
  }, [selectedParticipants]);

  async function handleAdvanceTurn() {
    if (!selectedEncounter || selectedEncounter.revision === null || mutationState === "running") {
      return;
    }

    setMutationState("running");
    setMutationMessage(null);

    try {
      const result = await advanceCombatTurn(selectedEncounter.encounterId, selectedEncounter.revision);
      setMutationMessage(
        `Advanced turn to revision ${result.revision}. Round ${result.round_number} is now active.`
      );
      setReloadToken((value) => value + 1);
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : "Unable to advance the encounter turn.");
    } finally {
      setMutationState("idle");
    }
  }

  async function handleResolveCombat() {
    if (!selectedEncounter || mutationState === "running") {
      return;
    }

    const attacker = selectedParticipants.find(
      (participant) => participant.participantId === attackerParticipantId
    );
    const defender = selectedParticipants.find(
      (participant) => participant.participantId === defenderParticipantId
    );

    if (!attacker || !defender) {
      setMutationMessage("Choose both an attacker and defender first.");
      return;
    }

    setMutationState("running");
    setMutationMessage(null);

    try {
      const resolution = await resolveAndLogCombat({
        encounterId: selectedEncounter.encounterId,
        attackerParticipantId: attacker.participantId,
        attackerName: attacker.displayName,
        attackerIsPlayer: attacker.kind === "character",
        defenderParticipantId: defender.participantId,
        defenderName: defender.displayName,
        defenderIsPlayer: defender.kind === "character",
        attackSuccesses,
        targetArmorClass,
        damageInput,
        mitigation,
        damageMode,
      });
      setMutationMessage(resolution.message);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : "Unable to resolve and log combat.");
    } finally {
      setMutationState("idle");
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-topline">
          <p className="eyebrow">Convergence DM Dashboard</p>
          <span className={`status-pill ${configured ? "ok" : "warn"}`}>
            {configured ? "Supabase Env Ready" : "Supabase Env Missing"}
          </span>
        </div>
        <h1>Interactive DM View</h1>
        <p className="hero-copy">
          This route reads visible encounter state, combat tracker rows, and character summaries from
          Supabase. It also advances turn order and reacts to realtime table changes.
        </p>
        <nav className="route-nav" aria-label="Primary routes">
          <Link to="/">Player Route</Link>
          <Link to="/dm">DM Route</Link>
          <Link to="/login">Login</Link>
        </nav>
      </section>

      {!configured && (
        <section className="section-card empty-state">
          <h2>Supabase is not connected yet.</h2>
          <p>Add the project env vars locally before testing the DM dashboard.</p>
        </section>
      )}

      {configured && authStatus === "loading" && (
        <section className="section-card empty-state">
          <h2>Checking session</h2>
          <p>The app is reading the current browser session before loading dashboard state.</p>
        </section>
      )}

      {configured && authStatus !== "loading" && !authUser && (
        <section className="section-card empty-state">
          <h2>No signed-in user</h2>
          <p>Sign in first so the dashboard can read the rows allowed by Supabase policies.</p>
          <Link className="inline-link" to="/login">
            Go to Login
          </Link>
        </section>
      )}

      {configured && authUser && loadState === "loading" && (
        <section className="section-card empty-state">
          <h2>Loading dashboard</h2>
          <p>The app is fetching visible character, encounter, participant, tracker, and log rows.</p>
        </section>
      )}

      {configured && authUser && loadState === "empty" && (
        <section className="section-card empty-state">
          <h2>No dashboard data yet</h2>
          <p>
            The project is connected, but there are no visible character or encounter rows for the
            current session.
          </p>
        </section>
      )}

      {configured && authUser && loadState === "error" && (
        <section className="section-card empty-state">
          <h2>Unable to load the DM dashboard</h2>
          <p>{errorMessage ?? "An unknown error occurred while reading Supabase state."}</p>
        </section>
      )}

      {dashboardData && loadState === "ready" && (
        <section className="dashboard-layout">
          <article className="section-card">
            <p className="panel-label">Visible Characters</p>
            <div className="list-block">
              {dashboardData.characters.length > 0 ? (
                dashboardData.characters.map((character) => (
                  <div key={character.characterId} className="list-row">
                    <span>
                      {character.displayName} {character.isPlayerCharacter ? "(PC)" : "(NPC)"}
                    </span>
                    <strong>
                      HP {character.currentHp} | Mana {character.currentMana} | CR {character.cr}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No visible characters were returned by Supabase.</p>
              )}
            </div>
          </article>

          <article className="section-card">
            <p className="panel-label">Encounter Panel</p>
            <div className="encounter-tabs">
              {encounters.length > 0 ? (
                encounters.map((encounter) => (
                  <button
                    key={encounter.encounterId}
                    type="button"
                    className={encounter.encounterId === selectedEncounter?.encounterId ? "active" : ""}
                    onClick={() => setSelectedEncounterId(encounter.encounterId)}
                  >
                    {encounter.label}
                  </button>
                ))
              ) : (
                <p className="muted-copy">No encounters are available yet.</p>
              )}
            </div>

            {selectedEncounter && (
              <div className="encounter-summary">
                <div className="list-row">
                  <span>Round</span>
                  <strong>{selectedEncounter.roundNumber ?? "-"}</strong>
                </div>
                <div className="list-row">
                  <span>Revision</span>
                  <strong>{selectedEncounter.revision ?? "-"}</strong>
                </div>
                <div className="list-row">
                  <span>Action State</span>
                  <strong>{selectedEncounter.actionSummary}</strong>
                </div>
                <div className="chip-actions">
                  <button
                    type="button"
                    className="chip-button"
                    disabled={mutationState === "running" || selectedEncounter.revision === null}
                    onClick={() => {
                      void handleAdvanceTurn();
                    }}
                  >
                    Next Turn
                  </button>
                </div>
              </div>
            )}
          </article>

          <article className="section-card">
            <p className="panel-label">Initiative Order</p>
            <div className="list-block">
              {selectedEncounter ? (
                selectedEncounter.participants.length > 0 ? (
                  selectedEncounter.participants.map((participant) => (
                    <div
                      key={participant.participantId}
                      className={`list-row ${participant.isActiveTurn ? "active-row" : ""}`}
                    >
                      <span>
                        {participant.displayName} ({participant.kind})
                      </span>
                      <strong>
                        Init {participant.initiative} | {participant.state}
                        {participant.isActiveTurn ? " | Active Turn" : ""}
                      </strong>
                    </div>
                  ))
                ) : (
                  <p className="muted-copy">This encounter has no participants yet.</p>
                )
              ) : (
                <p className="muted-copy">Select or create an encounter to view initiative order.</p>
              )}
            </div>
          </article>

          <article className="section-card">
            <p className="panel-label">Quick Resolution</p>
            {selectedEncounter ? (
              <div className="write-grid">
                <div className="write-card">
                  <label className="auth-label" htmlFor="attacker-participant">
                    Attacker
                  </label>
                  <select
                    id="attacker-participant"
                    className="auth-input"
                    value={attackerParticipantId}
                    onChange={(event) => setAttackerParticipantId(event.target.value)}
                    disabled={mutationState === "running"}
                  >
                    {selectedParticipants.map((participant) => (
                      <option key={participant.participantId} value={participant.participantId}>
                        {participant.displayName}
                      </option>
                    ))}
                  </select>

                  <label className="auth-label" htmlFor="defender-participant">
                    Defender
                  </label>
                  <select
                    id="defender-participant"
                    className="auth-input"
                    value={defenderParticipantId}
                    onChange={(event) => setDefenderParticipantId(event.target.value)}
                    disabled={mutationState === "running"}
                  >
                    {selectedParticipants.map((participant) => (
                      <option key={participant.participantId} value={participant.participantId}>
                        {participant.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="write-card">
                  <label className="auth-label" htmlFor="attack-successes">
                    Attack Successes
                  </label>
                  <input
                    id="attack-successes"
                    className="auth-input"
                    type="number"
                    step={1}
                    value={attackSuccesses}
                    onChange={(event) => setAttackSuccesses(Number(event.target.value) || 0)}
                    disabled={mutationState === "running"}
                  />

                  <label className="auth-label" htmlFor="target-ac">
                    Target AC
                  </label>
                  <input
                    id="target-ac"
                    className="auth-input"
                    type="number"
                    step={1}
                    value={targetArmorClass}
                    onChange={(event) => setTargetArmorClass(Number(event.target.value) || 0)}
                    disabled={mutationState === "running"}
                  />
                </div>

                <div className="write-card">
                  <label className="auth-label" htmlFor="damage-input">
                    Damage Input
                  </label>
                  <input
                    id="damage-input"
                    className="auth-input"
                    type="number"
                    step={1}
                    value={damageInput}
                    onChange={(event) => setDamageInput(Number(event.target.value) || 0)}
                    disabled={mutationState === "running"}
                  />

                  <label className="auth-label" htmlFor="mitigation">
                    DR / Soak
                  </label>
                  <input
                    id="mitigation"
                    className="auth-input"
                    type="number"
                    step={1}
                    value={mitigation}
                    onChange={(event) => setMitigation(Number(event.target.value) || 0)}
                    disabled={mutationState === "running"}
                  />
                </div>

                <div className="write-card">
                  <label className="auth-label" htmlFor="damage-mode">
                    Damage Mode
                  </label>
                  <select
                    id="damage-mode"
                    className="auth-input"
                    value={damageMode}
                    onChange={(event) => setDamageMode(event.target.value as CombatResolutionMode)}
                    disabled={mutationState === "running"}
                  >
                    <option value="physical">Physical</option>
                    <option value="magical">Magical</option>
                  </select>

                  <div className="auth-actions">
                    <button
                      type="button"
                      disabled={
                        mutationState === "running" ||
                        !attackerParticipantId ||
                        !defenderParticipantId ||
                        attackerParticipantId === defenderParticipantId
                      }
                      onClick={() => {
                        void handleResolveCombat();
                      }}
                    >
                      Resolve and Log
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted-copy">Select an encounter before resolving combat.</p>
            )}
          </article>

          <article className="section-card">
            <p className="panel-label">Combat Log</p>
            <div className="log-block">
              {selectedEncounter ? (
                selectedEncounter.logs.length > 0 ? (
                  selectedEncounter.logs.map((entry) => <p key={entry.combat_log_entry_id}>{entry.message}</p>)
                ) : (
                  <p className="muted-copy">No combat log entries are stored for this encounter.</p>
                )
              ) : (
                <p className="muted-copy">No encounter selected.</p>
              )}
            </div>
          </article>

          {mutationMessage && (
            <article className="section-card">
              <p className="panel-label">Write Result</p>
              <p className="muted-copy">{mutationMessage}</p>
            </article>
          )}
        </section>
      )}
    </main>
  );
}
