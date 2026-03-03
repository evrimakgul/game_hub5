import { useState } from "react";

import {
  calculateArmorClass,
  calculateInitiative,
  calculateMaxHP,
  calculateOccultManaBonus,
  calculateRangedBonusDice,
} from "../config/stats";
import { getCrAndRankFromXpUsed } from "../config/xpTables";

type StatSource = {
  label: string;
  value: number;
};

type StatEntry = {
  base: number;
  gearSources: StatSource[];
  buffSources: StatSource[];
};

type SkillEntry = {
  id: string;
  label: string;
  base: number;
  rollStat: string;
  gearSources: StatSource[];
  buffSources: StatSource[];
};

type StatId = "STR" | "DEX" | "STAM" | "CHA" | "APP" | "MAN" | "INT" | "WITS" | "PER";

type PowerEntry = {
  name: string;
  level: number;
  governingStat: string;
  benefits: string[];
};

type CharacterDraft = {
  name: string;
  concept: string;
  faction: string;
  age: number;
  gameDateTime: string;
  biographyPrimary: string;
  biographySecondary: string;
  xpEarned: number;
  xpUsed: number;
  money: number;
  inspiration: number;
  positiveKarma: number;
  negativeKarma: number;
  currentHp: number;
  currentMana: number;
  resistances: string[];
  vulnerabilities: string[];
  immunities: string[];
  statState: Record<StatId, StatEntry>;
  skills: SkillEntry[];
  powers: PowerEntry[];
  equipment: Array<{ slot: string; item: string; effect: string }>;
  inventory: Array<{ name: string; category: string; note: string }>;
  effects: string[];
};

const character: CharacterDraft = {
  name: "Mira Vale",
  concept: "Portal Scout / Support Occultist",
  faction: "Convergence Field Cell",
  age: 24,
  gameDateTime: "17.09.2124 - 22:40",
  biographyPrimary:
    "Fast-reading scout who survives by preparation, layered awareness, and battlefield positioning.",
  biographySecondary:
    "Built as an alert support character with enough mobility to keep line of sight, feed information, and stabilize a fight before it collapses.",
  xpEarned: 74,
  xpUsed: 66,
  money: 180,
  inspiration: 2,
  positiveKarma: 0,
  negativeKarma: 0,
  currentHp: 12,
  currentMana: 8,
  resistances: ["None"],
  vulnerabilities: ["None"],
  immunities: ["None"],
  statState: {
    STR: { base: 3, gearSources: [], buffSources: [] },
    DEX: { base: 4, gearSources: [], buffSources: [] },
    STAM: { base: 5, gearSources: [], buffSources: [] },
    CHA: { base: 1, gearSources: [], buffSources: [] },
    APP: { base: 2, gearSources: [], buffSources: [] },
    MAN: { base: 2, gearSources: [], buffSources: [] },
    INT: { base: 3, gearSources: [], buffSources: [] },
    WITS: { base: 3, gearSources: [], buffSources: [] },
    PER: { base: 4, gearSources: [], buffSources: [] },
  },
  skills: [
    { id: "melee", label: "Melee", base: 2, rollStat: "DEX", gearSources: [], buffSources: [] },
    { id: "ranged", label: "Ranged", base: 3, rollStat: "DEX + floor((PER - 1) / 2)", gearSources: [], buffSources: [] },
    { id: "athletics", label: "Athletics", base: 3, rollStat: "DEX", gearSources: [], buffSources: [] },
    { id: "stealth", label: "Stealth", base: 2, rollStat: "DEX", gearSources: [], buffSources: [] },
    {
      id: "alertness",
      label: "Alertness",
      base: 2,
      rollStat: "PER",
      gearSources: [],
      buffSources: [{ label: "Awareness", value: 2 }],
    },
    { id: "intimidation", label: "Intimidation", base: 1, rollStat: "CHA", gearSources: [], buffSources: [] },
    { id: "social", label: "Social", base: 1, rollStat: "CHA / MAN / APP", gearSources: [], buffSources: [] },
    { id: "medicine", label: "Medicine", base: 0, rollStat: "INT", gearSources: [], buffSources: [] },
    { id: "technology", label: "Technology", base: 1, rollStat: "INT", gearSources: [], buffSources: [] },
    { id: "academics", label: "Academics", base: 1, rollStat: "INT", gearSources: [], buffSources: [] },
    { id: "mechanics", label: "Mechanics", base: 0, rollStat: "DEX", gearSources: [], buffSources: [] },
    { id: "occultism", label: "Occultism", base: 3, rollStat: "INT", gearSources: [], buffSources: [] },
  ],
  powers: [
    {
      name: "Awareness",
      level: 2,
      governingStat: "PER",
      benefits: [
        "Alertness bonus: +2",
        "Identify stronger targets, including special or supernatural skills and possible loot",
        "Identify items up to Epic quality",
      ],
    },
    {
      name: "Light Support",
      level: 1,
      governingStat: "APP",
      benefits: [
        "Light Aura bonus: +1 Hit - 10 minutes or 1 portal - 25 meters",
        "Cantrip: Nightvision, +1 Mana",
      ],
    },
    {
      name: "Body Reinforcement",
      level: 1,
      governingStat: "STAM",
      benefits: [
        "Increase one physical stat by +1: STR, DEX, or STAM",
        "Standard action, 2 Mana - 10 minutes or 1 portal duration",
      ],
    },
  ],
  equipment: [
    { slot: "Head", item: "Survey Goggles", effect: "+1 Alertness in low visibility" },
    { slot: "Neck", item: "Hunter Charm", effect: "+1 Mana reserve" },
    { slot: "Body", item: "Leather Coat", effect: "+2 AC, +2 DR" },
    { slot: "Right Hand", item: "Iron Sword", effect: "+2 melee damage" },
    { slot: "Left Hand", item: "Signal Lantern", effect: "Light Support focus item" },
    { slot: "Ring Right", item: "Silver Ring", effect: "No active bonus" },
    { slot: "Ring Left", item: "Empty", effect: "-" },
  ],
  inventory: [
    { name: "Portal Chalk", category: "Utility", note: "Ritual markings and route notation" },
    { name: "Bandage Roll", category: "Medical", note: "Field stabilization kit" },
    { name: "Spare Lantern Oil", category: "Supply", note: "Supports long portal runs" },
  ],
  effects: [
    "Guarded posture before engagement",
    "Awareness focus trained toward reading hostile intent",
    "No temporary buffs active on sheet start",
  ],
};

