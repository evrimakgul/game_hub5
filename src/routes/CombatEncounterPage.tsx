import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { resolveDicePool } from "../config/combat";
import { buildCharacterEncounterSnapshot } from "../config/combatEncounter";
import {
  applyActivePowerEffect,
  buildActivePowerEffect,
  getCastPowerAllowedStats,
  getCastPowerTargetMode,
  getSupportedCastablePowers,
  removeActivePowerEffect,
  spendPowerMana,
} from "../config/powerEffects";
import type { StatId } from "../config/characterTemplate";
import { type CharacterRecord, useAppFlow } from "../state/appFlow";
import type {
  CharacterEncounterSnapshot,
  CombatEncounterParticipant,
} from "../types/combatEncounter";

const ROLLER_EXCLUDED_SUMMARY_IDS = new Set(["hp", "mana", "ac", "dr", "soak"]);

type RollResult = {
  labels: string[];
  poolSize: number;
  faces: number[];
  successes: number;
  isBotch: boolean;
};

type CustomRollModifier = {
  id: number;
  value: number;
};

type RollTarget = {
  id: string;
  label: string;
  value: number;
  category: "summary" | "stat" | "skill";
};

type EncounterParticipantView = {
  participant: CombatEncounterParticipant;
  character: CharacterRecord | null;
  snapshot: CharacterEncounterSnapshot | null;
};

function formatEncounterTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }

  return date.toLocaleString();
}

function D10Icon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="d10-icon">
      <path
        d="M32 4 52 18 58 40 44 58 20 58 6 40 12 18Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M32 4 52 18 58 40 44 58 20 58 6 40 12 18Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M12 18h40M6 40h52M20 58l12-54 12 54"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
        10
      </text>
    </svg>
  );
}

type CombatantPowerControlsProps = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  updateCharacter: (
    characterId: string,
    updater:
      | CharacterRecord["sheet"]
      | ((current: CharacterRecord["sheet"]) => CharacterRecord["sheet"])
  ) => void;
};

