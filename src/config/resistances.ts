export const DAMAGE_TYPES = [
  { id: "fire", label: "Fire", family: "elemental" },
  { id: "ice", label: "Ice", family: "elemental" },
  { id: "acid", label: "Acid", family: "elemental" },
  { id: "lightning", label: "Lightning", family: "elemental" },
  { id: "shadow", label: "Shadow", family: "mystic" },
  { id: "radiant", label: "Radiant", family: "mystic" },
  { id: "necrotic", label: "Necrotic", family: "mystic" },
  { id: "sonic", label: "Sonic", family: "elemental" },
  { id: "mental", label: "Mental", family: "psychic" },
  { id: "divine", label: "Divine", family: "mystic" },
  { id: "physical", label: "Physical", family: "mundane" },
] as const;

export type DamageTypeId = (typeof DAMAGE_TYPES)[number]["id"];
export type ResistanceFamily = (typeof DAMAGE_TYPES)[number]["family"];
export type ResistanceLevel = -2 | -1 | 0 | 1 | 2;

export const RESISTANCE_LEVELS: Record<
  ResistanceLevel,
  { label: string; damageMultiplier: number }
> = {
  [-2]: { label: "Fragile", damageMultiplier: 2 },
  [-1]: { label: "Vulnerable", damageMultiplier: 1.5 },
  [0]: { label: "Normal", damageMultiplier: 1 },
  [1]: { label: "Resist", damageMultiplier: 0.5 },
  [2]: { label: "Immune", damageMultiplier: 0 },
};

export const ELEMENTAL_DAMAGE_TYPES: DamageTypeId[] = [
  "fire",
  "ice",
  "acid",
  "lightning",
  "sonic",
];

export const LIGHT_SUPPORT_LEVEL_FIVE_EXPOSE_DARKNESS_TYPES: DamageTypeId[] = [
  "physical",
  ...ELEMENTAL_DAMAGE_TYPES,
];

export function createDefaultResistances(): Record<DamageTypeId, ResistanceLevel> {
  return {
    fire: 0,
    ice: 0,
    acid: 0,
    lightning: 0,
    shadow: 0,
    radiant: 0,
    necrotic: 0,
    sonic: 0,
    mental: 0,
    divine: 0,
    physical: 0,
  };
}

