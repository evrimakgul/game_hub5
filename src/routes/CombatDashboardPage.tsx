import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { createCombatEngineState } from "../config/combatReducer";
import type { CombatEngineParticipantInput } from "../types/combatEngine";
import { POWER_IDS, type PowerId } from "../types/game";
import { type CharacterRecord, useAppFlow } from "../state/appFlow";

type CombatRosterEntry =
  | {
      entryId: string;
      kind: "character";
      characterId: string;
    }
  | {
      entryId: string;
      kind: "npc";
      displayName: string;
      hp: number;
      mana: number;
    };

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

function mapCharacterToCombatantInput(character: CharacterRecord): CombatEngineParticipantInput {
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
    participantId: `${character.ownerRole === "player" ? "pc" : "dmchar"}-${character.id}`,
    displayName,
    kind: character.ownerRole === "player" ? "character" : "npc",
    ownerRole: character.ownerRole,
    teamId: character.ownerRole === "player" ? "players" : "enemies",
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
    currentInspiration: sheet.inspiration,
    currentPositiveKarma: sheet.positiveKarma,
    currentNegativeKarma: sheet.negativeKarma,
  };
}

function buildNpcInput(entry: Extract<CombatRosterEntry, { kind: "npc" }>): CombatEngineParticipantInput {
  return {
    participantId: entry.entryId,
    displayName: entry.displayName.trim() || "Unnamed NPC",
    kind: "npc",
    ownerRole: "dm",
    teamId: "enemies",
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
    currentHp: Math.max(1, entry.hp),
    currentMana: Math.max(0, entry.mana),
  };
}

