import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { resolveDicePool } from "../config/combat";
import {
  DAMAGE_TYPES,
  RESISTANCE_LEVELS,
} from "../config/resistances";
import {
  getPowerBenefits,
  getPowerTemplate,
  powerLibrary,
  statGroups,
  type CharacterDraft,
  type SkillEntry,
  type StatEntry,
  type StatId,
  type StatSource,
} from "../config/characterTemplate";
import {
  calculateArmorClass,
  calculateInitiative,
  calculateMaxHP,
  calculateOccultManaBonus,
  calculateRangedBonusDice,
} from "../config/stats";
import {
  getCrAndRankFromXpUsed,
  STAT_XP_BY_LEVEL,
  T1_POWER_XP_BY_LEVEL,
  T1_SKILL_XP_BY_LEVEL,
} from "../config/xpTables";
import { useAppFlow } from "../state/appFlow";

type HistoryEntry = {
  id: number;
  actualDateTime: string;
  gameDateTime: string;
  note: string;
};

type RollTarget = {
  id: string;
  label: string;
  value: number;
  category: "stat" | "skill";
};

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

function getCurrentStatValue(statState: Record<StatId, StatEntry>, statId: StatId): number {
  const stat = statState[statId];
  const gearTotal = stat.gearSources.reduce((total, source) => total + source.value, 0);
  const buffTotal = stat.buffSources.reduce((total, source) => total + source.value, 0);
  return stat.base + gearTotal + buffTotal;
}

function getCurrentSkillValue(skills: SkillEntry[], skillId: string): number {
  const skill = skills.find((entry) => entry.id === skillId);
  if (!skill) {
    return 0;
  }

  const gearTotal = skill.gearSources.reduce((total, source) => total + source.value, 0);
  const buffTotal = skill.buffSources.reduce((total, source) => total + source.value, 0);
  return skill.base + gearTotal + buffTotal;
}

function getSummary(base: number, gearSources: StatSource[], buffSources: StatSource[]): string {
  const gearTotal = gearSources.reduce((total, source) => total + source.value, 0);
  const buffTotal = buffSources.reduce((total, source) => total + source.value, 0);
  return `Base ${base} + Gears ${gearTotal} + Buffs ${buffTotal}`;
}

function getDetail(gearSources: StatSource[], buffSources: StatSource[]): string {
  const gearText =
    gearSources.length > 0
      ? gearSources.map((source) => `${source.label} ${source.value >= 0 ? "+" : ""}${source.value}`).join(", ")
      : "none";
  const buffText =
    buffSources.length > 0
      ? buffSources.map((source) => `${source.label} ${source.value >= 0 ? "+" : ""}${source.value}`).join(", ")
      : "none";

  return `Gear: ${gearText} | Buffs: ${buffText}`;
}