const statGroups = [
  { title: "Physical", ids: ["STR", "DEX", "STAM"] as const, accent: "physical" },
  { title: "Social", ids: ["CHA", "APP", "MAN"] as const, accent: "social" },
  { title: "Mental", ids: ["INT", "WITS", "PER"] as const, accent: "mental" },
];

type HistoryEntry = {
  id: number;
  actualDateTime: string;
  gameDateTime: string;
  note: string;
};

function getCurrentStat(statId: StatId): number {
  const stat = character.statState[statId];
  const gearTotal = stat.gearSources.reduce((total, source) => total + source.value, 0);
  const buffTotal = stat.buffSources.reduce((total, source) => total + source.value, 0);
  return stat.base + gearTotal + buffTotal;
}

function getStatSourceSummary(statId: StatId): string {
  const stat = character.statState[statId];
  const gearTotal = stat.gearSources.reduce((total, source) => total + source.value, 0);
  const buffTotal = stat.buffSources.reduce((total, source) => total + source.value, 0);
  return `Base ${stat.base} + Gears ${gearTotal} + Buffs ${buffTotal}`;
}

function getStatSourceDetail(statId: StatId): string {
  const stat = character.statState[statId];
  const gearText =
    stat.gearSources.length > 0
      ? stat.gearSources.map((source) => `${source.label} ${source.value >= 0 ? "+" : ""}${source.value}`).join(", ")
      : "none";
  const buffText =
    stat.buffSources.length > 0
      ? stat.buffSources.map((source) => `${source.label} ${source.value >= 0 ? "+" : ""}${source.value}`).join(", ")
      : "none";

  return `Gear: ${gearText} | Buffs: ${buffText}`;
}