function CombatantPowerControls({
  view,
  encounterParticipants,
  updateCharacter,
}: CombatantPowerControlsProps) {
  const [selectedPowerId, setSelectedPowerId] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [selectedStatId, setSelectedStatId] = useState("");
  const [castError, setCastError] = useState<string | null>(null);
  const character = view.character;
  const castablePowers = character ? getSupportedCastablePowers(character.sheet) : [];
  const selectedPower =
    castablePowers.find((power) => power.id === selectedPowerId) ?? castablePowers[0] ?? null;
  const targetMode = selectedPower ? getCastPowerTargetMode(selectedPower) : "self";
  const allowedStats = selectedPower ? getCastPowerAllowedStats(selectedPower) : [];
  const targetOptions =
    targetMode === "self"
      ? encounterParticipants.filter(
          ({ participant }) => participant.characterId === view.participant.characterId
        )
      : encounterParticipants.filter(({ character: candidateCharacter }) => candidateCharacter !== null);

  useEffect(() => {
    if (castablePowers.length === 0) {
      setSelectedPowerId("");
      return;
    }

    if (!selectedPowerId || !castablePowers.some((power) => power.id === selectedPowerId)) {
      setSelectedPowerId(castablePowers[0].id);
    }
  }, [castablePowers, selectedPowerId]);

  useEffect(() => {
    if (!selectedPower) {
      setSelectedTargetId("");
      setSelectedStatId("");
      return;
    }

    if (targetMode === "self") {
      setSelectedTargetId(view.participant.characterId);
    } else if (
      !selectedTargetId ||
      !targetOptions.some(({ participant }) => participant.characterId === selectedTargetId)
    ) {
      setSelectedTargetId(view.participant.characterId);
    }

    if (allowedStats.length === 0) {
      setSelectedStatId("");
    } else if (!allowedStats.includes(selectedStatId as typeof allowedStats[number])) {
      setSelectedStatId(allowedStats[0]);
    }
  }, [
    allowedStats,
    selectedPower,
    selectedStatId,
    selectedTargetId,
    targetMode,
    targetOptions,
    view.participant.characterId,
  ]);

  if (!character) {
    return null;
  }
  const casterCharacter = character;

  function handleCast(): void {
    if (!selectedPower) {
      setCastError("Select a supported power first.");
      return;
    }

    const targetCharacter =
      encounterParticipants.find(
        ({ participant }) => participant.characterId === selectedTargetId
      )?.character ?? null;

    if (!targetCharacter) {
      setCastError("Select a valid target before casting.");
      return;
    }

    const builtEffect = buildActivePowerEffect({
      casterCharacterId: casterCharacter.id,
      casterName: casterCharacter.sheet.name.trim() || view.participant.displayName,
      targetCharacterId: targetCharacter.id,
      targetName: targetCharacter.sheet.name.trim() || targetCharacter.id,
      power: selectedPower,
      selectedStatId: selectedStatId ? (selectedStatId as StatId) : null,
    });

    if ("error" in builtEffect) {
      setCastError(builtEffect.error);
      return;
    }

    const spentMana = spendPowerMana(casterCharacter.sheet, builtEffect.manaCost);
    if ("error" in spentMana) {
      setCastError(spentMana.error);
      return;
    }

    updateCharacter(casterCharacter.id, spentMana.sheet);
    updateCharacter(targetCharacter.id, (currentSheet) =>
      applyActivePowerEffect(currentSheet, builtEffect.effect)
    );
    setCastError(null);
  }

  return (
    <div className="dm-stack">
      <div>
        <p className="section-kicker">Cast Power Mechanism</p>
        <h3 className="dm-subheading">Active Power Effects</h3>
        {castablePowers.length === 0 ? (
          <p className="dm-summary-line">
            This combatant has no supported castable powers in the first slice.
          </p>
        ) : (
          <>
            <div className="dm-power-form">
              <label className="dm-field">
                <span>Power</span>
                <select
                  value={selectedPower?.id ?? ""}
                  onChange={(event) => setSelectedPowerId(event.target.value)}
                >
                  {castablePowers.map((power) => (
                    <option key={power.id} value={power.id}>
                      {power.name} Lv {power.level}
                    </option>
                  ))}
                </select>
              </label>

              <label className="dm-field">
                <span>Target</span>
                <select
                  value={selectedTargetId}
                  onChange={(event) => setSelectedTargetId(event.target.value)}
                  disabled={targetMode === "self"}
                >
                  {targetOptions.map(({ participant }) => (
                    <option key={participant.characterId} value={participant.characterId}>
                      {participant.displayName}
                    </option>
                  ))}
                </select>
              </label>

              {allowedStats.length > 0 ? (
                <label className="dm-field">
                  <span>Stat</span>
                  <select
                    value={selectedStatId}
                    onChange={(event) => setSelectedStatId(event.target.value)}
                  >
                    {allowedStats.map((statId) => (
                      <option key={statId} value={statId}>
                        {statId}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="dm-control-row">
              <button type="button" className="flow-primary" onClick={handleCast}>
                Cast Selected Power
              </button>
            </div>

            {castError ? <p className="dm-error">{castError}</p> : null}
          </>
        )}
      </div>

      <div>
        <p className="section-kicker">Applied Effects</p>
        {character.sheet.activePowerEffects.length === 0 ? (
          <p className="dm-summary-line">No active power effects on this combatant.</p>
        ) : (
          <div className="dm-effect-list">
            {character.sheet.activePowerEffects.map((effect) => (
              <article key={effect.id} className="dm-effect-card">
                <div>
                  <strong>{effect.label}</strong>
                  <small>{effect.summary}</small>
                  <small>
                    {effect.casterName} {"->"} {effect.powerName}
                  </small>
                </div>
                <button
                  type="button"
                  className="flow-secondary"
                  onClick={() =>
                    updateCharacter(character.id, (currentSheet) =>
                      removeActivePowerEffect(currentSheet, effect.id)
                    )
                  }
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CombatEncounterPage() {
  const navigate = useNavigate();
  const { roleChoice, activeCombatEncounter, characters, updateCharacter } = useAppFlow();
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [dicePosition, setDicePosition] = useState({ x: 24, y: 24 });
  const [selectedCombatantId, setSelectedCombatantId] = useState("");
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [customRollInput, setCustomRollInput] = useState("");
  const [customRollModifiers, setCustomRollModifiers] = useState<CustomRollModifier[]>([]);
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const dragRef = useRef<{ active: boolean; moved: boolean; offsetX: number; offsetY: number }>({
    active: false,
    moved: false,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    function handleMouseMove(event: globalThis.MouseEvent): void {
      if (!dragRef.current.active) {
        return;
      }

      dragRef.current.moved = true;
      setDicePosition({
        x: Math.max(24, window.innerWidth - event.clientX - dragRef.current.offsetX),
        y: Math.max(24, window.innerHeight - event.clientY - dragRef.current.offsetY),
      });
    }

    function handleMouseUp(): void {
      dragRef.current.active = false;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function openCharacterSheet(characterId: string, ownerRole: "player" | "dm"): void {
    const routePath = ownerRole === "dm" ? "/dm/npc-character" : "/dm/character";
    const popupUrl = `${routePath}?characterId=${encodeURIComponent(characterId)}`;

    window.open(
      popupUrl,
      "_blank",
      "popup=yes,width=1380,height=920,noopener,noreferrer"
    );
  }

  const encounterParticipants = activeCombatEncounter
    ? activeCombatEncounter.participants.map((participant) => {
        const character = characters.find((entry) => entry.id === participant.characterId) ?? null;
        const snapshot = character ? buildCharacterEncounterSnapshot(character.sheet) : null;

        return {
          participant,
          character,
          snapshot,
        };
      })
    : [];

  const selectedCombatant =
    encounterParticipants.find(({ participant }) => participant.characterId === selectedCombatantId) ??
    encounterParticipants[0] ??
    null;
  const selectedSnapshot = selectedCombatant?.snapshot ?? null;
  const rollTargets: RollTarget[] = selectedSnapshot
    ? [
        ...selectedSnapshot.combatSummary
          .filter(
            (field) =>
              !ROLLER_EXCLUDED_SUMMARY_IDS.has(field.id) && field.selectableValue !== null
          )
          .map((field) => ({
            id: `summary:${field.id}`,
            label: field.label,
            value: field.selectableValue ?? 0,
            category: "summary" as const,
          })),
        ...selectedSnapshot.stats.map((field) => ({
          id: `stat:${field.id}`,
          label: field.label,
          value: Number(field.value),
          category: "stat" as const,
        })),
        ...selectedSnapshot.highlightedSkills.map((field) => ({
          id: `skill:${field.id}`,
          label: field.label,
          value: Number(field.value),
          category: "skill" as const,
        })),
      ]
    : [];
  const summaryRollTargets = rollTargets.filter((target) => target.category === "summary");
  const statRollTargets = rollTargets.filter((target) => target.category === "stat");
  const skillRollTargets = rollTargets.filter((target) => target.category === "skill");
  const selectedRollTargets = selectedRollIds
    .map((targetId) => rollTargets.find((target) => target.id === targetId))
    .filter((target): target is RollTarget => target !== undefined);
  const customRollPool = customRollModifiers.reduce((total, modifier) => total + modifier.value, 0);
  const selectedRollPool =
    selectedRollTargets.reduce((total, target) => total + target.value, 0) + customRollPool;

  useEffect(() => {
    if (encounterParticipants.length === 0) {
      setSelectedCombatantId("");
      return;
    }

    if (
      !selectedCombatantId ||
      !encounterParticipants.some(
        ({ participant }) => participant.characterId === selectedCombatantId
      )
    ) {
      setSelectedCombatantId(encounterParticipants[0].participant.characterId);
    }
  }, [encounterParticipants, selectedCombatantId]);

  useEffect(() => {
    setSelectedRollIds([]);
    setCustomRollModifiers([]);
    setCustomRollInput("");
    setLastRoll(null);
  }, [selectedCombatantId]);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  if (!activeCombatEncounter) {
    return <Navigate to="/dm/combat" replace />;
  }

  function handleDiceMouseDown(event: React.MouseEvent<HTMLButtonElement>): void {
    dragRef.current.active = true;
    dragRef.current.moved = false;
    dragRef.current.offsetX = window.innerWidth - event.clientX - dicePosition.x;
    dragRef.current.offsetY = window.innerHeight - event.clientY - dicePosition.y;
  }

  function handleDiceClick(): void {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }

    setIsDiceOpen((open) => !open);
  }

  function toggleRollTarget(targetId: string): void {
    setSelectedRollIds((currentIds) => {
      if (currentIds.includes(targetId)) {
        return currentIds.filter((entryId) => entryId !== targetId);
      }

      if (currentIds.length >= 9) {
        return currentIds;
      }

      return [...currentIds, targetId];
    });
  }

  function handleAddCustomRollModifier(): void {
    const value = Number.parseInt(customRollInput.trim(), 10);
    if (!Number.isFinite(value) || value === 0) {
      return;
    }

    setCustomRollModifiers((currentModifiers) => [
      ...currentModifiers,
      {
        id: currentModifiers.length + 1,
        value,
      },
    ]);
    setCustomRollInput("");
  }

  function removeCustomRollModifier(modifierId: number): void {
    setCustomRollModifiers((currentModifiers) =>
      currentModifiers.filter((modifier) => modifier.id !== modifierId)
    );
  }

  function handleRoll(): void {
    if (selectedRollTargets.length === 0 && customRollModifiers.length === 0) {
      return;
    }

    const faces = Array.from({ length: selectedRollPool }, () => Math.floor(Math.random() * 10) + 1);
    const resolution = resolveDicePool(faces, selectedRollPool);

    setLastRoll({
      labels: [
        ...selectedRollTargets.map((target) => target.label),
        ...customRollModifiers.map(
          (modifier) => `Custom ${modifier.value >= 0 ? "+" : ""}${modifier.value}`
        ),
      ],
      poolSize: selectedRollPool,
      faces,
      successes: resolution.successes,
      isBotch: resolution.isBotch,
    });
  }

  return (
    <main className="dm-page">
      <button
        type="button"
        className="floating-dice"
        style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y}px` }}
        onMouseDown={handleDiceMouseDown}
        onClick={handleDiceClick}
        aria-label="Open dice roller"
      >
        <D10Icon />
        <span className="sr-only">Open dice roller</span>
      </button>

      {isDiceOpen ? (
        <aside
          className="dice-popover"
          style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y + 72}px` }}
        >
          <div className="dice-popover-head">
            <D10Icon />
            <p className="section-kicker">10 Roll Helper</p>
          </div>
          <h2>Dice Roller</h2>

          <label className="dm-field dice-popover-field">
            <span>Combatant</span>
            <select
              value={selectedCombatant?.participant.characterId ?? ""}
              onChange={(event) => setSelectedCombatantId(event.target.value)}
            >
              {encounterParticipants.map(({ participant }, index) => (
                <option key={participant.characterId} value={participant.characterId}>
                  {index + 1}. {participant.displayName}
                </option>
              ))}
            </select>
          </label>

          {selectedCombatant && selectedSnapshot ? (
            <>
              <div className="dice-summary">
                <span>Initiative</span>
                <strong>
                  Pool {selectedCombatant.participant.initiativePool} | Roll{" "}
                  {selectedCombatant.participant.initiativeFaces.join(", ")} | Successes{" "}
                  {selectedCombatant.participant.initiativeSuccesses}
                </strong>
              </div>

              <div className="dm-summary-mini-grid dice-summary-grid">
                {selectedSnapshot.combatSummary
                  .filter((field) => !ROLLER_EXCLUDED_SUMMARY_IDS.has(field.id))
                  .map((field) => (
                    <div key={field.id}>
                      <span>{field.label}</span>
                      <strong>{field.value}</strong>
                    </div>
                  ))}
                <div>
                  <span>Inspiration</span>
                  <strong>{selectedSnapshot.inspiration}</strong>
                </div>
              </div>

              <div className="dice-summary">
                <span>Selected</span>
                <strong>
                  {selectedRollTargets.length > 0 || customRollModifiers.length > 0
                    ? [
                        ...selectedRollTargets.map((target) => target.label),
                        ...customRollModifiers.map(
                          (modifier) =>
                            `Custom ${modifier.value >= 0 ? "+" : ""}${modifier.value}`
                        ),
                      ].join(" + ")
                    : "None"}
                </strong>
              </div>
              <div className="dice-summary">
                <span>Pool</span>
                <strong>{selectedRollPool}</strong>
              </div>

              <section className="dice-summary-section">
                <h3>Combat Summary</h3>
                <div className="dice-summary-targets">
                  {summaryRollTargets.map((target) => {
                    const isSelected = selectedRollIds.includes(target.id);
                    const wouldExceedLimit = !isSelected && selectedRollIds.length >= 9;

                    return (
                      <button
                        key={target.id}
                        type="button"
                        className={`dice-target${isSelected ? " is-selected" : ""}`}
                        onClick={() => toggleRollTarget(target.id)}
                        disabled={wouldExceedLimit}
                      >
                        <span>{target.label}</span>
                        <strong>{target.value}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="dice-columns">
                <section className="dice-column">
                  <h3>Stats</h3>
                  <div className="dice-targets">
                    {statRollTargets.map((target) => {
                      const isSelected = selectedRollIds.includes(target.id);
                      const wouldExceedLimit = !isSelected && selectedRollIds.length >= 9;

                      return (
                        <button
                          key={target.id}
                          type="button"
                          className={`dice-target${isSelected ? " is-selected" : ""}`}
                          onClick={() => toggleRollTarget(target.id)}
                          disabled={wouldExceedLimit}
                        >
                          <span>{target.label}</span>
                          <strong>{target.value}</strong>
                        </button>
                      );
                    })}
                  </div>

                  <div className="dice-custom-add">
                    <span>Add</span>
                    <div className="dice-custom-row">
                      <input
                        type="number"
                        value={customRollInput}
                        onChange={(event) => setCustomRollInput(event.target.value)}
                        placeholder="+/-"
                      />
                      <button type="button" onClick={handleAddCustomRollModifier}>
                        Add
                      </button>
                    </div>
                    {customRollModifiers.length > 0 ? (
                      <div className="dice-custom-list">
                        {customRollModifiers.map((modifier) => (
                          <button
                            key={modifier.id}
                            type="button"
                            className="dice-custom-chip"
                            onClick={() => removeCustomRollModifier(modifier.id)}
                          >
                            {modifier.value >= 0 ? "+" : ""}
                            {modifier.value}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="dice-column">
                  <h3>Skills</h3>
                  <div className="dice-targets">
                    {skillRollTargets.map((target) => {
                      const isSelected = selectedRollIds.includes(target.id);
                      const wouldExceedLimit = !isSelected && selectedRollIds.length >= 9;

                      return (
                        <button
                          key={target.id}
                          type="button"
                          className={`dice-target${isSelected ? " is-selected" : ""}`}
                          onClick={() => toggleRollTarget(target.id)}
                          disabled={wouldExceedLimit}
                        >
                          <span>{target.label}</span>
                          <strong>{target.value}</strong>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="dice-actions">
                <button
                  type="button"
                  onClick={handleRoll}
                  disabled={
                    selectedRollTargets.length === 0 && customRollModifiers.length === 0
                  }
                >
                  Roll
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRollIds([]);
                    setCustomRollModifiers([]);
                    setCustomRollInput("");
                    setLastRoll(null);
                  }}
                >
                  Clear
                </button>
              </div>

              {lastRoll ? (
                <div className="roll-result">
                  <span>Last Roll</span>
                  <strong>
                    {lastRoll.successes} successes{lastRoll.isBotch ? " (botch)" : ""}
                  </strong>
                  <small>{lastRoll.labels.join(" + ")}</small>
                  <small>{lastRoll.faces.join(", ")}</small>
                </div>
              ) : null}
            </>
          ) : (
            <p className="dm-summary-line">
              This combatant no longer resolves to a saved character sheet.
            </p>
          )}
        </aside>
      ) : null}

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

        <section className="dm-encounter-layout">
          <article className="sheet-card">
            <p className="section-kicker">Combat Encounter</p>
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
                <span>Combat Encounter Id</span>
                <strong>{activeCombatEncounter.encounterId}</strong>
              </div>
            </div>
          </article>

          <article className="sheet-card dm-log-card">
            <p className="section-kicker">Combatants Block</p>
            <h2>Initiative Order</h2>
            <div className="dm-accordion-list">
              {encounterParticipants.map((view, index) => {
                const { participant, snapshot } = view;

                return (
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

                        <CombatantPowerControls
                          view={view}
                          encounterParticipants={encounterParticipants}
                          updateCharacter={updateCharacter}
                        />

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
                            <div className="dm-detail-grid dm-detail-grid-compact">
                              {snapshot.stats.map((field) => (
                                <article key={field.id} className="dm-detail-card dm-detail-card-compact">
                                  <span>{field.label}</span>
                                  <strong>{field.value}</strong>
                                  <small className="dm-detail-summary">{field.summary}</small>
                                  <small className="dm-detail-detail">{field.detail}</small>
                                </article>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="section-kicker">Highlighted Skills</p>
                            <div className="dm-detail-grid-small dm-detail-grid-compact">
                              {snapshot.highlightedSkills.map((field) => (
                                <article key={field.id} className="dm-detail-card dm-detail-card-compact">
                                  <span>{field.label}</span>
                                  <strong>{field.value}</strong>
                                  <small className="dm-detail-summary">{field.summary}</small>
                                  <small className="dm-detail-detail">{field.detail}</small>
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
                );
              })}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