function formatDateDayMonthYear(date: Date): string {
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatTimeHoursMinutes(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getIncrementCost(table: number[], currentLevel: number): number {
  if (currentLevel >= table.length - 1) {
    return 0;
  }

  return table[currentLevel + 1] - table[currentLevel];
}

function getDecrementRefund(table: number[], currentLevel: number): number {
  if (currentLevel <= 0) {
    return 0;
  }

  return table[currentLevel] - table[currentLevel - 1];
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
      <path d="M12 18h40M6 40h52M20 58l12-54 12 54" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
        10
      </text>
    </svg>
  );
}

export function PlayerCharacterPage() {
  const { activePlayerCharacter, activeDmCharacter, updateCharacter } = useAppFlow();
  const navigate = useNavigate();
  const location = useLocation();
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSessionStatFloor, setEditSessionStatFloor] = useState<Record<StatId, number> | null>(
    null
  );
  const [pendingPowerId, setPendingPowerId] = useState("");
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [dicePosition, setDicePosition] = useState({ x: 24, y: 24 });
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [customRollInput, setCustomRollInput] = useState("");
  const [customRollModifiers, setCustomRollModifiers] = useState<CustomRollModifier[]>([]);
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");

  const dragRef = useRef<{ active: boolean; moved: boolean; offsetX: number; offsetY: number }>({
    active: false,
    moved: false,
    offsetX: 0,
    offsetY: 0,
  });
  const isDmReadOnlyView = location.pathname.startsWith("/dm/character");
  const isDmEditableView = location.pathname.startsWith("/dm/npc-character");
  const isReadOnlyView = isDmReadOnlyView;
  const activeCharacter = isDmEditableView ? activeDmCharacter : activePlayerCharacter;

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

  const activeSheet = activeCharacter?.sheet ?? null;

  function setSheetState(
    updater: CharacterDraft | ((current: CharacterDraft) => CharacterDraft)
  ): void {
    if (isReadOnlyView || !activeCharacter) {
      return;
    }

    updateCharacter(activeCharacter.id, updater);
  }

  useEffect(() => {
    if (!activeSheet || !activeCharacter) {
      return;
    }

    setSessionNotes(activeSheet.effects.join("\n"));
    setHistoryEntries([]);
    setIsEditMode(false);
    setEditSessionStatFloor(null);
  }, [activeCharacter?.id, activeSheet?.effects]);

  if (!activeCharacter || !activeSheet) {
    return (
      <Navigate
        to={isDmEditableView ? "/dm/npc-creator" : isDmReadOnlyView ? "/dm/characters" : "/player"}
        replace
      />
    );
  }

  const sheetState = activeSheet;

  const actualDate = formatDateDayMonthYear(new Date());
  const xpLeftOver = sheetState.xpEarned - sheetState.xpUsed;
  const progression = getCrAndRankFromXpUsed(sheetState.xpUsed);

  const currentStats = {
    STR: getCurrentStatValue(sheetState.statState, "STR"),
    DEX: getCurrentStatValue(sheetState.statState, "DEX"),
    STAM: getCurrentStatValue(sheetState.statState, "STAM"),
    CHA: getCurrentStatValue(sheetState.statState, "CHA"),
    APP: getCurrentStatValue(sheetState.statState, "APP"),
    MAN: getCurrentStatValue(sheetState.statState, "MAN"),
    INT: getCurrentStatValue(sheetState.statState, "INT"),
    WITS: getCurrentStatValue(sheetState.statState, "WITS"),
    PER: getCurrentStatValue(sheetState.statState, "PER"),
  };

  const occultManaBonus = calculateOccultManaBonus(
    getCurrentSkillValue(sheetState.skills, "occultism"),
    sheetState.xpUsed
  );

  const derived = {
    maxHp: calculateMaxHP(currentStats.STAM),
    maxMana: sheetState.currentMana + occultManaBonus,
    initiative: calculateInitiative(currentStats.DEX, currentStats.WITS),
    armorClass: calculateArmorClass(currentStats.DEX, getCurrentSkillValue(sheetState.skills, "athletics"), 0),
    damageReduction: 0,
    soak: currentStats.STAM,
    meleeAttack: getCurrentSkillValue(sheetState.skills, "melee") + currentStats.DEX,
    rangedAttack:
      getCurrentSkillValue(sheetState.skills, "ranged") + currentStats.DEX + calculateRangedBonusDice(currentStats.PER),
    meleeDamage: currentStats.STR,
    rangedDamage: "-",
  };

  const rollTargets: RollTarget[] = [
    ...statGroups.flatMap((group) =>
      group.ids.map((statId) => ({
        id: `stat:${statId}`,
        label: statId,
        value: currentStats[statId],
        category: "stat" as const,
      }))
    ),
    ...sheetState.skills.map((skill) => ({
      id: `skill:${skill.id}`,
      label: skill.label,
      value: getCurrentSkillValue(sheetState.skills, skill.id),
      category: "skill" as const,
    })),
  ];

  const statRollTargets = rollTargets.filter((target) => target.category === "stat");
  const skillRollTargets = rollTargets.filter((target) => target.category === "skill");

  const selectedRollTargets = selectedRollIds
    .map((targetId) => rollTargets.find((target) => target.id === targetId))
    .filter((target): target is RollTarget => target !== undefined);
  const customRollPool = customRollModifiers.reduce((total, modifier) => total + modifier.value, 0);
  const selectedRollPool = selectedRollTargets.reduce((total, target) => total + target.value, 0) + customRollPool;

  const availablePowerOptions = powerLibrary.filter(
    (power) => !sheetState.powers.some((knownPower) => knownPower.id === power.id)
  );

  function handleAppendHistory(): void {
    const note = sessionNotes.trim();
    if (!note) {
      return;
    }

    const now = new Date();

    setHistoryEntries((entries) => [
      {
        id: entries.length + 1,
        actualDateTime: `${formatDateDayMonthYear(now)} - ${formatTimeHoursMinutes(now)}`,
        gameDateTime: sheetState.gameDateTime,
        note,
      },
      ...entries,
    ]);
    setSessionNotes("");
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
        ...customRollModifiers.map((modifier) => `Custom ${modifier.value >= 0 ? "+" : ""}${modifier.value}`),
      ],
      poolSize: selectedRollPool,
      faces,
      successes: resolution.successes,
      isBotch: resolution.isBotch,
    });
  }

  function adjustStat(statId: StatId, direction: 1 | -1): void {
    const currentLevel = sheetState.statState[statId].base;
    const floorLevel = editSessionStatFloor?.[statId] ?? currentLevel;
    const nextLevel = currentLevel + direction;
    if (nextLevel < floorLevel || nextLevel >= STAT_XP_BY_LEVEL.length) {
      return;
    }

    const xpDelta =
      direction === 1 ? getIncrementCost(STAT_XP_BY_LEVEL, currentLevel) : -getDecrementRefund(STAT_XP_BY_LEVEL, currentLevel);
    if (direction === 1 && xpLeftOver < xpDelta) {
      return;
    }

    setSheetState((currentSheet) => ({
      ...currentSheet,
      xpUsed: currentSheet.xpUsed + xpDelta,
      statState: {
        ...currentSheet.statState,
        [statId]: {
          ...currentSheet.statState[statId],
          base: nextLevel,
        },
      },
    }));
  }

  function adjustSkill(skillId: string, direction: 1 | -1): void {
    const currentSkill = sheetState.skills.find((skill) => skill.id === skillId);
    if (!currentSkill) {
      return;
    }

    const nextLevel = currentSkill.base + direction;
    if (nextLevel < 0 || nextLevel >= T1_SKILL_XP_BY_LEVEL.length) {
      return;
    }

    const xpDelta =
      direction === 1
        ? getIncrementCost(T1_SKILL_XP_BY_LEVEL, currentSkill.base)
        : -getDecrementRefund(T1_SKILL_XP_BY_LEVEL, currentSkill.base);
    if (direction === 1 && xpLeftOver < xpDelta) {
      return;
    }

    setSheetState((currentSheet) => ({
      ...currentSheet,
      xpUsed: currentSheet.xpUsed + xpDelta,
      skills: currentSheet.skills.map((skill) =>
        skill.id === skillId
          ? {
              ...skill,
              base: nextLevel,
            }
          : skill
      ),
    }));
  }

  function adjustPower(powerId: string, direction: 1 | -1): void {
    const currentPower = sheetState.powers.find((power) => power.id === powerId);
    if (!currentPower) {
      return;
    }

    const nextLevel = currentPower.level + direction;
    if (nextLevel < 0 || nextLevel >= T1_POWER_XP_BY_LEVEL.length) {
      return;
    }

    const xpDelta =
      direction === 1
        ? getIncrementCost(T1_POWER_XP_BY_LEVEL, currentPower.level)
        : -getDecrementRefund(T1_POWER_XP_BY_LEVEL, currentPower.level);
    if (direction === 1 && xpLeftOver < xpDelta) {
      return;
    }

    setSheetState((currentSheet) => ({
      ...currentSheet,
      xpUsed: currentSheet.xpUsed + xpDelta,
      powers:
        nextLevel === 0
          ? currentSheet.powers.filter((power) => power.id !== powerId)
          : currentSheet.powers.map((power) =>
              power.id === powerId
                ? {
                    ...power,
                    level: nextLevel,
                  }
                : power
            ),
    }));
  }

  function handleAddPower(): void {
    if (!pendingPowerId) {
      return;
    }

    const template = getPowerTemplate(pendingPowerId);
    const levelOneCost = getIncrementCost(T1_POWER_XP_BY_LEVEL, 0);
    if (!template || xpLeftOver < levelOneCost) {
      return;
    }

    setSheetState((currentSheet) => ({
      ...currentSheet,
      xpUsed: currentSheet.xpUsed + levelOneCost,
      powers: [
        ...currentSheet.powers,
        {
          id: template.id,
          name: template.name,
          level: 1,
          governingStat: template.governingStat,
        },
      ],
    }));
    setPendingPowerId("");
  }

  function updateSheetField<K extends keyof CharacterDraft>(
    field: K,
    value: CharacterDraft[K]
  ): void {
    setSheetState((currentSheet) => ({
      ...currentSheet,
      [field]: value,
    }));
  }

  function handleToggleEditMode(): void {
    if (isReadOnlyView) {
      return;
    }

    if (isEditMode) {
      setIsEditMode(false);
      setEditSessionStatFloor(null);
      return;
    }

    setEditSessionStatFloor({
      STR: sheetState.statState.STR.base,
      DEX: sheetState.statState.DEX.base,
      STAM: sheetState.statState.STAM.base,
      CHA: sheetState.statState.CHA.base,
      APP: sheetState.statState.APP.base,
      MAN: sheetState.statState.MAN.base,
      INT: sheetState.statState.INT.base,
      WITS: sheetState.statState.WITS.base,
      PER: sheetState.statState.PER.base,
    });
    setIsEditMode(true);
  }

  return (
    <main className="sheet-page">
      <button
        type="button"
        className="floating-dice"
        style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y}px` }}
        onMouseDown={handleDiceMouseDown}
        onClick={handleDiceClick}
        aria-label="Open roll helper"
      >
        <D10Icon />
        <span className="sr-only">Open roll helper</span>
      </button>

      {isDiceOpen ? (
        <aside
          className="dice-popover"
          style={{ right: `${dicePosition.x}px`, bottom: `${dicePosition.y + 72}px` }}
        >
          <div className="dice-popover-head">
            <D10Icon />
            <p className="section-kicker">Roll Helper</p>
          </div>
          <h2>Dice Pool</h2>
          <div className="dice-summary">
            <span>Selected</span>
            <strong>
              {selectedRollTargets.length > 0 || customRollModifiers.length > 0
                ? [
                    ...selectedRollTargets.map((target) => target.label),
                    ...customRollModifiers.map((modifier) => `Custom ${modifier.value >= 0 ? "+" : ""}${modifier.value}`),
                  ].join(" + ")
                : "None"}
            </strong>
          </div>
          <div className="dice-summary">
            <span>Pool</span>
            <strong>{selectedRollPool}</strong>
          </div>
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
                    inputMode="numeric"
                    value={customRollInput}
                    onChange={(event) => setCustomRollInput(event.target.value)}
                    placeholder="+2"
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
            <button type="button" onClick={handleRoll} disabled={selectedRollTargets.length === 0 && customRollModifiers.length === 0}>
              Roll
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedRollIds([]);
                setCustomRollModifiers([]);
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
        </aside>
      ) : null}

      <section className="sheet-frame">
        <div className="sheet-top-nav">
          <button type="button" className="sheet-nav-button" onClick={() => navigate("/")}>
            Main Menu
          </button>
          <button
            type="button"
            className="sheet-nav-button"
            onClick={() =>
              navigate(
                isDmEditableView
                  ? "/dm/npc-creator"
                  : isDmReadOnlyView
                    ? "/dm/characters"
                    : "/player"
              )
            }
          >
            {isDmEditableView
              ? "NPC Creator"
              : isDmReadOnlyView
                ? "Player Characters"
                : "Player Menu"}
          </button>
        </div>

        <header className="sheet-header">
          <div className="sheet-header-copy">
            <p className="sheet-kicker">Convergence Character Sheet Draft</p>
            {isEditMode ? (
              <div className="identity-edit-stack">
                <input
                  className="sheet-name-input"
                  value={sheetState.name}
                  onChange={(event) => updateSheetField("name", event.target.value)}
                  placeholder="Character Name"
                />
                <div className="identity-edit-row">
                  <input
                    className="sheet-meta-input"
                    value={sheetState.concept}
                    onChange={(event) => updateSheetField("concept", event.target.value)}
                    placeholder="Concept"
                  />
                  <input
                    className="sheet-meta-input"
                    value={sheetState.faction}
                    onChange={(event) => updateSheetField("faction", event.target.value)}
                    placeholder="Faction"
                  />
                </div>
              </div>
            ) : (
              <>
                <h1>{sheetState.name.trim() || "Unnamed Character"}</h1>
                <p className="sheet-concept">
                  {sheetState.concept || "No concept"} | {sheetState.faction || "No faction"}
                </p>
              </>
            )}
          </div>

          <div className="sheet-badges">
            <div>
              <span>Rank</span>
              <strong>{progression.rank}</strong>
            </div>
            <div>
              <span>CR</span>
              <strong>{progression.cr}</strong>
            </div>
            <div>
              <span>Age</span>
              {isEditMode ? (
                <input
                  className="badge-input"
                  type="number"
                  min="0"
                  value={sheetState.age ?? ""}
                  onChange={(event) =>
                    updateSheetField(
                      "age",
                      event.target.value === "" ? null : Number.parseInt(event.target.value, 10)
                    )
                  }
                  placeholder="Age"
                />
              ) : (
                <strong>{sheetState.age ?? "-"}</strong>
              )}
            </div>
          </div>
        </header>

        <section className="sheet-banner">
          <div className="banner-date-block">
            <div>
              <span>Actual Date</span>
              <strong>{actualDate}</strong>
            </div>
            <div>
              <span>Game Date-Time</span>
              <strong>{sheetState.gameDateTime}</strong>
            </div>
          </div>
          <div>
            <span>XP Block</span>
            <div className="xp-block-grid">
              <span>Earned</span>
              <span>Used</span>
              <span>Left-Over</span>
              <strong>{sheetState.xpEarned}</strong>
              <strong>{sheetState.xpUsed}</strong>
              <strong>{xpLeftOver}</strong>
            </div>
          </div>
          <div className="edit-card">
            <span>Edit Sheet</span>
            {isReadOnlyView ? (
              <strong className="edit-mode-indicator">DM View</strong>
            ) : (
              <button type="button" className="edit-trigger" onClick={handleToggleEditMode}>
                {isEditMode ? "Lock" : "Edit"}
              </button>
            )}
          </div>
        </section>

        <section className="sheet-grid">
          <article className="sheet-card biography-card">
            <p className="section-kicker">Identity</p>
            <h2>Biography</h2>
            {isEditMode ? (
              <div className="bio-edit-stack">
                <textarea
                  className="bio-edit-input"
                  value={sheetState.biographyPrimary}
                  onChange={(event) => updateSheetField("biographyPrimary", event.target.value)}
                  placeholder="Primary bio"
                />
                <textarea
                  className="bio-edit-input"
                  value={sheetState.biographySecondary}
                  onChange={(event) => updateSheetField("biographySecondary", event.target.value)}
                  placeholder="Secondary bio"
                />
              </div>
            ) : (
              <>
                <p>{sheetState.biographyPrimary || "No primary biography yet."}</p>
                <p>{sheetState.biographySecondary || "No secondary biography yet."}</p>
              </>
            )}
          </article>

          <article className="sheet-card resource-card">
            <p className="section-kicker">Stored State</p>
            <h2>Resources</h2>
            <div className="resource-strip">
              <div>
                <span>Inspiration</span>
                <strong>{sheetState.inspiration}</strong>
              </div>
              <div>
                <span>Karma</span>
                <strong>
                  -{sheetState.negativeKarma} / +{sheetState.positiveKarma}
                </strong>
              </div>
            </div>
          </article>

          <article className="sheet-card status-card">
            <p className="section-kicker">Combat Flags</p>
            <h2>Resistances</h2>
            <div className="resistance-grid">
              {DAMAGE_TYPES.map((damageType) => {
                const level = sheetState.resistances[damageType.id];
                const rule = RESISTANCE_LEVELS[level];

                return (
                  <div key={damageType.id} className="resistance-entry">
                    <span>{damageType.label}</span>
                    <strong>{rule.label}</strong>
                    <small>(x{rule.damageMultiplier})</small>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="sheet-card combat-card">
            <p className="section-kicker">Derived Summary</p>
            <h2>Combat Summary</h2>
            <div className="combat-grid">
              <div>
                <span>HP</span>
                <strong>
                  {sheetState.currentHp} / {derived.maxHp}
                </strong>
              </div>
              <div>
                <span>Mana</span>
                <strong>
                  {sheetState.currentMana} / {derived.maxMana}
                </strong>
              </div>
              <div>
                <span>Initiative</span>
                <strong>{derived.initiative}</strong>
              </div>
              <div>
                <span>AC</span>
                <strong>{derived.armorClass}</strong>
              </div>
              <div>
                <span>DR</span>
                <strong>{derived.damageReduction}</strong>
              </div>
              <div>
                <span>Soak</span>
                <strong>{derived.soak}</strong>
              </div>
              <div>
                <span>Melee Attack</span>
                <strong>{derived.meleeAttack}</strong>
              </div>
              <div>
                <span>Ranged Attack</span>
                <strong>{derived.rangedAttack}</strong>
              </div>
              <div>
                <span>Melee Damage</span>
                <strong>{derived.meleeDamage}</strong>
              </div>
              <div>
                <span>Ranged Damage</span>
                <strong>{derived.rangedDamage}</strong>
              </div>
            </div>
          </article>

          <article className="sheet-card stat-card">
            <p className="section-kicker">Core Build</p>
            <h2>Stats</h2>
            <div className="stat-groups">
              {statGroups.map((group) => (
                <section key={group.title} className={`stat-group stat-group-${group.accent}`}>
                  <header>
                    <h3>{group.title}</h3>
                  </header>
                  <div className="stat-list">
                    {group.ids.map((statId) => {
                      const stat = sheetState.statState[statId];
                      const current = currentStats[statId];
                      const incrementCost = getIncrementCost(STAT_XP_BY_LEVEL, stat.base);
                      const canIncrease = isEditMode && stat.base < STAT_XP_BY_LEVEL.length - 1 && xpLeftOver >= incrementCost;
                      const floorLevel = editSessionStatFloor?.[statId] ?? stat.base;
                      const canDecrease = isEditMode && stat.base > floorLevel;

                      return (
                        <div key={statId} className="stat-row">
                          <div className="row-main">
                            <strong>{statId}</strong>
                            <small>{getDetail(stat.gearSources, stat.buffSources)}</small>
                          </div>
                          {isEditMode ? (
                            <div className="row-actions">
                              <button type="button" onClick={() => adjustStat(statId, -1)} disabled={!canDecrease}>
                                -
                              </button>
                              <button type="button" onClick={() => adjustStat(statId, 1)} disabled={!canIncrease}>
                                +
                              </button>
                            </div>
                          ) : null}
                          <div className="row-side">
                            <span>{getSummary(stat.base, stat.gearSources, stat.buffSources)}</span>
                            <em>{current}</em>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <article className="sheet-card skill-card">
            <p className="section-kicker">Roll Inputs</p>
            <h2>Skills</h2>
            <div className="skill-table">
              {sheetState.skills.map((skill) => {
                const current = getCurrentSkillValue(sheetState.skills, skill.id);
                const incrementCost = getIncrementCost(T1_SKILL_XP_BY_LEVEL, skill.base);
                const canIncrease = isEditMode && skill.base < T1_SKILL_XP_BY_LEVEL.length - 1 && xpLeftOver >= incrementCost;
                const canDecrease = isEditMode && skill.base > 0;

                return (
                  <div key={skill.id} className="skill-row">
                    <div className="row-main">
                      <strong>{skill.label}</strong>
                      <small>{getDetail(skill.gearSources, skill.buffSources)}</small>
                    </div>
                    {isEditMode ? (
                      <div className="row-actions">
                        <button type="button" onClick={() => adjustSkill(skill.id, -1)} disabled={!canDecrease}>
                          -
                        </button>
                        <button type="button" onClick={() => adjustSkill(skill.id, 1)} disabled={!canIncrease}>
                          +
                        </button>
                      </div>
                    ) : null}
                    <div className="row-side">
                      <span>{getSummary(skill.base, skill.gearSources, skill.buffSources)}</span>
                      <em>{current}</em>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="sheet-card power-card">
            <p className="section-kicker">T1 Powers</p>
            <h2>Known Powers</h2>
            {isEditMode ? (
              <div className="power-add-row">
                <select value={pendingPowerId} onChange={(event) => setPendingPowerId(event.target.value)}>
                  <option value="">Add Level 1 Power</option>
                  {availablePowerOptions.map((power) => (
                    <option key={power.id} value={power.id}>
                      {power.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={handleAddPower} disabled={!pendingPowerId || xpLeftOver < getIncrementCost(T1_POWER_XP_BY_LEVEL, 0)}>
                  Add
                </button>
              </div>
            ) : null}
            <div className="power-list">
              {sheetState.powers.length === 0 ? (
                <p className="empty-block-copy">No powers learned yet.</p>
              ) : sheetState.powers.map((power) => {
                const incrementCost = getIncrementCost(T1_POWER_XP_BY_LEVEL, power.level);
                const canIncrease = isEditMode && power.level < T1_POWER_XP_BY_LEVEL.length - 1 && xpLeftOver >= incrementCost;
                const canDecrease = isEditMode && power.level > 0;

                return (
                  <div key={power.id} className="power-row">
                    <div className="row-main">
                      <strong>
                        {power.name} Lv {power.level}
                      </strong>
                      <ul className="power-benefits">
                        {getPowerBenefits(power.id, power.level).map((benefit) => (
                          <li key={benefit}>{benefit}</li>
                        ))}
                      </ul>
                    </div>
                    {isEditMode ? (
                      <div className="row-actions">
                        <button type="button" onClick={() => adjustPower(power.id, -1)} disabled={!canDecrease}>
                          -
                        </button>
                        <button type="button" onClick={() => adjustPower(power.id, 1)} disabled={!canIncrease}>
                          +
                        </button>
                      </div>
                    ) : null}
                    <div className="row-side">
                      <span>Base {power.level}</span>
                      <em>{power.governingStat}</em>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="sheet-card equipment-card">
            <p className="section-kicker">Equipment</p>
            <h2>Loadout</h2>
            <div className="equipment-list">
              {sheetState.equipment.length === 0 ? (
                <p className="empty-block-copy">No loadout equipped.</p>
              ) : (
                sheetState.equipment.map((entry) => (
                  <div key={entry.slot} className="equipment-row">
                    <div>
                      <strong>{entry.slot}</strong>
                      <span>{entry.item}</span>
                    </div>
                    <em>{entry.effect}</em>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="sheet-card inventory-card">
            <p className="section-kicker">Owned Items</p>
            <h2>Inventory</h2>
            <div className="inventory-header">
              <span>Money</span>
              <strong>{sheetState.money}</strong>
            </div>
            <div className="inventory-list">
              {sheetState.inventory.length === 0 ? (
                <p className="empty-block-copy">No items in inventory.</p>
              ) : (
                sheetState.inventory.map((entry) => (
                  <div key={entry.name} className="inventory-row">
                    <div>
                      <strong>{entry.name}</strong>
                      <span>{entry.category}</span>
                    </div>
                    <em>{entry.note}</em>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="sheet-card notes-card">
            <p className="section-kicker">Sheet Notes</p>
            <h2>Session Notes</h2>
            <textarea
              className="notes-input"
              value={sessionNotes}
              onChange={(event) => setSessionNotes(event.target.value)}
              readOnly={isReadOnlyView}
            />
            {!isReadOnlyView ? (
              <button type="button" className="notes-submit" onClick={handleAppendHistory}>
                Add To Game History
              </button>
            ) : null}
          </article>

          <article className="sheet-card history-card">
            <p className="section-kicker">Session Log</p>
            <h2>Game History</h2>
            {historyEntries.length === 0 ? (
              <p className="history-empty">No submitted game history yet.</p>
            ) : (
              <div className="history-list">
                {historyEntries.map((entry) => (
                  <section key={entry.id} className="history-entry">
                    <strong>
                      {entry.actualDateTime} / {entry.gameDateTime}
                    </strong>
                    <p>{entry.note}</p>
                  </section>
                ))}
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
