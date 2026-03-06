import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import {
  advanceTurn,
  castPower,
  dispatchAction,
  finalizeCombat,
  type AttackCommand,
} from "../config/combatRuntime";
import { getRuntimePowerLevel } from "../config/powerRuntime";
import type { CombatState } from "../types/combat";
import { POWER_IDS, type ActionType, type CoreStatId, type PowerId } from "../types/game";
import { useAppFlow } from "../state/appFlow";

const PHYSICAL_STATS: CoreStatId[] = ["STR", "DEX", "STAM"];

function asPowerId(value: string): PowerId | null {
  if (POWER_IDS.includes(value as PowerId)) {
    return value as PowerId;
  }

  return null;
}

export function CombatEncounterPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    activeCombat,
    updateCombatEncounter,
    selectCharacter,
  } = useAppFlow();
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [consumeActionType, setConsumeActionType] = useState<ActionType>("standard");
  const [attackTargetId, setAttackTargetId] = useState<string>("");
  const [attackActionType, setAttackActionType] = useState<ActionType>("standard");
  const [attackSuccesses, setAttackSuccesses] = useState(6);
  const [attackDamage, setAttackDamage] = useState(3);
  const [attackKind, setAttackKind] = useState<"physical" | "magical">("physical");
  const [selectedPowerId, setSelectedPowerId] = useState<string>("");
  const [powerActionType, setPowerActionType] = useState<ActionType>("standard");
  const [powerTargetId, setPowerTargetId] = useState<string>("");
  const [selectedPhysicalStat, setSelectedPhysicalStat] = useState<CoreStatId>("STR");

  const combatState = activeCombat;

  const activeParticipantId = useMemo(() => {
    if (!combatState) {
      return null;
    }

    return combatState.turn.initiativeOrder[combatState.turn.activeIndex] ?? null;
  }, [combatState]);

  const activeParticipant = activeParticipantId
    ? combatState?.participants[activeParticipantId] ?? null
    : null;

  const activeKnownPowers = useMemo(() => {
    if (!activeParticipant) {
      return [];
    }

    return (Object.entries(activeParticipant.profile.knownPowers) as Array<[PowerId, number]>)
      .filter(([, level]) => level > 0)
      .filter(([powerId, level]) => {
        const runtime = getRuntimePowerLevel(powerId, level);
        return Boolean(runtime && runtime.castMode !== "none" && runtime.actionType !== null);
      });
  }, [activeParticipant]);

  useEffect(() => {
    if (!combatState || !activeParticipantId) {
      return;
    }

    const fallbackTarget = combatState.turn.initiativeOrder.find(
      (participantId) => participantId !== activeParticipantId
    );
    if (fallbackTarget && !combatState.participants[attackTargetId]) {
      setAttackTargetId(fallbackTarget);
    }

    if (fallbackTarget && !combatState.participants[powerTargetId]) {
      setPowerTargetId(fallbackTarget);
    }

    if (!selectedPowerId && activeKnownPowers.length > 0) {
      setSelectedPowerId(activeKnownPowers[0][0]);
    }
  }, [
    activeKnownPowers,
    activeParticipantId,
    attackTargetId,
    combatState,
    powerTargetId,
    selectedPowerId,
  ]);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  if (!combatState) {
    return <Navigate to="/dm/combat" replace />;
  }

  function updateCombatState(updater: (state: CombatState) => CombatState): void {
    try {
      updateCombatEncounter((currentState) => updater(currentState));
      setDashboardError(null);
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Action could not be resolved."
      );
    }
  }

  function handleAdvanceTurn(): void {
    updateCombatState((state) => advanceTurn(state, "dm"));
  }

  function handleFinalizeCombat(): void {
    updateCombatState((state) => finalizeCombat(state, "dm"));
  }

  function handleConsumeAction(): void {
    if (!activeParticipantId) {
      return;
    }

    updateCombatState((state) =>
      dispatchAction(
        state,
        {
          kind: "consume_action",
          actorParticipantId: activeParticipantId,
          requestedAction: consumeActionType,
        },
        "dm"
      )
    );
  }

  function handleAttack(): void {
    if (!activeParticipantId || !attackTargetId) {
      return;
    }

    const command: AttackCommand = {
      kind: "attack",
      actorParticipantId: activeParticipantId,
      targetParticipantId: attackTargetId,
      requestedAction: attackActionType,
      attackSuccesses,
      damageAmount: attackDamage,
      damageKind: attackKind,
    };

    updateCombatState((state) => dispatchAction(state, command, "dm"));
  }

  function handleCastPower(): void {
    if (!activeParticipantId) {
      return;
    }

    const powerId = asPowerId(selectedPowerId);
    if (!powerId) {
      return;
    }

    updateCombatState((state) =>
      castPower(
        state,
        {
          actorParticipantId: activeParticipantId,
          powerId,
          requestedAction: powerActionType,
          targetParticipantId: powerTargetId || activeParticipantId,
          selectedStat: selectedPhysicalStat,
        },
        "dm"
      )
    );
  }

  function handleOpenCharacter(characterId: string): void {
    selectCharacter(characterId);
    navigate("/dm/character");
  }

  const playerParticipants = combatState.turn.initiativeOrder
    .map((participantId) => combatState.participants[participantId])
    .filter(
      (participant): participant is NonNullable<typeof participant> =>
        Boolean(participant?.profile.characterId) && participant.profile.ownerRole === "player"
    );

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Combat Encounter</h1>
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

        <section className="dm-dashboard-grid">
          <article className="sheet-card">
            <p className="section-kicker">Encounter</p>
            <h2>{combatState.label}</h2>
            <p className="dm-summary-line">Status: {combatState.status}</p>
            <p className="dm-summary-line">Round: {combatState.turn.roundNumber}</p>
            <p className="dm-summary-line">
              Active: {activeParticipant?.profile.displayName ?? "-"}
            </p>
            <div className="dm-control-row">
              <button type="button" className="flow-primary" onClick={handleAdvanceTurn}>
                Advance Turn
              </button>
              <button type="button" className="flow-danger" onClick={handleFinalizeCombat}>
                Finalize Combat
              </button>
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Player Character Block</p>
            <h2>Player Characters</h2>
            <div className="dm-list">
              {playerParticipants.length === 0 ? (
                <p className="empty-block-copy">No player characters are in this encounter.</p>
              ) : (
                playerParticipants.map((participant) => (
                  <div key={participant.profile.participantId} className="dm-selection-row">
                    <span>{participant.profile.displayName}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenCharacter(participant.profile.characterId!)}
                    >
                      Open Sheet
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Initiative</p>
            <h2>Turn Order</h2>
            <div className="dm-order-list">
              {combatState.turn.initiativeOrder.map((participantId, index) => {
                const participant = combatState.participants[participantId];
                const isActive = index === combatState.turn.activeIndex;
                if (!participant) {
                  return null;
                }

                return (
                  <div key={participantId} className={`dm-order-row${isActive ? " is-active" : ""}`}>
                    <strong>
                      {index + 1}. {participant.profile.displayName}
                    </strong>
                    <span>
                      Init {participant.derived.initiative} | HP {participant.profile.currentHp}/
                      {participant.derived.maxHp} | Mana {participant.profile.currentMana}
                    </span>
                    <small>
                      {participant.profile.kind} | {participant.profile.ownerRole}
                      {participant.defeated ? " | defeated" : ""}
                    </small>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Active Controls</p>
            <h2>Action Economy</h2>
            {activeParticipant ? (
              <>
                <div className="dm-action-grid">
                  <div>
                    <span>Standard</span>
                    <strong>{activeParticipant.actionState.available.standard ?? "inf"}</strong>
                  </div>
                  <div>
                    <span>Bonus</span>
                    <strong>{activeParticipant.actionState.available.bonus ?? "inf"}</strong>
                  </div>
                  <div>
                    <span>Move</span>
                    <strong>{activeParticipant.actionState.available.move ?? "inf"}</strong>
                  </div>
                  <div>
                    <span>Reaction</span>
                    <strong>{activeParticipant.actionState.available.reaction ?? "inf"}</strong>
                  </div>
                </div>
                <div className="dm-inline-controls dm-inline-controls-two-up">
                  <select
                    value={consumeActionType}
                    onChange={(event) => setConsumeActionType(event.target.value as ActionType)}
                  >
                    <option value="standard">standard</option>
                    <option value="bonus">bonus</option>
                    <option value="move">move</option>
                    <option value="reaction">reaction</option>
                  </select>
                  <button type="button" onClick={handleConsumeAction}>
                    Consume Action
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-block-copy">No active participant.</p>
            )}
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Resolve Attack</p>
            <h2>Attack Action</h2>
            <div className="dm-inline-controls">
              <label>
                Action
                <select
                  value={attackActionType}
                  onChange={(event) => setAttackActionType(event.target.value as ActionType)}
                >
                  <option value="standard">standard</option>
                  <option value="bonus">bonus</option>
                  <option value="move">move</option>
                  <option value="reaction">reaction</option>
                </select>
              </label>
              <label>
                Target
                <select
                  value={attackTargetId}
                  onChange={(event) => setAttackTargetId(event.target.value)}
                >
                  <option value="">Select target</option>
                  {combatState.turn.initiativeOrder
                    .filter((participantId) => participantId !== activeParticipantId)
                    .map((participantId) => (
                      <option key={participantId} value={participantId}>
                        {combatState.participants[participantId]?.profile.displayName ?? participantId}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="dm-inline-controls">
              <label>
                Attack Successes
                <input
                  type="number"
                  value={attackSuccesses}
                  onChange={(event) => setAttackSuccesses(Number(event.target.value))}
                />
              </label>
              <label>
                Damage
                <input
                  type="number"
                  value={attackDamage}
                  onChange={(event) => setAttackDamage(Number(event.target.value))}
                />
              </label>
              <label>
                Kind
                <select
                  value={attackKind}
                  onChange={(event) =>
                    setAttackKind(event.target.value as "physical" | "magical")
                  }
                >
                  <option value="physical">physical</option>
                  <option value="magical">magical</option>
                </select>
              </label>
            </div>
            <button type="button" className="flow-primary" onClick={handleAttack}>
              Resolve Attack
            </button>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Power Mechanics</p>
            <h2>Cast Power</h2>
            {activeKnownPowers.length === 0 ? (
              <p className="empty-block-copy">Active participant has no castable powers.</p>
            ) : (
              <>
                <div className="dm-inline-controls">
                  <label>
                    Power
                    <select
                      value={selectedPowerId}
                      onChange={(event) => setSelectedPowerId(event.target.value)}
                    >
                      {activeKnownPowers.map(([powerId, level]) => (
                        <option key={powerId} value={powerId}>
                          {powerId} Lv {level}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Action
                    <select
                      value={powerActionType}
                      onChange={(event) => setPowerActionType(event.target.value as ActionType)}
                    >
                      <option value="standard">standard</option>
                      <option value="bonus">bonus</option>
                      <option value="reaction">reaction</option>
                      <option value="free">free</option>
                    </select>
                  </label>
                </div>
                <div className="dm-inline-controls">
                  <label>
                    Target
                    <select
                      value={powerTargetId}
                      onChange={(event) => setPowerTargetId(event.target.value)}
                    >
                      {combatState.turn.initiativeOrder.map((participantId) => (
                        <option key={participantId} value={participantId}>
                          {combatState.participants[participantId]?.profile.displayName ?? participantId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Physical Stat (BR)
                    <select
                      value={selectedPhysicalStat}
                      onChange={(event) =>
                        setSelectedPhysicalStat(event.target.value as CoreStatId)
                      }
                    >
                      {PHYSICAL_STATS.map((statId) => (
                        <option key={statId} value={statId}>
                          {statId}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button type="button" className="flow-primary" onClick={handleCastPower}>
                  Cast
                </button>
              </>
            )}
          </article>

          <article className="sheet-card dm-log-card">
            <p className="section-kicker">Combat Event Stream</p>
            <h2>Event Log</h2>
            <div className="dm-log-list">
              {[...combatState.events].reverse().map((event) => (
                <div key={event.eventId} className="dm-log-row">
                  <strong>{event.type}</strong>
                  <span>{event.message}</span>
                  <small>
                    Round {event.roundNumber} | {new Date(event.createdAt).toLocaleTimeString()}
                  </small>
                </div>
              ))}
            </div>
          </article>
        </section>

        {dashboardError ? <p className="dm-error">{dashboardError}</p> : null}
      </section>
    </main>
  );
}
