import { Navigate, useNavigate } from "react-router-dom";

import { buildCharacterEncounterSnapshot } from "../config/combatEncounter";
import { useAppFlow } from "../state/appFlow";

const HELPER_EXCLUDED_SUMMARY_IDS = new Set(["hp", "mana", "ac", "dr", "soak"]);

function formatEncounterTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }

  return date.toLocaleString();
}

export function CombatEncounterPage() {
  const navigate = useNavigate();
  const { roleChoice, activeCombatEncounter, characters } = useAppFlow();

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  if (!activeCombatEncounter) {
    return <Navigate to="/dm/combat" replace />;
  }

  function openCharacterSheet(characterId: string, ownerRole: "player" | "dm"): void {
    const routePath = ownerRole === "dm" ? "/dm/npc-character" : "/dm/character";
    const popupUrl = `${routePath}?characterId=${encodeURIComponent(characterId)}`;

    window.open(
      popupUrl,
      "_blank",
      "popup=yes,width=1380,height=920,noopener,noreferrer"
    );
  }

  const encounterParticipants = activeCombatEncounter.participants.map((participant) => {
    const character = characters.find((entry) => entry.id === participant.characterId) ?? null;
    const snapshot = character ? buildCharacterEncounterSnapshot(character.sheet) : null;

    return {
      participant,
      character,
      snapshot,
    };
  });

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Combat Encounter Page</h1>
          </div>
          <div className="dm-nav-actions">
            <button
              type="button"
              className="sheet-nav-button"
              onClick={() => navigate("/dm/combat")}
            >
              Combat Dashboard
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
          </div>
        </header>

        <section className="dm-encounter-layout">
          <article className="sheet-card">
            <p className="section-kicker">Encounter</p>
            <h2>{activeCombatEncounter.label}</h2>
            <p className="dm-summary-line">
              Initiative has been rolled for {activeCombatEncounter.participants.length} combatants.
            </p>
            <div className="dm-action-grid">
              <div>
                <span>Created</span>
                <strong>{formatEncounterTime(activeCombatEncounter.createdAt)}</strong>
              </div>
              <div>
                <span>Encounter Id</span>
                <strong>{activeCombatEncounter.encounterId}</strong>
              </div>
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Dice Pool Helper</p>
            <h2>Reference Panel</h2>
            <div className="dm-helper-grid">
              {encounterParticipants.map(({ participant, snapshot }, index) => (
                <section key={participant.characterId} className="dm-helper-card">
                  <div className="dm-helper-head">
                    <div>
                      <strong>
                        {index + 1}. {participant.displayName}
                      </strong>
                      <small>
                        Init Pool {participant.initiativePool} | Roll{" "}
                        {participant.initiativeFaces.join(", ")} | Successes{" "}
                        {participant.initiativeSuccesses}
                      </small>
                    </div>
                  </div>

                  {snapshot ? (
                    <>
                      <div className="dm-summary-mini-grid">
                        {snapshot.combatSummary
                          .filter((field) => !HELPER_EXCLUDED_SUMMARY_IDS.has(field.id))
                          .map((field) => (
                            <div key={field.id}>
                              <span>{field.label}</span>
                              <strong>{field.value}</strong>
                            </div>
                          ))}
                        <div>
                          <span>Inspiration</span>
                          <strong>{snapshot.inspiration}</strong>
                        </div>
                      </div>

                      <div className="dm-compact-grid">
                        {snapshot.stats.map((field) => (
                          <div key={field.id} className="dm-compact-row">
                            <span>{field.label}</span>
                            <strong>{field.value}</strong>
                            <small>{field.summary}</small>
                          </div>
                        ))}
                      </div>

                      <div className="dm-compact-grid">
                        {snapshot.highlightedSkills.map((field) => (
                          <div key={field.id} className="dm-compact-row">
                            <span>{field.label}</span>
                            <strong>{field.value}</strong>
                            <small>{field.summary}</small>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="dm-summary-line">
                      This combatant no longer resolves to a saved character sheet.
                    </p>
                  )}
                </section>
              ))}
            </div>
          </article>

          <article className="sheet-card dm-log-card">
            <p className="section-kicker">Combatants Block</p>
            <h2>Initiative Order</h2>
            <div className="dm-accordion-list">
              {encounterParticipants.map(({ participant, snapshot }, index) => (
                <details key={participant.characterId} className="dm-accordion">
                  <summary className="dm-accordion-summary">
                    <div>
                      <strong>
                        {index + 1}. {participant.displayName}
                      </strong>
                      <small>
                        Init Pool {participant.initiativePool} | Roll{" "}
                        {participant.initiativeFaces.join(", ")} | Successes{" "}
                        {participant.initiativeSuccesses}
                      </small>
                    </div>
                  </summary>

                  <div className="dm-accordion-body">
                    {snapshot ? (
                      <>
                        <div className="dm-control-row">
                          <button
                            type="button"
                            className="flow-secondary"
                            onClick={() =>
                              openCharacterSheet(
                                participant.characterId,
                                participant.ownerRole
                              )
                            }
                          >
                            Open Full Character Sheet
                          </button>
                        </div>

                        <div className="dm-action-grid">
                          {snapshot.combatSummary.map((field) => (
                            <div key={field.id}>
                              <span>{field.label}</span>
                              <strong>{field.value}</strong>
                            </div>
                          ))}
                          <div>
                            <span>Inspiration</span>
                            <strong>{snapshot.inspiration}</strong>
                          </div>
                        </div>

                        {snapshot.visibleResistances.length > 0 ? (
                          <div className="dm-stack">
                            <div>
                              <p className="section-kicker">Resistances</p>
                              <div className="dm-pill-list">
                                {snapshot.visibleResistances.map((resistance) => (
                                  <div key={resistance.id} className="dm-pill">
                                    <strong>{resistance.label}</strong>
                                    <span>
                                      {resistance.levelLabel} {resistance.multiplierLabel}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="dm-stack">
                          <div>
                            <p className="section-kicker">Stats</p>
                            <div className="dm-detail-grid">
                              {snapshot.stats.map((field) => (
                                <article key={field.id} className="dm-detail-card">
                                  <span>{field.label}</span>
                                  <strong>{field.value}</strong>
                                  <small>{field.summary}</small>
                                  <small>{field.detail}</small>
                                </article>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="section-kicker">Highlighted Skills</p>
                            <div className="dm-detail-grid-small">
                              {snapshot.highlightedSkills.map((field) => (
                                <article key={field.id} className="dm-detail-card">
                                  <span>{field.label}</span>
                                  <strong>{field.value}</strong>
                                  <small>{field.summary}</small>
                                  <small>{field.detail}</small>
                                </article>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="dm-summary-line">
                        This combatant no longer resolves to a saved character sheet.
                      </p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
