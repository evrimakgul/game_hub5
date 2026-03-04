import { useEffect, useRef, useState } from "react";

import { resolveDicePool } from "../config/combat";
import {
  createDefaultResistances,
  DAMAGE_TYPES,
  RESISTANCE_LEVELS,
  type DamageTypeId,
  type ResistanceLevel,
} from "../config/resistances";
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
  id: string;
  name: string;
  level: number;
  governingStat: string;
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
  resistances: Record<DamageTypeId, ResistanceLevel>;
  statState: Record<StatId, StatEntry>;
  skills: SkillEntry[];
  powers: PowerEntry[];
  equipment: Array<{ slot: string; item: string; effect: string }>;
  inventory: Array<{ name: string; category: string; note: string }>;
  effects: string[];
};

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

type PowerTemplate = {
  id: string;
  name: string;
  governingStat: string;
  levelBenefits: Record<number, string[]>;
};

const initialCharacter: CharacterDraft = {
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
  resistances: createDefaultResistances(),
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
    { id: "awareness", name: "Awareness", level: 2, governingStat: "PER" },
    { id: "light_support", name: "Light Support", level: 1, governingStat: "APP" },
    { id: "body_reinforcement", name: "Body Reinforcement", level: 1, governingStat: "STAM" },
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

const powerLibrary: PowerTemplate[] = [
  {
    id: "awareness",
    name: "Awareness",
    governingStat: "PER",
    levelBenefits: {
      1: [
        "Alertness bonus: +1",
        "Identify simple NPC stats and common to masterwork items",
      ],
      2: [
        "Alertness bonus: +2",
        "Identify stronger targets, special skills, loot, and epic or lesser items",
      ],
      3: [
        "Alertness bonus: +3",
        "Ignore techno-infused invisibility devices",
        "Cantrip: +1 Inspiration per session",
      ],
      4: [
        "Alertness bonus: +4",
        "Identify legendary or lesser items",
      ],
      5: [
        "Alertness bonus: +5",
        "Identify nearly all targets except supreme beings",
      ],
    },
  },
  {
    id: "body_reinforcement",
    name: "Body Reinforcement",
    governingStat: "STAM",
    levelBenefits: {
      1: ["Increase one physical stat by +1", "Standard action, 2 Mana"],
      2: ["Increase one touched target physical stat by +1", "Cantrip: self-revive with 1 HP once per day"],
      3: ["Increase one physical stat by +2", "Standard action, 3 Mana"],
      4: ["Increase one physical stat by +2", "Also grants +1 DR"],
      5: ["Increase one physical stat by +3", "Also grants +2 DR"],
    },
  },
  {
    id: "crowd_control",
    name: "Crowd Control",
    governingStat: "CHA",
    levelBenefits: {
      1: ["Paralyze one living target", "Maintenance cost: 1 Mana per turn"],
      2: ["Issue simple commands", "Orders cost a bonus action"],
      3: ["Control two targets", "Others dealing damage no longer breaks control"],
      4: ["Control is a bonus action", "Commands become free"],
      5: ["Control three targets", "Can affect non-living targets except other summons"],
    },
  },
  {
    id: "elementalist",
    name: "Elementalist",
    governingStat: "INT",
    levelBenefits: {
      1: ["Elemental bolt damage: INT + 1", "One target, 1 Mana"],
      2: ["Elemental bolt damage: INT + 2", "Can split between two targets"],
      3: ["Elemental bolt damage: INT + 3", "Switch between fire, cold, lightning, acid"],
      4: ["Elemental bolt damage: INT + 4", "Can affect three targets"],
      5: ["Elemental bolt damage: INT + 5", "Necrotic option unlocked"],
    },
  },
  {
    id: "healing",
    name: "Healing",
    governingStat: "INT",
    levelBenefits: {
      1: ["Heal INT + 1", "Removes bleeding"],
      2: ["Heal INT + 2", "Can spread across allies in range"],
      3: ["Heal INT + 3", "Removes poison, disease, curse"],
      4: ["Heal INT + 4", "Can regrow missing limbs"],
      5: ["Heal INT + 5", "Advanced restoration"],
    },
  },
  {
    id: "light_support",
    name: "Light Support",
    governingStat: "APP",
    levelBenefits: {
      1: ["Light Aura bonus: +1 Hit - 10 minutes - 25 meters", "Cantrip: Nightvision, +1 Mana"],
      2: ["Light Aura bonus: +2 Hit, +1 DR - 30 minutes - 50 meters", "Hostile targets cannot see it"],
      3: ["Light Aura bonus: +3 Hit, +1 DR, +1 Soak - 1 Hour - 50 meters", "Cantrip: Nightvision, +2 Mana"],
      4: ["Light Aura bonus: +3 Hit, +2 DR, +1 Soak - 3 Hours - 100 meters", "One mana restore use per long rest"],
      5: ["Light Aura bonus: +4 Hit, +2 DR, +2 Soak - 8 Hours - 100 meters", "Expose darkness while concentrating"],
    },
  },
  {
    id: "necromancy",
    name: "Necromancy",
    governingStat: "APP",
    levelBenefits: {
      1: ["Summon one simple skeleton", "10 minutes or portal duration"],
      2: ["Summon two simple skeletons or one skeleton king", "Cantrip: undead aggro drops"],
      3: ["Necrotic Touch unlocked", "Summons retained"],
      4: ["Zombie option unlocked", "Summons gain +2 attack and damage"],
      5: ["Summons gain +5 attack and damage", "Resurrection unlocked"],
    },
  },
  {
    id: "shadow_control",
    name: "Shadow Control",
    governingStat: "MAN",
    levelBenefits: {
      1: ["Cloak of shadow: +1 stealth, +1 intimidation, +1 AC"],
      2: ["Shadow Walk unlocked", "Cloak bonuses improve"],
      3: ["Shadow Manipulation unlocked", "Cloak bonuses improve"],
      4: ["Cloak can cover allies", "Shared shadow protection"],
      5: ["Summon Shadow Soldier", "Cloak reaches strongest form"],
    },
  },
];

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

function getPowerTemplate(powerId: string): PowerTemplate | undefined {
  return powerLibrary.find((power) => power.id === powerId);
}

function getPowerBenefits(powerId: string, level: number): string[] {
  const template = getPowerTemplate(powerId);
  return template?.levelBenefits[level] ?? [`Level ${level} details pending in draft.`];
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

export function HomePage() {
  const [sheetState, setSheetState] = useState(initialCharacter);
  const [sessionNotes, setSessionNotes] = useState(initialCharacter.effects.join("\n"));
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingPowerId, setPendingPowerId] = useState("");
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [dicePosition, setDicePosition] = useState({ x: 24, y: 24 });
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
    armorClass: calculateArmorClass(currentStats.DEX, getCurrentSkillValue(sheetState.skills, "athletics"), 2),
    damageReduction: 2,
    soak: currentStats.STAM,
    meleeAttack: getCurrentSkillValue(sheetState.skills, "melee") + currentStats.DEX,
    rangedAttack:
      getCurrentSkillValue(sheetState.skills, "ranged") + currentStats.DEX + calculateRangedBonusDice(currentStats.PER),
    meleeDamage: currentStats.STR + 2,
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
    const nextLevel = currentLevel + direction;
    if (nextLevel < 1 || nextLevel >= STAT_XP_BY_LEVEL.length) {
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
        <header className="sheet-header">
          <div className="sheet-header-copy">
            <p className="sheet-kicker">Convergence Character Sheet Draft</p>
            <h1>{sheetState.name}</h1>
            <p className="sheet-concept">
              {sheetState.concept} | {sheetState.faction}
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
              <strong>{sheetState.age}</strong>
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
            <button type="button" className="edit-trigger" onClick={() => setIsEditMode((value) => !value)}>
              {isEditMode ? "Lock" : "Edit"}
            </button>
          </div>
        </section>

        <section className="sheet-grid">
          <article className="sheet-card biography-card">
            <p className="section-kicker">Identity</p>
            <h2>Biography</h2>
            <p>{sheetState.biographyPrimary}</p>
            <p>{sheetState.biographySecondary}</p>
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
                      const canDecrease = false;

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
              {sheetState.powers.map((power) => {
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
              {sheetState.equipment.map((entry) => (
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
              <strong>{sheetState.money}</strong>
            </div>
            <div className="inventory-list">
              {sheetState.inventory.map((entry) => (
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
            <h2>Session Notes</h2>
            <textarea
              className="notes-input"
              value={sessionNotes}
              onChange={(event) => setSessionNotes(event.target.value)}
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
