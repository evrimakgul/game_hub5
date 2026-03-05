import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import {
  advanceTurn,
  castPower,
  dispatchAction,
  finalizeCombat,
  startCombat,
  type AttackCommand,
} from "../config/combatRuntime";
import { getRuntimePowerLevel } from "../config/powerRuntime";
import type { AuthorizationMode, CombatState, CombatantProfile } from "../types/combat";
import { POWER_IDS, type ActionType, type CoreStatId, type PowerId } from "../types/game";
import { useAppFlow } from "../state/appFlow";

const PHYSICAL_STATS: CoreStatId[] = ["STR", "DEX", "STAM"];

function getCurrentStatValue(
  stat: { base: number; gearSources: Array<{ value: number }>; buffSources: Array<{ value: number }> }
): number {
  const gear = stat.gearSources.reduce((total, source) => total + source.value, 0);
  const buffs = stat.buffSources.reduce((total, source) => total + source.value, 0);
  return stat.base + gear + buffs;
}

function getCurrentSkillValue(
  skill: { base: number; gearSources: Array<{ value: number }>; buffSources: Array<{ value: number }> }
): number {
  const gear = skill.gearSources.reduce((total, source) => total + source.value, 0);
  const buffs = skill.buffSources.reduce((total, source) => total + source.value, 0);
  return skill.base + gear + buffs;
}

function asPowerId(value: string): PowerId | null {
  if (POWER_IDS.includes(value as PowerId)) {
    return value as PowerId;
  }

  return null;
}