export function CombatDashboardPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    characters,
    activeCombat,
    beginCombatEncounter,
    clearCombatEncounter,
  } = useAppFlow();
  const [encounterLabel, setEncounterLabel] = useState("Combat Encounter");
  const [combatRoster, setCombatRoster] = useState<CombatRosterEntry[]>([]);
  const [npcName, setNpcName] = useState("Pseudo NPC");
  const [npcHp, setNpcHp] = useState(10);
  const [npcMana, setNpcMana] = useState(2);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const playerCharacters = characters.filter((character) => character.ownerRole === "player");
  const dmCharacters = characters.filter((character) => character.ownerRole === "dm");

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function addCharacterToRoster(characterId: string): void {
    setCombatRoster((currentRoster) => {
      if (currentRoster.some((entry) => entry.kind === "character" && entry.characterId === characterId)) {
        return currentRoster;
      }

      return [
        ...currentRoster,
        {
          entryId: `combatant-character-${characterId}`,
          kind: "character",
          characterId,
        },
      ];
    });
  }

  function addNpcToRoster(): void {
    setCombatRoster((currentRoster) => [
      ...currentRoster,
      {
        entryId: `combatant-npc-${Date.now()}-${currentRoster.length + 1}`,
        kind: "npc",
        displayName: npcName.trim() || "Pseudo NPC",
        hp: Math.max(1, npcHp),
        mana: Math.max(0, npcMana),
      },
    ]);
    setNpcName("Pseudo NPC");
    setNpcHp(10);
    setNpcMana(2);
  }

  function removeRosterEntry(entryId: string): void {
    setCombatRoster((currentRoster) =>
      currentRoster.filter((entry) => entry.entryId !== entryId)
    );
  }

  function handleStartEncounter(): void {
    try {
      if (combatRoster.length === 0) {
        throw new RangeError("Add at least one combatant before starting the encounter.");
      }

      const combatants = combatRoster.flatMap((entry) => {
        if (entry.kind === "character") {
          const character = characters.find((candidate) => candidate.id === entry.characterId);
          return character ? [mapCharacterToCombatantInput(character)] : [];
        }

        return [buildNpcInput(entry)];
      });

      if (combatants.length === 0) {
        throw new RangeError("Combatants could not be resolved from the current roster.");
      }

      beginCombatEncounter(
        createCombatEngineState({
          encounterId: `encounter-${Date.now()}`,
          label: encounterLabel.trim() || "Combat Encounter",
          authorizationMode: "role_enforced",
          participants: combatants,
        })
      );
      setDashboardError(null);
      navigate("/dm/combat/encounter");
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Combat encounter could not be started."
      );
    }
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
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/")}>
              Main Menu
            </button>
          </div>
        </header>

        <section className="dm-setup-grid">
          <article className="sheet-card">
            <p className="section-kicker">Player Character Block</p>
            <h2>Player Characters</h2>
            <div className="dm-control-row">
              <button
                type="button"
                className="flow-secondary"
                onClick={() => navigate("/dm/characters")}
              >
                Open Player Character Sheets
              </button>
            </div>
            <div className="dm-list">
              {playerCharacters.length === 0 ? (
                <p className="empty-block-copy">No player characters created yet.</p>
              ) : (
                playerCharacters.map((character) => {
                  const isSelected = combatRoster.some(
                    (entry) => entry.kind === "character" && entry.characterId === character.id
                  );

                  return (
                    <div key={character.id} className="dm-selection-row">
                      <span>{character.sheet.name.trim() || "Unnamed Character"}</span>
                      <button
                        type="button"
                        onClick={() =>
                          isSelected
                            ? removeRosterEntry(`combatant-character-${character.id}`)
                            : addCharacterToRoster(character.id)
                        }
                      >
                        {isSelected ? "Remove" : "Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">NPC Creator Block</p>
            <h2>NPC Creator</h2>
            <p className="dm-summary-line">
              Open the DM character creator or use the quick-add form below for disposable combat
              profiles.
            </p>
            <div className="dm-control-row">
              <button
                type="button"
                className="flow-secondary"
                onClick={() => navigate("/dm/npc-creator")}
              >
                Open NPC Creator
              </button>
            </div>
            <div className="dm-list">
              {dmCharacters.length === 0 ? (
                <p className="empty-block-copy">No DM-created characters saved yet.</p>
              ) : (
                dmCharacters.map((character) => {
                  const isSelected = combatRoster.some(
                    (entry) => entry.kind === "character" && entry.characterId === character.id
                  );

                  return (
                    <div key={character.id} className="dm-selection-row">
                      <span>{character.sheet.name.trim() || "Unnamed Character"}</span>
                      <button
                        type="button"
                        onClick={() =>
                          isSelected
                            ? removeRosterEntry(`combatant-character-${character.id}`)
                            : addCharacterToRoster(character.id)
                        }
                      >
                        {isSelected ? "Remove" : "Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="dm-field">
              <span>Quick Add Non-Player Combatant</span>
              <input value={npcName} onChange={(event) => setNpcName(event.target.value)} />
            </div>
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
            <div className="dm-control-row">
              <button type="button" className="flow-primary" onClick={addNpcToRoster}>
                Add Combatant
              </button>
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Combatant Selection</p>
            <h2>Combatants</h2>
            <label className="dm-field">
              <span>Encounter Label</span>
              <input
                value={encounterLabel}
                onChange={(event) => setEncounterLabel(event.target.value)}
              />
            </label>
            <div className="dm-list">
              {combatRoster.length === 0 ? (
                <p className="empty-block-copy">No combatants added yet.</p>
              ) : (
                combatRoster.map((entry) => (
                  <div key={entry.entryId} className="dm-selection-row">
                    <span>
                      {entry.kind === "character"
                        ? characters.find((character) => character.id === entry.characterId)?.sheet.name.trim() ||
                          "Unnamed Character"
                        : entry.displayName}
                    </span>
                    <button type="button" onClick={() => removeRosterEntry(entry.entryId)}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Combat Encounter</p>
            <h2>Start Combat</h2>
            <p className="dm-summary-line">
              Starting the encounter opens the combat encounter page and activates the combat
              engine UI.
            </p>
            <div className="dm-control-row dm-control-row-wrap">
              <button type="button" className="flow-primary" onClick={handleStartEncounter}>
                Combat Encounter
              </button>
              {activeCombat ? (
                <>
                  <button
                    type="button"
                    className="flow-secondary"
                    onClick={() => navigate("/dm/combat/encounter")}
                  >
                    Resume Current Encounter
                  </button>
                  <button
                    type="button"
                    className="flow-danger"
                    onClick={clearCombatEncounter}
                  >
                    Clear Current Encounter
                  </button>
                </>
              ) : null}
            </div>
          </article>
        </section>

        {dashboardError ? <p className="dm-error">{dashboardError}</p> : null}
      </section>
    </main>
  );
}