function getCurrentSkillValue(skillId: string): number {
  const skill = character.skills.find((entry) => entry.id === skillId);
  if (!skill) {
    return 0;
  }

  const gearTotal = skill.gearSources.reduce((total, source) => total + source.value, 0);
  const buffTotal = skill.buffSources.reduce((total, source) => total + source.value, 0);
  return skill.base + gearTotal + buffTotal;
}

function getSkillSourceSummary(skillId: string): string {
  const skill = character.skills.find((entry) => entry.id === skillId);
  if (!skill) {
    return "Base 0 + Gears 0 + Buffs 0";
  }

  const gearTotal = skill.gearSources.reduce((total, source) => total + source.value, 0);
  const buffTotal = skill.buffSources.reduce((total, source) => total + source.value, 0);
  return `Base ${skill.base} + Gears ${gearTotal} + Buffs ${buffTotal}`;
}

function getSkillSourceDetail(skillId: string): string {
  const skill = character.skills.find((entry) => entry.id === skillId);
  if (!skill) {
    return "Gear: none | Buffs: none";
  }

  const gearText =
    skill.gearSources.length > 0
      ? skill.gearSources.map((source) => `${source.label} ${source.value >= 0 ? "+" : ""}${source.value}`).join(", ")
      : "none";
  const buffText =
    skill.buffSources.length > 0
      ? skill.buffSources.map((source) => `${source.label} ${source.value >= 0 ? "+" : ""}${source.value}`).join(", ")
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

export function HomePage() {
  const [currentRead, setCurrentRead] = useState(character.effects.join("\n"));
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  const actualDate = formatDateDayMonthYear(new Date());
  const combinedDateLine = `${actualDate} / ${character.gameDateTime}`;
  const progression = getCrAndRankFromXpUsed(character.xpUsed);
  const xpLeftOver = character.xpEarned - character.xpUsed;
  const currentStats = {
    STR: getCurrentStat("STR"),
    DEX: getCurrentStat("DEX"),
    STAM: getCurrentStat("STAM"),
    CHA: getCurrentStat("CHA"),
    APP: getCurrentStat("APP"),
    MAN: getCurrentStat("MAN"),
    INT: getCurrentStat("INT"),
    WITS: getCurrentStat("WITS"),
    PER: getCurrentStat("PER"),
  };
  const occultBonus = calculateOccultManaBonus(getCurrentSkillValue("occultism"), character.xpUsed);

  const derived = {
    maxHp: calculateMaxHP(currentStats.STAM),
    maxMana: character.currentMana + occultBonus,
    initiative: calculateInitiative(currentStats.DEX, currentStats.WITS),
    armorClass: calculateArmorClass(currentStats.DEX, getCurrentSkillValue("athletics"), 2),
    damageReduction: 2,
    soak: currentStats.STAM,
    meleeAttack: getCurrentSkillValue("melee") + currentStats.DEX,
    rangedAttack:
      getCurrentSkillValue("ranged") + currentStats.DEX + calculateRangedBonusDice(currentStats.PER),
    meleeDamage: currentStats.STR + 2,
    rangedDamage: "-",
  };

  function handleAppendHistory(): void {
    const note = currentRead.trim();

    if (!note) {
      return;
    }

    const now = new Date();

    setHistoryEntries((entries) => [
      {
        id: entries.length + 1,
        actualDateTime: `${formatDateDayMonthYear(now)} - ${formatTimeHoursMinutes(now)}`,
        gameDateTime: character.gameDateTime,
        note,
      },
      ...entries,
    ]);
    setCurrentRead("");
  }

  return (
    <main className="sheet-page">
      <section className="sheet-frame">
        <header className="sheet-header">
          <div className="sheet-header-copy">
            <p className="sheet-kicker">Convergence Character Sheet Draft</p>
            <h1>{character.name}</h1>
            <p className="sheet-concept">
              {character.concept} | {character.faction}
            </p>
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
              <strong>{character.age}</strong>
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
              <strong>{character.gameDateTime}</strong>
            </div>
          </div>
          <div>
            <span>XP Block</span>
            <div className="xp-block-grid">
              <span>Earned</span>
              <span>Used</span>
              <span>Left-Over</span>
              <strong>{character.xpEarned}</strong>
              <strong>{character.xpUsed}</strong>
              <strong>{xpLeftOver}</strong>
            </div>
          </div>
          <div>
            <span>Karma</span>
            <strong>
              +{character.positiveKarma} / -{character.negativeKarma}
            </strong>
          </div>
        </section>

        <section className="sheet-grid">
          <article className="sheet-card biography-card">
            <p className="section-kicker">Identity</p>
            <h2>Biography</h2>
            <p>{character.biographyPrimary}</p>
            <p>{character.biographySecondary}</p>
          </article>

          <article className="sheet-card resource-card">
            <p className="section-kicker">Stored State</p>
            <h2>Resources</h2>
            <div className="resource-strip">
              <div>
                <span>HP</span>
                <strong>
                  {character.currentHp} / {derived.maxHp}
                </strong>
              </div>
              <div>
                <span>Mana</span>
                <strong>
                  {character.currentMana} / {derived.maxMana}
                </strong>
              </div>
              <div>
                <span>Inspiration</span>
                <strong>{character.inspiration}</strong>
              </div>
            </div>
          </article>

          <article className="sheet-card status-card">
            <p className="section-kicker">Combat Flags</p>
            <h2>Status</h2>
            <div className="status-list">
              <div>
                <span>Resistance</span>
                <strong>{character.resistances.join(", ")}</strong>
              </div>
              <div>
                <span>Vulnerability</span>
                <strong>{character.vulnerabilities.join(", ")}</strong>
              </div>
              <div>
                <span>Immunity</span>
                <strong>{character.immunities.join(", ")}</strong>
              </div>
            </div>
          </article>

          <article className="sheet-card combat-card">
            <p className="section-kicker">Derived Summary</p>
            <h2>Combat Block</h2>
            <div className="combat-grid">
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
                      const current = currentStats[statId];
                      return (
                        <div key={statId} className="stat-row">
                          <div className="row-main">
                            <strong>{statId}</strong>
                            <small>{getStatSourceDetail(statId)}</small>
                          </div>
                          <div className="row-side">
                            <span>{getStatSourceSummary(statId)}</span>
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
              {character.skills.map((skill) => (
                <div key={skill.id} className="skill-row">
                  <div className="row-main">
                    <strong>{skill.label}</strong>
                    <small>{getSkillSourceDetail(skill.id)}</small>
                  </div>
                  <div className="row-side">
                    <span>{getSkillSourceSummary(skill.id)}</span>
                    <em>{getCurrentSkillValue(skill.id)}</em>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="sheet-card power-card">
            <p className="section-kicker">T1 Powers</p>
            <h2>Known Powers</h2>
            <div className="power-list">
              {character.powers.map((power) => (
                <div key={power.name} className="power-row">
                  <div>
                    <strong>
                      {power.name} Lv {power.level}
                    </strong>
                    <ul className="power-benefits">
                      {power.benefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                  </div>
                  <em>{power.governingStat}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="sheet-card equipment-card">
            <p className="section-kicker">Equipment</p>
            <h2>Loadout</h2>
            <div className="equipment-list">
              {character.equipment.map((entry) => (
                <div key={entry.slot} className="equipment-row">
                  <div>
                    <strong>{entry.slot}</strong>
                    <span>{entry.item}</span>
                  </div>
                  <em>{entry.effect}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="sheet-card inventory-card">
            <p className="section-kicker">Owned Items</p>
            <h2>Inventory</h2>
            <div className="inventory-header">
              <span>Money</span>
              <strong>{character.money}</strong>
            </div>
            <div className="inventory-list">
              {character.inventory.map((entry) => (
                <div key={entry.name} className="inventory-row">
                  <div>
                    <strong>{entry.name}</strong>
                    <span>{entry.category}</span>
                  </div>
                  <em>{entry.note}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="sheet-card notes-card">
            <p className="section-kicker">Sheet Notes</p>
            <h2>Current Read</h2>
            <textarea
              className="notes-input"
              value={currentRead}
              onChange={(event) => setCurrentRead(event.target.value)}
            />
            <button type="button" className="notes-submit" onClick={handleAppendHistory}>
              Add To Game History
            </button>
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