export function DmPage() {
  const navigate = useNavigate();
  const { roleChoice, characters } = useAppFlow();
  const [encounterLabel, setEncounterLabel] = useState("Sandbox Encounter");
  const [authorizationMode, setAuthorizationMode] = useState<AuthorizationMode>("sandbox");
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [npcName, setNpcName] = useState("Pseudo NPC");
  const [npcHp, setNpcHp] = useState(10);
  const [npcMana, setNpcMana] = useState(2);
  const [combatState, setCombatState] = useState<CombatState | null>(null);
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

  useEffect(() => {
    if (selectedCharacterIds.length > 0 || characters.length === 0) {
      return;
    }

    setSelectedCharacterIds(characters.map((character) => character.id));
  }, [characters, selectedCharacterIds.length]);

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

  function mapCharacterToCombatantProfile(
    character: (typeof characters)[number]
  ): CombatantProfile {
    const sheet = character.sheet;
    const displayName = sheet.name.trim() || "Unnamed Character";
    const knownPowers = Object.fromEntries(
      sheet.powers
        .map((power) => {
          const maybePowerId = asPowerId(power.id);
          if (!maybePowerId) {
            return null;
          }

          return [maybePowerId, power.level];
        })
        .filter((entry): entry is [PowerId, number] => entry !== null)
    ) as Partial<Record<PowerId, number>>;

    return {
      participantId: `pc-${character.id}`,
      displayName,
      kind: "character",
      ownerRole: "player",
      characterId: character.id,
      coreStats: {
        STR: getCurrentStatValue(sheet.statState.STR),
        DEX: getCurrentStatValue(sheet.statState.DEX),
        STAM: getCurrentStatValue(sheet.statState.STAM),
        CHA: getCurrentStatValue(sheet.statState.CHA),
        APP: getCurrentStatValue(sheet.statState.APP),
        MAN: getCurrentStatValue(sheet.statState.MAN),
        INT: getCurrentStatValue(sheet.statState.INT),
        WITS: getCurrentStatValue(sheet.statState.WITS),
        PER: getCurrentStatValue(sheet.statState.PER),
      },
      skillLevels: Object.fromEntries(
        sheet.skills.map((skill) => [skill.id, getCurrentSkillValue(skill)])
      ),
      knownPowers,
      currentHp: sheet.currentHp,
      currentMana: sheet.currentMana,
    };
  }

  function buildNpcProfile(): CombatantProfile {
    return {
      participantId: `npc-${Date.now()}`,
      displayName: npcName.trim() || "Pseudo NPC",
      kind: "npc",
      ownerRole: "dm",
      characterId: null,
      coreStats: {
        STR: 3,
        DEX: 3,
        STAM: 3,
        CHA: 2,
        APP: 1,
        MAN: 1,
        INT: 2,
        WITS: 2,
        PER: 2,
      },
      skillLevels: {
        melee: 2,
        ranged: 1,
        athletics: 1,
      },
      knownPowers: {},
      currentHp: Math.max(1, npcHp),
      currentMana: Math.max(0, npcMana),
    };
  }

  function handleStartEncounter(): void {
    try {
      const selectedCharacters = characters.filter((character) =>
        selectedCharacterIds.includes(character.id)
      );
      if (selectedCharacters.length === 0) {
        throw new RangeError("Select at least one player character.");
      }

      const combatants: CombatantProfile[] = [
        ...selectedCharacters.map(mapCharacterToCombatantProfile),
        buildNpcProfile(),
      ];

      const started = startCombat({
        encounterId: `encounter-${Date.now()}`,
        label: encounterLabel.trim() || "Sandbox Encounter",
        authorizationMode,
        combatants,
      });
      setCombatState(started);
      setDashboardError(null);
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Encounter could not be started."
      );
    }
  }

  function updateCombatState(updater: (state: CombatState) => CombatState): void {
    setCombatState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      try {
        const nextState = updater(currentState);
        setDashboardError(null);
        return nextState;
      } catch (error) {
        setDashboardError(
          error instanceof Error ? error.message : "Action could not be resolved."
        );
        return currentState;
      }
    });
  }

  function handleToggleCharacter(characterId: string): void {
    setSelectedCharacterIds((currentIds) =>
      currentIds.includes(characterId)
        ? currentIds.filter((id) => id !== characterId)
        : [...currentIds, characterId]
    );
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

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Combat Dashboard</h1>
          </div>
          <div className="dm-nav-actions">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/role")}>
              Role Menu
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/")}>
              Main Menu
            </button>
          </div>
        </header>

        {!combatState ? (
          <section className="dm-setup-grid">
            <article className="sheet-card">
              <p className="section-kicker">Encounter Setup</p>
              <h2>Create Local Sandbox</h2>
              <label className="dm-field">
                <span>Encounter Label</span>
                <input
                  value={encounterLabel}
                  onChange={(event) => setEncounterLabel(event.target.value)}
                />
              </label>
              <label className="dm-field">
                <span>Authorization Mode</span>
                <select
                  value={authorizationMode}
                  onChange={(event) =>
                    setAuthorizationMode(event.target.value as AuthorizationMode)
                  }
                >
                  <option value="sandbox">sandbox</option>
                  <option value="role_enforced">role_enforced</option>
                </select>
              </label>
            </article>

            <article className="sheet-card">
              <p className="section-kicker">Participants</p>
              <h2>Player Characters</h2>
              <div className="dm-list">
                {characters.length === 0 ? (
                  <p className="empty-block-copy">No player characters created yet.</p>
                ) : (
                  characters.map((character) => (
                    <label key={character.id} className="dm-checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedCharacterIds.includes(character.id)}
                        onChange={() => handleToggleCharacter(character.id)}
                      />
                      <span>{character.sheet.name.trim() || "Unnamed Character"}</span>
                    </label>
                  ))
                )}
              </div>
            </article>

            <article className="sheet-card">
              <p className="section-kicker">Pseudo NPC</p>
              <h2>NPC Combat Profile</h2>
              <label className="dm-field">
                <span>Name</span>
                <input value={npcName} onChange={(event) => setNpcName(event.target.value)} />
              </label>
              <div className="dm-two-up">
                <label className="dm-field">
                  <span>HP</span>
                  <input
                    type="number"
                    value={npcHp}
                    min={1}
                    onChange={(event) => setNpcHp(Number(event.target.value))}
                  />
                </label>
                <label className="dm-field">
                  <span>Mana</span>
                  <input
                    type="number"
                    value={npcMana}
                    min={0}
                    onChange={(event) => setNpcMana(Number(event.target.value))}
                  />
                </label>
              </div>
            </article>

            <div className="dm-setup-action">
              <button type="button" className="flow-primary" onClick={handleStartEncounter}>
                Start Encounter
              </button>
            </div>
          </section>
        ) : (
          <section className="dm-dashboard-grid">
            <article className="sheet-card">
              <p className="section-kicker">Encounter</p>
              <h2>{combatState.label}</h2>
              <p className="dm-summary-line">Mode: {combatState.authorizationMode}</p>
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
                  <div className="dm-inline-controls">
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
        )}

        {dashboardError ? <p className="dm-error">{dashboardError}</p> : null}
      </section>
    </main>
  );
}
