import type { ActionType, CoreStatId, NumericFormula, PowerId } from "./game";

export type PowerActionType = ActionType | "bonus_or_standard" | "bonus_plus_standard";

export interface PowerLevelDefinition {
  level: number;
  actionType?: PowerActionType | null;
  manaCost?: number | null;
  manaCostVariants?: Record<string, number>;
  mechanics: Record<string, unknown>;
  adjudication?: Record<string, unknown>;
  description?: string;
}

export interface PowerCantripLevelDefinition {
  powerLevel: number;
  actionType?: PowerActionType | null;
  manaCost?: number | null;
  mechanics: Record<string, unknown>;
  description?: string;
}

export interface PowerCantripDefinition {
  introducedAtLevel: number;
  levels: PowerCantripLevelDefinition[];
  description?: string;
}

export interface PowerSummonTemplate {
  combatSummary?: Record<string, number | NumericFormula | string | boolean>;
  stats?: Record<string, number | NumericFormula>;
  attacks?: Array<Record<string, unknown>>;
  defenses?: Record<string, unknown>;
  resistances?: string[];
  immunities?: string[];
  vulnerabilities?: string[];
  initiative?: Record<string, unknown>;
  buffRules?: Record<string, unknown>;
  equipmentRules?: Record<string, unknown>;
  summoningRules?: Record<string, unknown>;
}

export interface PowerDefinition {
  id: PowerId;
  name: string;
  abbreviation?: string;
  governingStat: CoreStatId;
  levels: PowerLevelDefinition[];
  cantrip?: PowerCantripDefinition;
  notes?: string[];
  summonTemplates?: Record<string, PowerSummonTemplate>;
}

export interface KnownPower {
  powerId: PowerId;
  level: number;
  learnedFrom: "xp" | "item" | "npc" | "other";
  unlockedAtXp: number | null;
}
